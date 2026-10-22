import { db } from '@/server/db';
import { sessionsTable, usersTable } from '@/server/db/schema';
import { $verifyPassword } from '@/server/utils/auth/auth';
import { $setSessionTokenCookie, $validateAuthCookies, $wantsTokenInBody } from '@/server/utils/auth/cookies';
import { $createSession, $generateSessionToken, $invalidateSession } from '@/server/utils/auth/session';
import parseJSONReq from '@/utils/functions/parseJSONReq';
import { validatePassword, validateUsername } from '@/utils/lib/validate';
import { ApiCode, ApiErrorCode, ServerResponse, UserErrorCode } from '@/utils/types/serverResponse';
import { eq, sql } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

/** api/sessions
 * Get: Returns All Sessions Data of the User
 * Post: Create a Session - Login
 * Delete: Destroy a Session - Logout
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const { user } = await $validateAuthCookies(req, res);
      if (!user)
        return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED } as ServerResponse);

      const sessions = await db
        .select({
          id: sql`substr(${sessionsTable.id}, 1,10)`, // false ID
          agent: sessionsTable.agent,
          expiresAt: sessionsTable.expiresAt,
          createdAt: sessionsTable.createdAt
        })
        .from(sessionsTable)
        .where(eq(sessionsTable.userId, user.id));

      return res.status(200).json(sessions);
    }

    if (req.method === 'POST') {
      const body = parseJSONReq(await req.body);

      const { username, password } = body as { username: string, password: string };
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

      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, username?.toLowerCase()));

      if (!users[0]) return res.status(400).json({
        message: 'Invalid Username Or Password',
        errorCode: UserErrorCode.INVALID_LOGIN
      } as ServerResponse)
      const { passwordHash, ...user } = users[0];

      const validPassword = await $verifyPassword(password, passwordHash);
      if (!validPassword) return res.status(400).json({
        message: 'Invalid Username Or Password',
        errorCode: UserErrorCode.INVALID_LOGIN
      } as ServerResponse)

      const token = $generateSessionToken();
      const session = await $createSession(token, user.id, req.headers['user-agent']);

      $setSessionTokenCookie(res, token, session.expiresAt);
      return res.status(200).json($wantsTokenInBody(req) ? { ...user, token } : user);
    }

    if (req.method === 'DELETE') {
      const { session } = await $validateAuthCookies(req, res);
      if (!session)
        return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED } as ServerResponse);

      await $invalidateSession(session.id);
      return res.status(200).json({
        message: 'Logged Out',
        code: ApiCode.DESTROYED
      } as ServerResponse);
    }

    res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED } as ServerResponse);

  } catch (error) {
    console.error("[Error] api/sessions: ", error);
    res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR } as ServerResponse);
  }
}