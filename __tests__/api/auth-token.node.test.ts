import sessionsHandler from '@/pages/api/sessions';
import usersRoute from '@/pages/api/users';
import { db } from '@/server/db';
import { usersTable } from '@/server/db/schema';
import { $generateID } from '@/server/utils/lib/generateID';
import $mockUser from '@tests/test-utils/mocks/data/mockUser';
import $mockHttp from '@tests/test-utils/mocks/mockHttp';
import { eq } from 'drizzle-orm';
import { vol } from 'memfs';
import { NextApiRequest, NextApiResponse } from 'next';
import httpMocks from 'node-mocks-http';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('@/server/db');

beforeEach(() => vol.reset())

const TOKEN_MODE = { 'x-auth-mode': 'token' }

/** like $mockHttp but keeps `req.body` as an already-parsed object (what Next does for `Content-Type: application/json`) */
async function callWithObjectBody(
    handler: (req: NextApiRequest, res: NextApiResponse) => Promise<any>,
    method: 'POST' | 'PATCH',
    body: object,
    options: httpMocks.RequestOptions = {},
) {
    const req = httpMocks.createRequest<NextApiRequest>({
        method,
        ...options,
        headers: { 'content-type': 'application/json', ...options.headers },
        body: body as any,
    })
    const res = httpMocks.createResponse<NextApiResponse>()
    await handler(req, res)
    return { body: res._getJSONData(), statusCode: res._getStatusCode(), headers: res._getHeaders() }
}

const getMe = (token: string) =>
    $mockHttp(usersRoute).get(undefined, { headers: { authorization: `Bearer ${token}` } })

const deleteUserByName = (username: string) =>
    db.delete(usersTable).where(eq(usersTable.username, username.toLowerCase()))

describe('POST api/sessions (login) - token mode', () => {
    test('with x-auth-mode: token the body includes a token that works as Bearer', async () => {
        const { userData: { username, password, id }, ...user } = await $mockUser()
        const { body, statusCode, headers } = await $mockHttp(sessionsHandler).post({ username, password }, { headers: TOKEN_MODE })

        expect(statusCode).toBe(200)
        expect(body).toMatchObject({ id, username })
        expect(body.token).toEqual(expect.any(String))
        expect(body.token.length).toBeGreaterThan(10)
        expect(headers).toHaveProperty('set-cookie')

        const me = await getMe(body.token)
        expect(me.statusCode).toBe(200)
        expect(me.body.id).toBe(id)

        await user.delete()
    })

    test('without the header the token is not in the body (cookie only)', async () => {
        const { userData: { username, password }, ...user } = await $mockUser()
        const { body, statusCode, headers } = await $mockHttp(sessionsHandler).post({ username, password })

        expect(statusCode).toBe(200)
        expect(body).not.toHaveProperty('token')
        expect(headers).toHaveProperty('set-cookie')

        await user.delete()
    })

    test('accepts an already-parsed JSON body', async () => {
        const { userData: { username, password, id }, ...user } = await $mockUser()
        const { body, statusCode } = await callWithObjectBody(sessionsHandler, 'POST', { username, password }, { headers: TOKEN_MODE })

        expect(statusCode).toBe(200)
        expect(body.id).toBe(id)
        expect(body.token).toEqual(expect.any(String))

        await user.delete()
    })
})

describe('POST api/users (signup) - token mode', () => {
    test('with x-auth-mode: token the body includes a token that works as Bearer', async () => {
        const username = $generateID(6).toLowerCase()
        const { body, statusCode } = await $mockHttp(usersRoute).post({ username, password: 'testpassword' }, { headers: TOKEN_MODE })

        expect(statusCode).toBe(201)
        expect(body.username).toBe(username)
        expect(body.token).toEqual(expect.any(String))

        const me = await getMe(body.token)
        expect(me.statusCode).toBe(200)
        expect(me.body.id).toBe(body.id)
        expect(me.body).not.toHaveProperty('passwordHash')

        await deleteUserByName(username)
    })

    test('without the header the token is not in the body', async () => {
        const username = $generateID(6).toLowerCase()
        const { body, statusCode, headers } = await $mockHttp(usersRoute).post({ username, password: 'testpassword' })

        expect(statusCode).toBe(201)
        expect(body).not.toHaveProperty('token')
        expect(headers).toHaveProperty('set-cookie')

        await deleteUserByName(username)
    })

    test('regression: an already-parsed JSON body (object) does not crash', async () => {
        const username = $generateID(6).toLowerCase()
        const { body, statusCode } = await callWithObjectBody(usersRoute, 'POST', { username, password: 'testpassword' })

        expect(statusCode).toBe(201)
        expect(body.username).toBe(username)

        await deleteUserByName(username)
    })
})

describe('PATCH api/users - parsed JSON body', () => {
    test('regression: an already-parsed JSON body (object) does not crash', async () => {
        const { userData: { id, password }, ...user } = await $mockUser()
        const { token } = await user.createCookie()
        const newUsername = $generateID(6).toLowerCase()

        const { body, statusCode } = await callWithObjectBody(
            usersRoute, 'PATCH',
            { newUsername, oldPassword: password },
            { headers: { authorization: `Bearer ${token}` } },
        )

        expect(statusCode).toBe(200)
        expect(body.id).toBe(id)
        expect(body.username).toBe(newUsername)

        await user.delete()
    })
})
