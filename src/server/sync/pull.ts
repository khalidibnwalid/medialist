import { db } from "@/server/db";
import { $getChangedEntities, $getSyncCursor } from "@/server/db/queries/sync";
import { itemsMedia, itemsTable, listsTable, listsTagsTable, SyncEntity } from "@/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export const SYNC_ENTITIES = ['lists', 'items', 'tags', 'media'] as const satisfies readonly SyncEntity[];

export const SYNC_TABLES = {
    lists: listsTable,
    items: itemsTable,
    tags: listsTagsTable,
    media: itemsMedia,
} as const

export type SyncRows = {
    lists: typeof listsTable.$inferSelect[]
    items: typeof itemsTable.$inferSelect[]
    tags: typeof listsTagsTable.$inferSelect[]
    media: typeof itemsMedia.$inferSelect[]
}

export interface SyncPullResponse {
    cursor: number
    hasMore: boolean
    serverTime: number
    changes: SyncRows
    deleted: Record<SyncEntity, string[]>
}

const MAX_IDS_PER_QUERY = 500;

const emptyDeleted = (): SyncPullResponse['deleted'] => ({ lists: [], items: [], tags: [], media: [] })

/** all rows of the user (incl. trash & templates) */
export async function $getSyncSnapshot(userId: string): Promise<SyncPullResponse> {
    // read the cursor first, anything written while we read the rows will be pulled again next time
    const cursor = await $getSyncCursor(userId)

    const [lists, items, tags, media] = await Promise.all([
        db.select().from(listsTable).where(eq(listsTable.userId, userId)),
        db.select().from(itemsTable).where(eq(itemsTable.userId, userId)),
        db.select().from(listsTagsTable).where(eq(listsTagsTable.userId, userId)),
        db.select().from(itemsMedia).where(eq(itemsMedia.userId, userId)),
    ])

    return {
        cursor,
        hasMore: false,
        serverTime: Date.now(),
        changes: { lists, items, tags, media },
        deleted: emptyDeleted(),
    }
}

/** rows changed after `since`, rows that no longer exist are returned in `deleted` */
export async function $getSyncChanges(userId: string, since: number, limit: number): Promise<SyncPullResponse> {
    const changed = await $getChangedEntities(userId, since, limit + 1)
    const hasMore = changed.length > limit
    const page = hasMore ? changed.slice(0, limit) : changed

    const cursor = page.length ? page[page.length - 1].seq : since

    const idsByEntity: Record<SyncEntity, string[]> = { lists: [], items: [], tags: [], media: [] }
    page.forEach(change => idsByEntity[change.entity]?.push(change.entityId))

    const changes: SyncRows = { lists: [], items: [], tags: [], media: [] }
    const deleted = emptyDeleted()

    for (const entity of SYNC_ENTITIES) {
        const ids = idsByEntity[entity]
        const rows = await getRowsByIds(userId, entity, ids)
        const found = new Set(rows.map(row => row.id));

        (changes[entity] as typeof rows).push(...rows)
        deleted[entity] = ids.filter(id => !found.has(id))
    }

    return { cursor, hasMore, serverTime: Date.now(), changes, deleted }
}

async function getRowsByIds(userId: string, entity: SyncEntity, ids: string[]) {
    const table = SYNC_TABLES[entity]
    const rows = [] as { id: string }[]

    for (let i = 0; i < ids.length; i += MAX_IDS_PER_QUERY) {
        const chunk = ids.slice(i, i + MAX_IDS_PER_QUERY)
        const result = await db
            .select()
            .from(table as typeof listsTable)
            .where(and(
                eq(table.userId, userId),
                inArray(table.id, chunk),
            ))
        rows.push(...result)
    }

    return rows
}
