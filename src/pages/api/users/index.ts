import { db } from '@/server/db';
import { usersTable } from '@/server/db/schema';
import { $hashPassword, $verifyPassword } from '@/server/utils/auth/auth';
import { $setSessionTokenCookie, $validateAuthCookies, $wantsTokenInBody } from '@/server/utils/auth/cookies';
import { $createSession, $generateSessionToken } from '@/server/utils/auth/session';
import { $generateShortID } from '@/server/utils/lib/generateID';
import parseJSONReq from '@/utils/functions/parseJSONReq';
import { validatePassword, validateUsername } from '@/utils/lib/validate';
import { ApiErrorCode, ServerResponse, UserErrorCode } from '@/utils/types/serverResponse';
import { eq } from 'drizzle-orm';
import { mkdir } from 'fs/promises';
import type { NextApiRequest, NextApiResponse } from 'next';
import { join } from 'path';

let adminUserExistsCache: Boolean; // cache

/** api/users
 * Get: Returns the Authenticated User's Data
 * Post: User Register
 * Patch: Edit User's Data
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method === 'GET') {
            const { user } = await $validateAuthCookies(req, res);
            if (!user)
                return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED } as ServerResponse);

            const userRes = { ...user, passwordHash: undefined }
            return res.status(200).json(userRes);
        }

        if (req.method === 'POST') {
            if (process.env.DISABLE_SIGNUP === 'true') {
                return res.status(403).json({
                    errorCode: ApiErrorCode.SIGNUP_DISABLED,
                    message: 'User registration is currently disabled.'
                } as ServerResponse)
            }

            const body = await req.body;
            const { username: reqUser, password } = parseJSONReq(body)
            const username = reqUser?.toLowerCase()

            if (!username || !password)
                return res.status(400).json({ errorCode: ApiErrorCode.BAD_REQUEST } as ServerResponse)

            if (!validateUsername(username))
                return res.status(400).json({
                    cause: { username: "Invalid Username" },
                    errorCode: UserErrorCode.INVALID_USERNAME
                } as ServerResponse)

            if (!validatePassword(password))
                return res.status(400).json({
                    cause: { password: "Invalid Password" },
                    errorCode: UserErrorCode.INVALID_PASSWORD
                } as ServerResponse)

            const userExists = await db.select().from(usersTable).where(eq(usersTable.username, username))

            if (userExists[0]) return res.status(400).json({
                cause: { username: 'User Already Exists' },
                errorCode: UserErrorCode.USERNAME_EXISTS
            } as ServerResponse)

            const passwordHash = await $hashPassword(password)

            const userID = $generateShortID()
            const createdAt = new Date(Date.now())

            const adminUserExists = await checkForAdminUserExists();
            const role = adminUserExists ? 'user' : 'admin';

            const [user] = await db
                .insert(usersTable)
                .values({
                    id: userID,
                    username,
                    role,
                    passwordHash,
                    createdAt,
                    updatedAt: createdAt
                })
                .returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role })

            const userDir = join('public', 'users', userID)
            await mkdir(userDir, { recursive: true }) // create media directory

            const token = $generateSessionToken();
            const session = await $createSession(token, user.id, req.headers['user-agent']);

            $setSessionTokenCookie(res, token, session.expiresAt)
            return res.status(201).json($wantsTokenInBody(req) ? { ...user, token } : user)
        }

        if (req.method === 'PATCH') {
            const { user } = await $validateAuthCookies(req, res);
            if (!user) return res.status(401).json({});
            const body = await req.body;
            const { newUsername: reqNewUser, newPassword, oldPassword } = parseJSONReq(body)

            let dbHashNewPassword;
            let dbNewUsernameReq;

            if (!oldPassword) return res.status(400).json({
                cause: { oldPassword: "Required" },
                errorCode: UserErrorCode.INVALID_PASSWORD
            } as ServerResponse)

            const validOldPassword = await $verifyPassword(oldPassword, user.passwordHash);
            if (!validOldPassword) return res.status(400).json({
                cause: { oldPassword: "Invalid Old Password" },
                errorCode: UserErrorCode.INVALID_PASSWORD
            } as ServerResponse)

            if (newPassword) {
                if (!validatePassword(newPassword))
                    return res.status(400).json({
                        cause: { newPassword: "Invalid New Password" },
                        errorCode: UserErrorCode.INVALID_PASSWORD
                    } as ServerResponse)

                dbHashNewPassword = await $hashPassword(newPassword)
            }

            if (reqNewUser) {
                const newUsername = reqNewUser.toLowerCase()

                if (!validateUsername(newUsername))
                    return res.status(400).json({
                        cause: { username: "Invalid Username" },
                        errorCode: UserErrorCode.INVALID_USERNAME
                    } as ServerResponse)

                const userExists = await db.select().from(usersTable).where(eq(usersTable.username, newUsername))
                if (userExists.length !== 0) return res.status(400).json({
                    cause: { username: 'User Already Exists' },
                    errorCode: UserErrorCode.USERNAME_EXISTS
                } as ServerResponse)

                dbNewUsernameReq = newUsername
            }
            const [updatedUser] = await db
                .update(usersTable)
                .set({
                    username: dbNewUsernameReq,
                    passwordHash: dbHashNewPassword,
                    updatedAt: new Date(Date.now())
                })
                .where(eq(usersTable.id, user.id))
                .limit(1)
                .returning()

            return res.status(200).json({ ...updatedUser, passwordHash: undefined })
        }

        res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED } as ServerResponse);

    } catch (error) {
        console.error("[Error] api/users: ", error);
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR } as ServerResponse);
    }
}

async function checkForAdminUserExists() {
    if (adminUserExistsCache) return true;

    const exists = await db.select().from(usersTable).where(eq(usersTable.role, 'admin')).limit(1);
    const result = exists.length > 0;
    adminUserExistsCache = result
    return result;
}