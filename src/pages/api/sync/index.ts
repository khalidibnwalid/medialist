import { $getSyncCursor } from '@/server/db/queries/sync';
import { $getSyncChanges, $getSyncSnapshot } from '@/server/sync/pull';
import { $processSyncOps } from '@/server/sync/push';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import parseJSONReq from '@/utils/functions/parseJSONReq';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import type { NextApiRequest, NextApiResponse } from 'next';

const DEFAULT_PULL_LIMIT = 500;
const MAX_PULL_LIMIT = 5000;
const MAX_PUSH_OPS = 1000;

/** api/sync
 * Get: pull changes since a cursor (query: since, limit), since=0 or missing => full snapshot
 * Post: push offline changes (body: { ops: SyncOp[] }), each op is processed independently
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user) return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED });

        if (req.method === 'GET') {
            const since = parseNonNegativeInt(req.query.since, 0)
            const limit = parseNonNegativeInt(req.query.limit, DEFAULT_PULL_LIMIT)
            if (since === null || !limit || limit > MAX_PULL_LIMIT)
                return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });

            const response = since === 0
                ? await $getSyncSnapshot(user.id)
                : await $getSyncChanges(user.id, since, limit)

            return res.status(200).json(response);
        }

        if (req.method === 'POST') {
            let body;
            try {
                body = parseJSONReq(await req.body);
            } catch {
                return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });
            }

            const ops = body?.ops
            if (!Array.isArray(ops) || ops.length > MAX_PUSH_OPS)
                return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST });

            const results = await $processSyncOps(user.id, ops)
            const cursor = await $getSyncCursor(user.id)

            return res.status(200).json({ results, cursor });
        }

        res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED });
    } catch (error) {
        console.log("[Error] api/sync: ", error)
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR });
    }
}

/** null if invalid */
function parseNonNegativeInt(value: unknown, fallback: number) {
    if (value === undefined || value === '') return fallback
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
    const number = Number(value)
    return Number.isSafeInteger(number) ? number : null
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '20mb',
        },
    },
}
