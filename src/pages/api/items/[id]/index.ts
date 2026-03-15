import { $getItem, $updateItems } from '@/server/db/queries/items';
import { $createItemMedia } from '@/server/db/queries/media';
import { $createTags, $getTags } from '@/server/db/queries/tags';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import $deleteFile from '@/server/utils/file/deleteFile';
import $parseItemForm from '@/server/utils/lib/form/parseItemForm';
import { THUMBNAILS_OPTIONS } from '@/utils/lib/fileHandling/thumbnailOptions';
import { validateShortID } from '@/utils/lib/generateID';
import { TagData } from '@/utils/types/global';
import { ItemData, ItemLayoutTab, ItemSaveResponse, LogoField } from '@/utils/types/item';
import { MediaData } from '@/utils/types/media';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

/** api/items/[id]
 * Get:  gets an item by id
 * Patch:  updates an item by id
 * Delete: moves an item to the trash
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user) return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED });

        const { id } = req.query;
        if (!validateShortID(id)) return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });

        const items = await $getItem(user.id, id as ItemData['id']);
        if (items.length === 0)
            return res.status(404).json({ errorCode: ApiErrorCode.NOT_FOUND });
        const item = items[0]

        if (req.method === 'GET')
            return res.status(200).json(item);

        if (req.method === 'PATCH') {
            const tags = await $getTags(user.id, item.listId!)

            const form = await $parseItemForm(user.id, item.listId!, item.id, req,
                async (data, _, dir, mapLayouts, newMedia, newTags) => {
                    let newTagsData: TagData[] = []
                    // new tags
                    if (data?.tags && data.tags.length > 0) {
                        const tagsToCreate = newTags(tags);
                        if (tagsToCreate.length > 0)
                            newTagsData = await $createTags(tagsToCreate as any) as TagData[];
                    }

                    if (data.coverPath !== undefined && item.coverPath && item.coverPath !== data.coverPath)
                        $deleteFile(THUMBNAILS_OPTIONS.ITEM_COVER, dir.item, item.coverPath);

                    if (data.posterPath !== undefined && item.posterPath && item.posterPath !== data.posterPath)
                        $deleteFile(THUMBNAILS_OPTIONS.ITEM_POSTER, dir.item, item.posterPath);

                    // unlike in createItem, we can create items directly here, since item's id exists, and won't cause a foreign key error
                    let newMediaData: MediaData[] = []
                    if (data?.media && Array.isArray(data.media) && data.media.length > 0) {
                        const toAdd = newMedia()
                        data.media = toAdd
                        newMediaData = await $createItemMedia(toAdd) as MediaData[]
                    }

                    if (data.layout !== undefined) {
                        data.layout = mapLayouts()

                        const oldLogoPaths = extractLogoPaths(item.layout as ItemLayoutTab[])
                        const newLogoPaths = new Set(extractLogoPaths(data.layout))
                        const deletedLogos = oldLogoPaths.filter(logoPath => !newLogoPaths.has(logoPath))
                        deletedLogos.forEach(logoPath => logoPath &&
                            $deleteFile(THUMBNAILS_OPTIONS.LOGO, dir.item, logoPath)
                        )
                    }

                    data.updatedAt = new Date(Date.now())
                    const [updateItem] = await $updateItems(user.id, item.id, data)

                    res.status(200).json({
                        item: updateItem,
                        // for cache update on the client:
                        newTags: newTagsData,
                        newMedia: newMediaData,
                    } as ItemSaveResponse);

                    console.log('[Edited] api/items/[id]:', updateItem.id + ' ' + updateItem.title);
                }
            )

            form.on('error', () =>
                res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR })
            )

            return req.pipe(form)
        }

        // move to trash
        if (req.method === 'DELETE') {
            const data = {
                trash: true,
                updatedAt: new Date(Date.now())
            }

            const updatedItem = await $updateItems(user.id, item.id, data)
            return res.status(200).json(updatedItem[0]);
        }

        res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED });
    } catch (error) {
        console.log("[Error] api/items/[id]: ", error)
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR });
    }

}

export const config = {
    api: {
        bodyParser: false,
    },
}

function extractLogoPaths(layout: ItemLayoutTab[]) {
    return layout.flat(Infinity).map(f => (f as LogoField)?.logoPath)
}