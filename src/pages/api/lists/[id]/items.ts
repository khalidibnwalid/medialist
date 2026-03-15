import { $createItems, $getItems } from '@/server/db/queries/items';
import { $getList } from '@/server/db/queries/lists';
import { $createItemMedia } from '@/server/db/queries/media';
import { $createTags, $getTags } from '@/server/db/queries/tags';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import $parseItemForm from '@/server/utils/lib/form/parseItemForm';
import { $generateShortID } from '@/server/utils/lib/generateID';
import { validateShortID } from '@/utils/lib/generateID';
import { TagData } from '@/utils/types/global';
import { ItemSaveResponse } from '@/utils/types/item';
import { ListData } from '@/utils/types/list';
import { MediaData } from '@/utils/types/media';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

/** api/lists/[id]/items
 * Get: Get all items of a list
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
            const items = await $getItems(user.id, list.id)
            return res.status(200).json(items);
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

export const config = {
    api: {
        bodyParser: false,
    },
};