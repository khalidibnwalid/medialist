import { db } from "@/server/db";
import { $createItems, $deleteItems, $updateItems } from "@/server/db/queries/items";
import { $createLists, $deleteLists, $updateLists } from "@/server/db/queries/lists";
import { $createItemMedia, $deleteItemMedia, $updateItemMedia } from "@/server/db/queries/media";
import { $createTags, $deleteTags, $updateTag } from "@/server/db/queries/tags";
import { SyncEntity } from "@/server/db/schema";
import $deleteFile from "@/server/utils/file/deleteFile";
import $deleteFolder from "@/server/utils/file/deleteFolder";
import $getDir from "@/server/utils/file/getDir";
import { THUMBNAILS_OPTIONS } from "@/utils/lib/fileHandling/thumbnailOptions";
import { validateLongID, validateShortID } from "@/utils/lib/generateID";
import { eq } from "drizzle-orm";
import { deepEqual, merge3 } from "./merge";
import { SYNC_ENTITIES, SYNC_TABLES } from "./pull";

export interface SyncOp {
    /** client id, echoed back */
    opId: string
    entity: SyncEntity
    /** entity id, client-generated for creates */
    id: string
    type: 'upsert' | 'delete'
    /** upsert: changed fields (all fields on create) */
    data?: Record<string, unknown>
    /** upsert: the server values of those same fields the client last saw. null/absent => client thinks it's a create */
    base?: Record<string, unknown> | null
    /** client wall-clock ms of the edit */
    ts: number
}

export type SyncOpStatus = 'created' | 'applied' | 'merged' | 'deleted' | 'gone' | 'rejected'

export interface SyncOpResult {
    opId: string
    status: SyncOpStatus
    row?: Record<string, unknown>
    error?: string
}

type Row = Record<string, unknown> & { id: string, userId: string | null, updatedAt: Date }
type Validator = (value: unknown) => boolean

class SyncOpRejection extends Error { }
const reject = (message: string): never => { throw new SyncOpRejection(message) }

/* ---------------------------------- validation ---------------------------------- */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/** a plain file name inside the entity's folder, as stored by the upload endpoints */
export const isPlainFileName = (value: unknown) =>
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 255 &&
    !/[\/\\\0]/.test(value) &&
    !value.includes('..')

/** all `logoPath`s nested anywhere inside a value (layout tabs, header badges) */
export function collectLogoPaths(value: unknown, paths: unknown[] = []) {
    if (Array.isArray(value))
        value.forEach(v => collectLogoPaths(v, paths))
    else if (isPlainObject(value))
        for (const key in value) {
            if (key === 'logoPath') {
                if (value[key] !== null && value[key] !== undefined) paths.push(value[key])
            } else collectLogoPaths(value[key], paths)
        }
    return paths
}

const nonEmptyString: Validator = v => typeof v === 'string' && v.trim().length > 0
const nullableString: Validator = v => v === null || typeof v === 'string'
const boolean: Validator = v => typeof v === 'boolean'
const stringArray: Validator = v => Array.isArray(v) && v.every(e => typeof e === 'string')
const object: Validator = v => isPlainObject(v)
const nullableObject: Validator = v => v === null || isPlainObject(v)
const nullableFileName: Validator = v => v === null || isPlainFileName(v)
const shortId: Validator = v => validateShortID(v)
const logosAreFileNames = (v: unknown) => collectLogoPaths(v).every(isPlainFileName)
const layout: Validator = v => Array.isArray(v) && v.every(tab => Array.isArray(tab)) && logosAreFileNames(v)
const header: Validator = v => isPlainObject(v) &&
    (v.badges === undefined || Array.isArray(v.badges)) &&
    logosAreFileNames(v)

interface EntityConfig {
    validateId: (id: unknown) => boolean
    /** writable on create & update */
    fields: Record<string, Validator>
    /** writable on create only */
    createFields: Record<string, Validator>
}

const ENTITIES: Record<SyncEntity, EntityConfig> = {
    lists: {
        validateId: validateShortID,
        fields: {
            title: nonEmptyString,
            coverPath: nullableFileName,
            configs: object,
            trash: boolean,
        },
        createFields: {},
    },
    items: {
        validateId: validateShortID,
        fields: {
            title: nonEmptyString,
            description: nullableString,
            posterPath: nullableFileName,
            coverPath: nullableFileName,
            tags: stringArray,
            layout,
            header,
            fav: boolean,
            trash: boolean,
            extractor: nullableObject,
        },
        createFields: {
            listId: shortId,
            isTemplate: boolean,
        },
    },
    tags: {
        validateId: validateLongID,
        fields: {
            label: nonEmptyString,
            description: nullableString,
            groupName: nullableString,
            badgeable: nullableString,
        },
        createFields: {
            listId: shortId,
        },
    },
    media: {
        validateId: validateLongID,
        fields: {
            title: nullableString,
            keywords: stringArray,
        },
        createFields: {
            itemId: shortId,
            path: isPlainFileName,
            type: v => v === 'image',
        },
    },
}

/** picks & validates the writable fields of `data` */
function pickFields(config: EntityConfig, data: Record<string, unknown>, isCreate: boolean) {
    const validators = isCreate ? { ...config.fields, ...config.createFields } : config.fields
    const picked: Record<string, unknown> = {}

    for (const key in validators) {
        if (!(key in data) || data[key] === undefined) continue
        if (!validators[key](data[key])) reject(`invalid field: ${key}`)
        picked[key] = data[key]
    }

    return picked
}

/* ---------------------------------- processing ---------------------------------- */

/** processes ops sequentially, each op independently */
export async function $processSyncOps(userId: string, ops: unknown[]) {
    const results: SyncOpResult[] = []

    for (const op of ops) {
        const opId = isPlainObject(op) && typeof op.opId === 'string' ? op.opId : ''
        try {
            results.push(await processOp(userId, op))
        } catch (error) {
            if (error instanceof SyncOpRejection)
                results.push({ opId, status: 'rejected', error: error.message })
            else {
                console.log('[Error] sync op: ', error)
                results.push({ opId, status: 'rejected', error: 'internal error' })
            }
        }
    }

    return results
}

async function processOp(userId: string, rawOp: unknown): Promise<SyncOpResult> {
    if (!isPlainObject(rawOp)) return reject('invalid op')
    const op = rawOp as unknown as SyncOp

    if (typeof op.opId !== 'string') reject('invalid opId')
    if (!SYNC_ENTITIES.includes(op.entity)) reject('invalid entity')
    if (op.type !== 'upsert' && op.type !== 'delete') reject('invalid type')

    const config = ENTITIES[op.entity]
    if (!config.validateId(op.id)) reject('invalid id')

    const row = await getRow(op.entity, op.id)
    if (row && row.userId !== userId) reject('forbidden')

    if (op.type === 'delete') {
        if (!row) return { opId: op.opId, status: 'gone' }
        await deleteRow(userId, op.entity, row)
        return { opId: op.opId, status: 'deleted' }
    }

    if (!isPlainObject(op.data)) reject('invalid data')
    if (op.base !== undefined && op.base !== null && !isPlainObject(op.base)) reject('invalid base')
    const hasBase = isPlainObject(op.base)

    if (!row) {
        // the row was deleted on the server while the client was editing it: delete wins
        if (hasBase) return { opId: op.opId, status: 'gone' }

        const data = pickFields(config, op.data!, true)
        const created = await createRow(userId, op.entity, op.id, data)
        return { opId: op.opId, status: 'created', row: created }
    }

    if (typeof op.ts !== 'number' || !Number.isFinite(op.ts)) reject('invalid ts')

    const data = pickFields(config, op.data!, false)
    const base = hasBase ? op.base! : null
    // updatedAt is stored in seconds (truncated): an edit made within the same second can't be ordered, server wins
    const preferLocal = Math.floor(op.ts / 1000) * 1000 > row.updatedAt.getTime()

    const updates: Record<string, unknown> = {}
    let conflicted = false

    for (const key in data) {
        const server = row[key]
        const local = data[key]

        // no base => a retried create, apply as if base was the current server value
        if (!base || deepEqual(server, base[key])) {
            if (!deepEqual(server, local)) updates[key] = local
            continue
        }

        if (deepEqual(server, local)) continue

        conflicted = true
        const merged = merge3(base[key], local, server, preferLocal)
        if (!deepEqual(server, merged)) updates[key] = merged
    }

    const updated = await updateRow(userId, op.entity, row, updates)
    return { opId: op.opId, status: conflicted ? 'merged' : 'applied', row: updated }
}

async function getRow(entity: SyncEntity, id: string) {
    const table = SYNC_TABLES[entity]
    const [row] = await db
        .select()
        .from(table as typeof SYNC_TABLES.lists)
        .where(eq(table.id, id))
        .limit(1)
    return row as unknown as Row | undefined
}

async function getOwnedRow(userId: string, entity: SyncEntity, id: string) {
    const row = await getRow(entity, id)
    return row && row.userId === userId ? row : undefined
}

async function createRow(userId: string, entity: SyncEntity, id: string, data: Record<string, any>) {
    const now = new Date(Date.now())
    const meta = { id, userId, createdAt: now, updatedAt: now }

    switch (entity) {
        case 'lists': {
            if (data.title === undefined) reject('title is required')
            await $getDir(userId, id, true)
            const [list] = await $createLists({
                configs: { titlePlacement: 'title-below' },
                trash: false,
                coverPath: null,
                ...data,
                ...meta,
            } as typeof SYNC_TABLES.lists.$inferInsert)
            return list
        }

        case 'items': {
            if (data.title === undefined) reject('title is required')
            const isTemplate = data.isTemplate === true
            // templates are not attached to a list
            if (data.listId === undefined && !isTemplate) reject('listId is required')
            if (data.listId !== undefined && !await getOwnedRow(userId, 'lists', data.listId))
                reject('list not found')

            if (data.listId) await $getDir(userId, data.listId, id, true)
            const [item] = await $createItems({
                title: data.title,
                description: null,
                posterPath: null,
                coverPath: null,
                tags: [],
                layout: [],
                header: { type: 'poster_inside', badges: [] },
                extractor: null,
                fav: false,
                trash: false,
                isTemplate: false,
                ...data,
                ...meta,
            } as typeof SYNC_TABLES.items.$inferInsert)
            return item
        }

        case 'tags': {
            if (data.label === undefined) reject('label is required')
            if (data.listId === undefined) reject('listId is required')
            if (!await getOwnedRow(userId, 'lists', data.listId)) reject('list not found')

            const [tag] = await $createTags({
                description: null,
                groupName: null,
                ...data,
                badgeable: data.badgeable || '',
                ...meta,
            } as typeof SYNC_TABLES.tags.$inferInsert)
            return tag
        }

        case 'media': {
            if (data.path === undefined) reject('path is required')
            if (data.itemId === undefined) reject('itemId is required')
            if (!await getOwnedRow(userId, 'items', data.itemId)) reject('item not found')

            const [media] = await $createItemMedia({
                path: data.path,
                title: null,
                keywords: [],
                type: 'image',
                ...data,
                ...meta,
            } as typeof SYNC_TABLES.media.$inferInsert)
            return media
        }
    }
}

async function updateRow(userId: string, entity: SyncEntity, row: Row, updates: Record<string, any>) {
    const data = { ...updates, updatedAt: new Date(Date.now()) }

    switch (entity) {
        case 'lists': {
            const [list] = await $updateLists(userId, row.id, data)
            if (updates.coverPath !== undefined && row.coverPath && row.coverPath !== updates.coverPath) {
                const dir = await $getDir(userId, row.id)
                await $deleteFile(THUMBNAILS_OPTIONS.LIST_COVER, dir.list, row.coverPath as string)
            }
            return list
        }

        case 'items': {
            const [item] = await $updateItems(userId, row.id, data)
            if (row.listId) await deleteReplacedItemFiles(userId, row, updates)
            return item
        }

        case 'tags': {
            const [tag] = await $updateTag(userId, row.id, data)
            return tag
        }

        case 'media': {
            const [media] = await $updateItemMedia(userId, row.id, data)
            return media
        }
    }
}

async function deleteReplacedItemFiles(userId: string, row: Row, updates: Record<string, any>) {
    const dir = await $getDir(userId, row.listId as string, row.id)
    const itemDir = dir.item as string

    if (updates.coverPath !== undefined && row.coverPath && row.coverPath !== updates.coverPath)
        await $deleteFile(THUMBNAILS_OPTIONS.ITEM_COVER, itemDir, row.coverPath as string)

    if (updates.posterPath !== undefined && row.posterPath && row.posterPath !== updates.posterPath)
        await $deleteFile(THUMBNAILS_OPTIONS.ITEM_POSTER, itemDir, row.posterPath as string)

    if (updates.layout !== undefined || updates.header !== undefined) {
        const oldLogos = collectLogoPaths([row.layout, row.header])
        const newLogos = new Set(collectLogoPaths([
            updates.layout !== undefined ? updates.layout : row.layout,
            updates.header !== undefined ? updates.header : row.header,
        ]))

        for (const logoPath of new Set(oldLogos))
            if (!newLogos.has(logoPath) && isPlainFileName(logoPath))
                await $deleteFile(THUMBNAILS_OPTIONS.LOGO, itemDir, logoPath as string)
    }
}

async function deleteRow(userId: string, entity: SyncEntity, row: Row) {
    switch (entity) {
        case 'lists': {
            await $deleteLists(userId, [row.id])
            const dir = await $getDir(userId, row.id)
            await $deleteFolder(dir.list)
            return
        }

        case 'items': {
            await $deleteItems(userId, [row.id])
            if (row.listId) {
                const dir = await $getDir(userId, row.listId as string, row.id)
                await $deleteFolder(dir.item as string)
            }
            return
        }

        case 'tags': {
            await $deleteTags(userId, row.id)
            return
        }

        case 'media': {
            const item = row.itemId ? await getOwnedRow(userId, 'items', row.itemId as string) : undefined
            if (item?.listId && isPlainFileName(row.path)) {
                const dir = await $getDir(userId, item.listId as string, item.id)
                await $deleteFile(THUMBNAILS_OPTIONS.ITEM_MEDIA, dir.item as string, row.path as string)
            }
            await $deleteItemMedia(userId, row.id)
            return
        }
    }
}
