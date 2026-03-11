import { $createItems, $getItems } from '@/server/db/queries/items';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import { $generateShortID } from '@/server/utils/lib/generateID';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user) return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED });

        if (req.method === 'GET') {
            const templates = await $getItems(user.id, null, false, true);
            return res.status(200).json(templates);
        }

        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            if (!body.title) {
                return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST, message: 'Title is required' });
            }

            const templateId = $generateShortID();
            const newTemplate = {
                id: templateId,
                userId: user.id,
                title: body.title,
                description: body.description || null,
                layout: body.layout || [],
                header: body.header || {},
                isTemplate: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const [created] = await $createItems(newTemplate as any);
            return res.status(201).json(created);
        }

        res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED });
    } catch (error) {
        console.log("[Error] api/templates: ", error);
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR });
    }
}
