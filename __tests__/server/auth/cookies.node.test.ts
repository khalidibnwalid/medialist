import { $validateAuthCookies, $wantsTokenInBody } from '@/server/utils/auth/cookies';
import $mockUser from '@tests/test-utils/mocks/data/mockUser';
import { NextApiRequest, NextApiResponse } from 'next';
import httpMocks from 'node-mocks-http';
import { vol } from 'memfs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('@/server/db');

beforeEach(() => vol.reset())

const mock = (options: httpMocks.RequestOptions = {}) => ({
    req: httpMocks.createRequest<NextApiRequest>({ method: 'GET', ...options }),
    res: httpMocks.createResponse<NextApiResponse>(),
})

describe('$validateAuthCookies', () => {
    test('accepts a valid Bearer token and returns the user', async () => {
        const user = await $mockUser()
        const { token } = await user.createCookie()
        const { req, res } = mock({ headers: { authorization: `Bearer ${token}` } })

        const result = await $validateAuthCookies(req, res)

        expect(result.user?.id).toBe(user.userData.id)
        expect(result.session).not.toBeNull()
        await user.delete()
    })

    test('returns null for an invalid Bearer token', async () => {
        const { req, res } = mock({ headers: { authorization: 'Bearer not-a-real-token' } })
        const result = await $validateAuthCookies(req, res)
        expect(result).toEqual({ user: null, session: null })
    })

    test('ignores a malformed / empty Authorization header', async () => {
        for (const authorization of ['Bearer ', 'Basic abc', 'bearer abc']) {
            const { req, res } = mock({ headers: { authorization } })
            const result = await $validateAuthCookies(req, res)
            expect(result).toEqual({ user: null, session: null })
        }
    })

    test('Bearer token takes precedence over the cookie', async () => {
        const bearerUser = await $mockUser()
        const cookieUser = await $mockUser()
        const { token } = await bearerUser.createCookie()
        const { cookies } = await cookieUser.createCookie()
        const { req, res } = mock({ headers: { authorization: `Bearer ${token}` }, cookies })

        const result = await $validateAuthCookies(req, res)

        expect(result.user?.id).toBe(bearerUser.userData.id)
        await bearerUser.delete()
        await cookieUser.delete()
    })

    test('an invalid Bearer token is not rescued by a valid cookie', async () => {
        const user = await $mockUser()
        const { cookies } = await user.createCookie()
        const { req, res } = mock({ headers: { authorization: 'Bearer invalid' }, cookies })

        const result = await $validateAuthCookies(req, res)

        expect(result.user).toBeNull()
        await user.delete()
    })

    test('the Bearer path does not set or delete cookies', async () => {
        const user = await $mockUser()
        const { token } = await user.createCookie()

        const valid = mock({ headers: { authorization: `Bearer ${token}` } })
        await $validateAuthCookies(valid.req, valid.res)
        expect(valid.res.getHeader('set-cookie')).toBeUndefined()

        const invalid = mock({ headers: { authorization: 'Bearer invalid' } })
        await $validateAuthCookies(invalid.req, invalid.res)
        expect(invalid.res.getHeader('set-cookie')).toBeUndefined()

        await user.delete()
    })

    test('the cookie path refreshes the cookie when valid and deletes it when invalid', async () => {
        const user = await $mockUser()
        const { cookies, token } = await user.createCookie()

        const valid = mock({ cookies })
        const result = await $validateAuthCookies(valid.req, valid.res)
        expect(result.user?.id).toBe(user.userData.id)
        expect(String(valid.res.getHeader('set-cookie'))).toContain(`session=${token}`)

        const invalid = mock({ cookies: { session: 'invalid' } })
        await $validateAuthCookies(invalid.req, invalid.res)
        expect(String(invalid.res.getHeader('set-cookie'))).toContain('Max-Age=0')

        await user.delete()
    })

    test('no token at all → null without touching cookies', async () => {
        const { req, res } = mock()
        expect(await $validateAuthCookies(req, res)).toEqual({ user: null, session: null })
        expect(res.getHeader('set-cookie')).toBeUndefined()
    })
})

describe('$wantsTokenInBody', () => {
    test('true only for x-auth-mode: token', () => {
        expect($wantsTokenInBody(mock({ headers: { 'x-auth-mode': 'token' } }).req)).toBe(true)
        expect($wantsTokenInBody(mock({ headers: { 'x-auth-mode': 'cookie' } }).req)).toBe(false)
        expect($wantsTokenInBody(mock().req)).toBe(false)
    })
})
