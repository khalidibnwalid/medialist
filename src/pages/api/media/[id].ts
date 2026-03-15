import { $getItem } from '@/server/db/queries/items';
import { $deleteItemMedia, $getItemMediaById, $updateItemMedia } from '@/server/db/queries/media';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import $deleteFile from '@/server/utils/file/deleteFile';
import $getDir from '@/server/utils/file/getDir';
import parseJSONReq from '@/utils/functions/parseJSONReq';
import { THUMBNAILS_OPTIONS } from '@/utils/lib/fileHandling/thumbnailOptions';
import { validateLongID } from '@/utils/lib/generateID';
import { ItemData } from '@/utils/types/item';
import { MediaData } from '@/utils/types/media';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

/** api/media/[id]
 * Get:  gets a media item by id
 * Patch:  updates a media item by id
 * Delete: deletes a media item
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user)
            return res.status(401).json({ message: 'Unauthorized' });

        const { id } = req.query;
        if (!validateLongID(id))
            return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST })

        const mediaDb = await $getItemMediaById(user.id, id as ItemData['id']);
        if (mediaDb.length === 0)
            return res.status(404).json({ errorCode: ApiErrorCode.NOT_FOUND });
        const media = mediaDb[0]

        if (req.method === 'GET')
            return res.status(200).json(media);

        if (req.method === 'PATCH') {
            const body = parseJSONReq(await req.body) as Partial<MediaData>
            const data: Partial<MediaData> = {
                title: body.title, // for now only title can be updated,
                keywords: Array.isArray(body.keywords) ? body.keywords : [],
                updatedAt: new Date(),
            }

            const [updatedMedia] = await $updateItemMedia(user.id, media.id, data)
            return res.status(200).json(updatedMedia);
        }

        if (req.method === 'DELETE') {
            const [item] = await $getItem(user.id, media.itemId!)
            const { item: itemDir } = await $getDir(user.id, item.listId!, item.id)
            $deleteFile(THUMBNAILS_OPTIONS.ITEM_MEDIA, itemDir as string, media.path)
            const [deleteMedia] = await $deleteItemMedia(user.id, media.id)
            return res.status(200).json(deleteMedia);
        }

        res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED });
    } catch (error) {
        console.log("[Error] api/media/[id]: ", error)
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR });
    }
}