import { $getItem } from '@/server/db/queries/items';
import { $createItemMedia, $getItemMedia } from '@/server/db/queries/media';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import $getDir from '@/server/utils/file/getDir';
import { $ITEM_MEDIA_FORM_SCHEMA } from '@/server/utils/lib/form/fromSchema';
import $parseFormData, { ProcessedFormData } from '@/server/utils/lib/form/parseFormData';
import { $generateLongID } from '@/server/utils/lib/generateID';
import { validateShortID } from '@/utils/lib/generateID';
import { ItemData } from '@/utils/types/item';
import { MediaData } from '@/utils/types/media';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

const MAX_FILE_SIZE = 1024 * 1024 * 20 // 50MB

/** api/items/[id]/media
 * Get: gets all media of an item
 * Post: add media to an item
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user)
            return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED });

        const { id } = req.query;
        if (!validateShortID(id)) return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });

        const itemsDb = await $getItem(user.id, id as ItemData['id']);
        if (itemsDb.length === 0)
            return res.status(404).json({ errorCode: ApiErrorCode.NOT_FOUND });
        const item = itemsDb[0]

        if (req.method === 'GET') {
            const media = await $getItemMedia(user.id, item.id)
            return res.status(200).json(media);
        }

        if (req.method === 'POST') {
            const { item: itemDir } = await $getDir(user.id, item.listId!, item.id);

            const bbConfig = {
                headers: req.headers,
                limits: { fields: 3, files: 1, fileSize: MAX_FILE_SIZE }
            }

            const form = $parseFormData<MediaData & ProcessedFormData>(
                $ITEM_MEDIA_FORM_SCHEMA(itemDir as string),
                bbConfig,
                async (data) => {
                    const id = $generateLongID();

                    if (!data.path)
                        return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });

                    const [media] = await $createItemMedia({
                        id,
                        userId: user.id,
                        itemId: item.id,
                        title: data.title,
                        keywords: Array.isArray(data.keywords) ? data.keywords : [],
                        type: 'image',
                        path: data.path,
                        updatedAt: new Date(Date.now()),
                        createdAt: new Date(Date.now())
                    })
                    res.status(200).json(media);
                    console.log('[Create] api/items/[id]/media:', media.id + ' ' + media.title);
                });

            form.on('error', () =>
                res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR })
            )
            return req.pipe(form)
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