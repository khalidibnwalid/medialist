import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user) return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED });

        if (req.method !== 'POST') {
            return res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED });
        }

        const { url, method, body, headers } = req.body;

        if (!url) {
            return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST, message: 'URL is required' });
        }

        console.log(`[Proxy] User [${user.id}] Fetching ${method || 'GET'} ${url}`);

        const response = await fetch(url, {
            method: method || 'GET',
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                ...headers,
                'Content-Type': 'application/json',
                'User-Agent': 'MediaList/0.1.0'
            },
        });

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            return res.status(response.status).json({
                errorCode: ApiErrorCode.EXTERNAL_API_ERROR,
                message: `External API returned ${response.status}`,
                details: data
            });
        }

        return res.status(200).json(data);
    } catch (error: any) {
        console.error("[Error] api/proxy-extract: ", error);
        res.status(500).json({
            errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR,
            message: error.message || 'Failed to proxy request'
        });
    }
}
