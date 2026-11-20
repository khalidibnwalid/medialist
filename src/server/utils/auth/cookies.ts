import { NextApiRequest, NextApiResponse } from "next";
import { $validateSessionToken, ServerSessionValidationResult } from "./session";

const IS_PROD = process.env.NODE_ENV === "production"; // HTTPS
const SESSION_LOCAL_STORAGE_KEY = "session";

export function $setSessionTokenCookie(res: NextApiResponse, token: string, expiresAt: Date) {
    res.appendHeader(
        "Set-Cookie",
        `${SESSION_LOCAL_STORAGE_KEY}=${token}; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}; Path=/${IS_PROD ? '; Secure;' : ''}`
    )
}

export function $deleteSessionTokenCookie(res: NextApiResponse) {
    res.appendHeader(
        "Set-Cookie",
        `${SESSION_LOCAL_STORAGE_KEY}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/${IS_PROD ? '; Secure;' : ''}`
    )
}

/** Native/mobile clients can't rely on cookies, they send `Authorization: Bearer <token>` instead */
function getBearerToken(req: NextApiRequest) {
    const header = req.headers.authorization
    if (!header?.startsWith("Bearer ")) return null
    return header.slice("Bearer ".length).trim() || null
}

/** clients that want the session token in the response body (mobile app) send this header on login/signup */
export const $wantsTokenInBody = (req: NextApiRequest) => req.headers["x-auth-mode"] === "token"

/** this will modify cookies (cookie-based sessions only) */
export async function $validateAuthCookies(req: NextApiRequest, res: NextApiResponse): Promise<ServerSessionValidationResult> {
    try {
        const bearerToken = getBearerToken(req)
        const token = bearerToken || req.cookies[SESSION_LOCAL_STORAGE_KEY]
        if (!token) return { user: null, session: null }

        const result = await $validateSessionToken(token)

        if (bearerToken) return result

        if (result.session) {
            $setSessionTokenCookie(res, token, result.session.expiresAt)
        } else {
            $deleteSessionTokenCookie(res)
        }

        return result
    } catch (error) {
        console.error("[Error] validateAuthCookies(): ", error)
        return { user: null, session: null }
    }
}