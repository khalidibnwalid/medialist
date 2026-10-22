import { $countItems, $createItems, $getItems, $getItemsPage } from '@/server/db/queries/items';
import { $getList } from '@/server/db/queries/lists';
import { $createItemMedia } from '@/server/db/queries/media';
import { $createTags, $getTags } from '@/server/db/queries/tags';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import $parseItemForm from '@/server/utils/lib/form/parseItemForm';
import { $generateShortID } from '@/server/utils/lib/generateID';
import { validateShortID } from '@/utils/lib/generateID';
import { hasItemsFilters, ItemsFilters, ItemsPage, ITEMS_PAGE_SIZE } from '@/utils/lib/itemsPagination';
import { TagData } from '@/utils/types/global';
import { ItemSaveResponse } from '@/utils/types/item';
import { ListData } from '@/utils/types/list';
import { MediaData } from '@/utils/types/media';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

/** api/lists/[id]/items
 * Get: Get all items of a list (title ordered)
 *  - filters: `q` (title search), `tags` (comma separated tag ids, item must have all), `fav=true`
 *  - pagination: pass `limit` (1-100) and/or `cursor` to get `ItemsPage` ({ items, nextCursor, total }),
 *    without them a plain array of all the matching items is returned (backward compatible)
 * Post: creates an item in the list
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user) return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED })

        const { id: listId } = req.query as { id: ListData['id'] };
        if (!validateShortID(listId)) return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });

        const listsDb = await $getList(user.id, listId);
        if (listsDb.length === 0) return res.status(404).json({ errorCode: ApiErrorCode.NOT_FOUND });
        const list = listsDb[0];

        if (req.method === 'GET') {
            const query = parseGetQuery(req.query)
            if (!query) return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });
            const { limit, after, filters, paginated } = query

            // backward compatibility: without `limit` / `cursor` all the (filtered) items are returned as a plain array
            if (!paginated) {
                const items = hasItemsFilters(filters)
                    ? await $getItemsPage(user.id, list.id, { filters })
                    : await $getItems(user.id, list.id)
                return res.status(200).json(items);
            }

            const [rows, total] = await Promise.all([
                $getItemsPage(user.id, list.id, { limit, after, filters }),
                $countItems(user.id, list.id, filters),
            ])
            const items = rows.slice(0, limit)
            const last = items[items.length - 1]
            const nextCursor = rows.length > limit && last ? encodeCursor(last) : null

            return res.status(200).json({ items, nextCursor, total } as ItemsPage);
        }

        if (req.method === 'POST') {
            const itemId = $generateShortID()
            const tags = await $getTags(user.id, list.id)

            const form = await $parseItemForm(user.id, list.id, itemId, req,
                async (data, _, __, mapLayouts, newMedia, newTags) => {
                    if (!data.title)
                        return res.status(400).json({
                            message: 'Title is required',
                            errorCode: ApiErrorCode.BAD_REQUEST
                        });

                    data.id = itemId
                    data.listId = list.id
                    data.userId = user.id

                    let newTagsData: TagData[] = []
                    // new tags
                    if (data?.tags && data.tags.length > 0) {
                        newTagsData = newTags(tags);
                        if (newTagsData.length > 0)
                            await $createTags(newTagsData);
                    }

                    data.createdAt = new Date(Date.now())
                    data.updatedAt = new Date(Date.now())

                    let newMediaData: MediaData[] = []
                    if (data.media && data.media.length > 0) {
                        // we init it here, since we need mediaIDs for some fields
                        newMediaData = newMedia()
                        data.media = newMediaData
                    }

                    data.layout = mapLayouts()

                    const [item] = await $createItems(data)

                    // should be created after the item, since it uses the item id as a foreign key
                    if (data.media && data.media.length > 0)
                        newMediaData = await $createItemMedia(newMediaData) as MediaData[]

                    res.status(201).json({
                        item: item,
                        // for cache update on the client:
                        newTags: newTagsData,
                        newMedia: newMediaData,
                    } as ItemSaveResponse);

                    console.log('[Created] api/lists/[id]/items:', item.id + ' ' + item.title);
                }
            )

            form.on('error', () =>
                res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR })
            )

            return req.pipe(form)
        }

        res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED })
    } catch (error) {
        console.log("[Error] api/lists/[id]/items: ", error)
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR })
    }
}

const MAX_TAGS_FILTER = 50

/** cursor = base64url of the JSON [title, id] of the last item of the previous page */
const encodeCursor = (item: { title: string, id: string }) =>
    Buffer.from(JSON.stringify([item.title, item.id])).toString('base64url')

function decodeCursor(cursor: string) {
    try {
        const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
        if (!Array.isArray(value) || value.length !== 2) return null
        const [title, id] = value
        if (typeof title !== 'string' || typeof id !== 'string' || !validateShortID(id)) return null
        return { title, id }
    } catch {
        return null
    }
}

/** GET params: `limit` (1-100, default 100), `cursor`, `q`, `tags` (comma separated ids), `fav=true`
 * @returns null if any param is invalid */
function parseGetQuery(query: NextApiRequest['query']) {
    const single = (key: string) => {
        const value = query[key]
        return Array.isArray(value) ? value[value.length - 1] : value
    }
    const limitParam = single('limit')
    const cursorParam = single('cursor')
    const q = single('q')?.trim()
    const tagsParam = single('tags')
    const favParam = single('fav')

    let limit = ITEMS_PAGE_SIZE
    if (limitParam !== undefined && limitParam !== '') {
        if (!/^\d+$/.test(limitParam)) return null
        limit = Math.min(Number(limitParam), ITEMS_PAGE_SIZE)
        if (limit < 1) return null
    }

    let after: ReturnType<typeof decodeCursor> = null
    if (cursorParam) {
        after = decodeCursor(cursorParam)
        if (!after) return null
    }

    const tags = tagsParam ? tagsParam.split(',').map(tag => tag.trim()).filter(Boolean) : []
    if (tags.length > MAX_TAGS_FILTER || tags.some(tag => tag.length > 100)) return null
    if (q && q.length > 500) return null
    if (favParam !== undefined && favParam !== 'true' && favParam !== 'false') return null

    const filters: ItemsFilters = {
        q: q || undefined,
        tags: tags.length ? [...new Set(tags)] : undefined,
        fav: favParam === 'true' || undefined,
    }

    return {
        limit,
        after,
        filters,
        paginated: limitParam !== undefined || cursorParam !== undefined,
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
};