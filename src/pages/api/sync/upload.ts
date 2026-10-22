import { db } from '@/server/db';
import { itemsTable, listsTable } from '@/server/db/schema';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import $deleteFile from '@/server/utils/file/deleteFile';
import $getDir from '@/server/utils/file/getDir';
import $handleFileUpload from '@/server/utils/file/handleFileUpload';
import { ThumbnailOptions, THUMBNAILS_OPTIONS } from '@/utils/lib/fileHandling/thumbnailOptions';
import { validateShortID } from '@/utils/lib/generateID';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import busboy from 'busboy';
import { eq } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';
import internal from 'stream';

const MAX_FILE_SIZE = 1024 * 1024 * 100; // 100MB

const KINDS: Record<string, { thumbnails: ThumbnailOptions[], inItemDir: boolean }> = {
    listCover: { thumbnails: THUMBNAILS_OPTIONS.LIST_COVER, inItemDir: false },
    itemPoster: { thumbnails: THUMBNAILS_OPTIONS.ITEM_POSTER, inItemDir: true },
    itemCover: { thumbnails: THUMBNAILS_OPTIONS.ITEM_COVER, inItemDir: true },
    logo: { thumbnails: THUMBNAILS_OPTIONS.LOGO, inItemDir: true },
    media: { thumbnails: THUMBNAILS_OPTIONS.ITEM_MEDIA, inItemDir: true },
}

class UploadError extends Error {
    constructor(public status: number, public errorCode: ApiErrorCode) { super(errorCode) }
}

/** api/sync/upload
 * Post: uploads a file (multipart) without touching the db, returns { path } to be used in a sync op
 * fields (must come BEFORE the file part): kind, listId, itemId (all kinds except listCover); file part: file
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user) return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED });

        if (req.method !== 'POST')
            return res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED });

        const fields: Record<string, string> = {}
        let upload: Promise<string> | null = null
        let truncated = false

        let bb: busboy.Busboy
        try {
            bb = busboy({
                headers: req.headers,
                limits: { fields: 5, files: 1, fileSize: MAX_FILE_SIZE }
            })
        } catch {
            // not a multipart request
            return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });
        }

        bb.on('field', (name, value) => fields[name] = value)

        bb.on('file', (name, stream, info) => {
            if (name !== 'file' || upload) return stream.resume()
            stream.on('limit', () => truncated = true)

            upload = saveFile(user.id, fields, stream, info)
            // the stream must be drained, otherwise busboy never finishes
            upload.catch(() => stream.resume())
        })

        bb.on('finish', async () => {
            try {
                if (!upload) throw new UploadError(400, ApiErrorCode.BAD_REQUEST)
                const path = await upload

                if (truncated) {
                    const dir = await resolveDir(user.id, fields)
                    await $deleteFile(KINDS[fields.kind].thumbnails, dir, path)
                    throw new UploadError(413, ApiErrorCode.BAD_REQUEST)
                }

                res.status(201).json({ path });
            } catch (error) {
                if (error instanceof UploadError)
                    return res.status(error.status).json({ errorCode: error.errorCode });
                console.log("[Error] api/sync/upload: ", error)
                res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR });
            }
        })

        // malformed multipart body
        bb.on('error', (error) => {
            console.log("[Error] api/sync/upload: ", error)
            if (!res.headersSent) res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST })
        })

        return req.pipe(bb)
    } catch (error) {
        console.log("[Error] api/sync/upload: ", error)
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR });
    }
}

async function saveFile(
    userId: string,
    fields: Record<string, string>,
    stream: internal.Readable,
    info: busboy.FileInfo
) {
    const dir = await resolveDir(userId, fields, true)

    const [fileName, promises] = $handleFileUpload(stream, dir, {
        thumbnails: KINDS[fields.kind].thumbnails,
        mimeType: info.mimeType,
        fileName: info.filename,
    })
    await Promise.all(promises)

    return fileName
}

/** validates the fields & ownership, returns the directory the file belongs to */
async function resolveDir(userId: string, fields: Record<string, string>, makeDir: boolean = false) {
    const { kind, listId, itemId } = fields
    const kindConfig = KINDS[kind]

    if (!kindConfig || !Object.prototype.hasOwnProperty.call(KINDS, kind) || !validateShortID(listId))
        throw new UploadError(400, ApiErrorCode.BAD_REQUEST)
    if (kindConfig.inItemDir && !validateShortID(itemId))
        throw new UploadError(400, ApiErrorCode.BAD_REQUEST)

    // the list/item may not exist yet (created offline, its create op is pushed after its files are uploaded),
    // paths are under the user's folder, so only rows of other users (or an item of another list) are rejected
    const [list] = await db
        .select({ userId: listsTable.userId })
        .from(listsTable)
        .where(eq(listsTable.id, listId))
        .limit(1)
    if (list && list.userId !== userId) throw new UploadError(404, ApiErrorCode.NOT_FOUND)

    if (!kindConfig.inItemDir) {
        const dir = await $getDir(userId, listId, makeDir)
        return dir.list
    }

    const [item] = await db
        .select({ userId: itemsTable.userId, listId: itemsTable.listId })
        .from(itemsTable)
        .where(eq(itemsTable.id, itemId))
        .limit(1)
    if (item && (item.userId !== userId || item.listId !== listId))
        throw new UploadError(404, ApiErrorCode.NOT_FOUND)

    const dir = await $getDir(userId, listId, itemId, makeDir)
    return dir.item as string
}

export const config = {
    api: {
        bodyParser: false,
    },
}
