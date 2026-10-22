import uploadHandler from '@/pages/api/sync/upload';
import { $generateShortID } from '@/server/utils/lib/generateID';
import { thumbnailName, THUMBNAILS_OPTIONS } from '@/utils/lib/fileHandling/thumbnailOptions';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import { $mockItem } from '@tests/test-utils/mocks/data/mockItem';
import $mockList from '@tests/test-utils/mocks/data/mockList';
import $mockUser from '@tests/test-utils/mocks/data/mockUser';
import { TEST_MOCK_FILE_BUFFER, TEST_MOCK_FILE_NAME } from '@tests/test-utils/mocks/mockFile';
import $mockHttp from '@tests/test-utils/mocks/mockHttp';
import { existsSync } from 'fs';
import FormData from 'form-data';
import { join } from 'path';
import { describe, expect, test, vi } from 'vitest';

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('@/server/db');

describe('api/sync/upload', async () => {
    const file = await TEST_MOCK_FILE_BUFFER

    const form = (fields: Record<string, string>, withFile = true) => {
        const data = new FormData()
        Object.entries(fields).forEach(([key, value]) => data.append(key, value))
        if (withFile) data.append('file', file, TEST_MOCK_FILE_NAME)
        return data
    }

    test('uploads a list cover into the list dir with thumbnails', async () => {
        const user = await $mockUser()
        const list = await $mockList(undefined, user)
        const { cookies } = await user.createCookie()

        const { body, statusCode } = await $mockHttp(uploadHandler).post(
            form({ kind: 'listCover', listId: list.listData.id }), { cookies }
        )

        expect(statusCode).toBe(201)
        expect(typeof body.path).toBe('string')
        expect(body.path).not.toMatch(/[\/\\]/)
        expect(existsSync(join(list.listDir, body.path))).toBe(true)
        THUMBNAILS_OPTIONS.LIST_COVER.forEach(option =>
            expect(existsSync(join(list.listDir, thumbnailName(body.path, option)))).toBe(true)
        )

        await user.delete()
    })

    test('accepts uploads for a list & item that do not exist yet (created offline)', async () => {
        const user = await $mockUser()
        const { cookies } = await user.createCookie()
        const listId = $generateShortID()
        const itemId = $generateShortID()

        const { body, statusCode } = await $mockHttp(uploadHandler).post(
            form({ kind: 'itemPoster', listId, itemId }), { cookies }
        )

        expect(statusCode).toBe(201)
        const itemDir = join(user.userDir, listId, itemId)
        expect(existsSync(join(itemDir, body.path))).toBe(true)
        THUMBNAILS_OPTIONS.ITEM_POSTER.forEach(option =>
            expect(existsSync(join(itemDir, thumbnailName(body.path, option)))).toBe(true)
        )

        await user.delete()
    })

    test('rejects with 4xx: bad kind/ids, missing file, other user\'s list, item of another list', async () => {
        const user = await $mockUser()
        const { cookies } = await user.createCookie()
        const list = await $mockList(undefined, user)
        const item = await $mockItem(undefined, list)
        const otherList = await $mockList()

        const cases = [
            form({ kind: 'nope', listId: list.listData.id, itemId: item.itemData.id }),
            form({ kind: 'logo', listId: list.listData.id }),
            form({ kind: 'listCover', listId: '../../etc' }),
            form({ kind: 'listCover', listId: list.listData.id }, false),
            form({ kind: 'listCover', listId: otherList.listData.id }),
            form({ kind: 'media', listId: $generateShortID(), itemId: item.itemData.id }),
        ]

        for (const data of cases) {
            const { statusCode, body } = await $mockHttp(uploadHandler).post(data, { cookies })
            expect(statusCode).toBeGreaterThanOrEqual(400)
            expect(statusCode).toBeLessThan(500)
            expect(body.errorCode).toBeDefined()
        }

        await otherList.delete()
        await user.delete()
    })

    test('returns 401 if not logged in', async () => {
        // (a non-form body: mockHttp awaits 'finish' for forms, which a synchronous early response never emits)
        const { statusCode, body } = await $mockHttp(uploadHandler).post({})
        expect(statusCode).toBe(401)
        expect(body).toEqual({ errorCode: ApiErrorCode.UNAUTHORIZED })
    })
})
