import { $getItem, $updateItems, $deleteItems } from '@/server/db/queries/items';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import { validateShortID } from '@/utils/lib/generateID';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user) return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED });

        const { id } = req.query;
        if (!validateShortID(id)) return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });

        const templates = await $getItem(user.id, id as string);
        if (templates.length === 0 || !templates[0].isTemplate)
            return res.status(404).json({ errorCode: ApiErrorCode.NOT_FOUND });
        const template = templates[0];

        if (req.method === 'GET') {
            return res.status(200).json(template);
        }

        if (req.method === 'PUT') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const updateData: any = { updatedAt: new Date() };
            if (body.title !== undefined) updateData.title = body.title;
            if (body.description !== undefined) updateData.description = body.description;
            if (body.layout !== undefined) updateData.layout = body.layout;
            if (body.header !== undefined) updateData.header = body.header;
            if (body.extractor !== undefined) updateData.extractor = body.extractor;

            const [updated] = await $updateItems(user.id, template.id, updateData);
            return res.status(200).json(updated);
        }

        if (req.method === 'DELETE') {
            const deleted = await $deleteItems(user.id, [template.id]);
            return res.status(200).json(deleted[0]);
        }

        res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED });
    } catch (error) {
        console.log("[Error] api/templates/[id]: ", error);
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR });
    }
}
