import itemsRouter from '@/pages/api/lists/[id]/items';
import { $generateID, $generateShortID } from '@/server/utils/lib/generateID';
import { thumbnailName, ThumbnailOptions, THUMBNAILS_OPTIONS } from '@/utils/lib/fileHandling/thumbnailOptions';
import { longIdRegex, shortIdRegex } from '@/utils/lib/generateID';
import { ItemData, ItemLayoutTab } from '@/utils/types/item';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import { $mockItem } from '@tests/test-utils/mocks/data/mockItem';
import $mockList from '@tests/test-utils/mocks/data/mockList';
import $mockTag from '@tests/test-utils/mocks/data/mockTag';
import { TEST_MOCK_FILE_BUFFER, TEST_MOCK_FILE_NAME } from '@tests/test-utils/mocks/mockFile';
import $mockHttp from '@tests/test-utils/mocks/mockHttp';
import FormData from 'form-data';
import { fs } from 'memfs';
import { join } from 'path';
import { describe, expect, test, vi } from 'vitest';

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('@/server/db');

describe('api/lists/[id]/items', async () => {
    const file = await TEST_MOCK_FILE_BUFFER

    describe('should return 404', () => {
        test('if a fake/unexisting list ID is provided', async () => {
            const { userMock } = await $mockList({ title: 'List1' });
            const { userData, ...user } = userMock;
            const { cookies } = await user.createCookie();

            const { body, statusCode } = await $mockHttp(itemsRouter).get(undefined, { cookies, query: { id: $generateShortID() } });
            expect(body).toEqual({ errorCode: ApiErrorCode.NOT_FOUND });
            expect(statusCode).toBe(404);

            await user.delete();
        })

        test('if an ID of other user\'s list is provided', async () => {
            const { listData, userMock } = await $mockList({ title: 'List1' });
            const { listData: otherUserList } = await $mockList({ title: 'List1' });
            const { userData, ...user } = userMock;
            const { cookies } = await user.createCookie();

            const { body, statusCode } = await $mockHttp(itemsRouter).get(undefined, { cookies, query: { id: otherUserList.id } });
            expect(body).toEqual({ errorCode: ApiErrorCode.NOT_FOUND });
            expect(statusCode).toBe(404);

            await user.delete();
        })
    })

    test('should return 400 Bad Request if an invalid ID is provided', async () => {
        const { userMock } = await $mockList({ title: 'List1' });
        const { userData, ...user } = userMock;
        const { cookies } = await user.createCookie();

        const r1 = await $mockHttp(itemsRouter).get(undefined, { cookies, query: { id: 'invalidID' } });
        expect(r1.body).toEqual({ errorCode: ApiErrorCode.BAD_REQUEST });
        expect(r1.statusCode).toBe(400);

        const r2 = await $mockHttp(itemsRouter).get(undefined, { cookies, query: { id: '' } });
        expect(r2.body).toEqual({ errorCode: ApiErrorCode.BAD_REQUEST });
        expect(r2.statusCode).toBe(400);

        //to-add: 
        // const fakeString = 'a'.repeat(10 ** 10);
        // const r3 = await $mockHttp(itemsRouter).get(undefined, { cookies, query: { id: fakeString } });
        // expect(r3.body).toEqual({ errorCode: ApiErrorCode.BAD_REQUEST });
        // expect(r3.statusCode).toBe(400);

        await user.delete();
    })

    describe('GET - get all items of a list', async () => {
        test('should return all items of a list', async () => {
            const list = await $mockList();
            const { userMock, listData } = list
            const { cookies } = await userMock.createCookie();

            const i1 = await $mockItem({ poster: true, title: "item 1" }, list)
            const i2 = await $mockItem({ title: "item 2" }, list)
            const i3 = await $mockItem({ title: "item of another list" }, userMock)
            const i4 = await $mockItem({ title: "item of another user" })

            const req = await $mockHttp(itemsRouter).get(undefined, { cookies, query: { id: listData.id } });

            expect(req.body).toEqual([i1.itemData, i2.itemData])
            expect(req.res.statusCode).toBe(200);

            await list.delete();
        })

        test('should return an empty array if no items are found', async () => {
            const list = await $mockList();
            const { userMock, listData } = list
            const { cookies } = await userMock.createCookie();

            const req = await $mockHttp(itemsRouter).get(undefined, { cookies, query: { id: listData.id } });

            expect(req.body).toEqual([])
            expect(req.res.statusCode).toBe(200);

            await list.delete();
        })
    })

    describe('GET - paginated & filtered', async () => {
        const getPage = (cookies: any, query: Record<string, string>) =>
            $mockHttp(itemsRouter).get(undefined, { cookies, query })

        test('should paginate with a cursor (title, id ordered) without duplicates or missing items', async () => {
            const list = await $mockList();
            const { userMock, listData } = list
            const { cookies } = await userMock.createCookie();

            // same titles to check the id tie-break
            const titles = ['e', 'a', 'c', 'b', 'a', 'd', 'c']
            const created = []
            for (const title of titles) created.push((await $mockItem({ title }, list)).itemData)
            await $mockItem({ title: 'trashed', trash: true }, list)
            await $mockItem({ title: 'item of another list' }, userMock)

            const expected = [...created]
                .sort((a, b) => a.title < b.title ? -1 : a.title > b.title ? 1 : a.id < b.id ? -1 : 1)
                .map(item => item.id)

            const seen: string[] = []
            let cursor: string | null = null
            let pages = 0
            do {
                const query: Record<string, string> = { id: listData.id, limit: '3' }
                if (cursor) query.cursor = cursor
                const { body, statusCode } = await getPage(cookies, query)
                expect(statusCode).toBe(200)
                expect(body.total).toBe(7)
                expect(body.items.length).toBeLessThanOrEqual(3)
                seen.push(...body.items.map((item: ItemData) => item.id))
                cursor = body.nextCursor
                pages++
            } while (cursor && pages < 10)

            expect(pages).toBe(3)
            expect(seen).toEqual(expected)

            await list.delete();
        })

        test('should return nextCursor null when the page is the last one', async () => {
            const list = await $mockList();
            const { userMock, listData } = list
            const { cookies } = await userMock.createCookie();

            await $mockItem({ title: 'a' }, list)
            await $mockItem({ title: 'b' }, list)

            const exact = await getPage(cookies, { id: listData.id, limit: '2' })
            expect(exact.body.items).toHaveLength(2)
            expect(exact.body.nextCursor).toBeNull()

            // default/max page size is 100
            const big = await getPage(cookies, { id: listData.id, limit: '1000' })
            expect(big.statusCode).toBe(200)
            expect(big.body.items).toHaveLength(2)

            const empty = await getPage(cookies, { id: listData.id, limit: '10', q: 'nothing' })
            expect(empty.body).toEqual({ items: [], nextCursor: null, total: 0 })

            await list.delete();
        })

        test('should filter by q (case-insensitive, wildcards escaped), tags (all of them) and fav', async () => {
            const list = await $mockList();
            const { userMock, listData } = list
            const { cookies } = await userMock.createCookie();

            const t1 = 'tag1' + $generateShortID(), t2 = 'tag2' + $generateShortID()
            const dune = (await $mockItem({ title: 'Dune', tags: [t1, t2], fav: true }, list)).itemData
            const dune2 = (await $mockItem({ title: 'Dune Part Two', tags: [t1] }, list)).itemData
            const percent = (await $mockItem({ title: '100% Wolf', tags: [t2], fav: true }, list)).itemData
            await $mockItem({ title: 'Arrival' }, list)

            const ids = (body: { items: ItemData[] }) => body.items.map(item => item.id)

            expect(ids((await getPage(cookies, { id: listData.id, limit: '10', q: 'dUNE' })).body))
                .toEqual([dune.id, dune2.id])
            expect(ids((await getPage(cookies, { id: listData.id, limit: '10', q: '%' })).body))
                .toEqual([percent.id])
            expect(ids((await getPage(cookies, { id: listData.id, limit: '10', q: '_' })).body))
                .toEqual([])
            expect(ids((await getPage(cookies, { id: listData.id, limit: '10', tags: t1 })).body))
                .toEqual([dune.id, dune2.id])
            expect(ids((await getPage(cookies, { id: listData.id, limit: '10', tags: `${t1},${t2}` })).body))
                .toEqual([dune.id])
            expect(ids((await getPage(cookies, { id: listData.id, limit: '10', fav: 'true' })).body))
                .toEqual([percent.id, dune.id])

            const combined = await getPage(cookies, { id: listData.id, limit: '1', fav: 'true', tags: t2 })
            expect(combined.body.total).toBe(2)
            expect(ids(combined.body)).toEqual([percent.id])
            const next = await getPage(cookies, { id: listData.id, limit: '1', fav: 'true', tags: t2, cursor: combined.body.nextCursor })
            expect(ids(next.body)).toEqual([dune.id])
            expect(next.body.nextCursor).toBeNull()

            // backward compatible: filters without limit/cursor return a plain array
            const plain = await getPage(cookies, { id: listData.id, q: 'dune' })
            expect(plain.body).toEqual([dune, dune2])

            await list.delete();
        })

        test('should return 400 on invalid limit, cursor or fav', async () => {
            const list = await $mockList();
            const { userMock, listData } = list
            const { cookies } = await userMock.createCookie();

            const queries: Record<string, string>[] = [
                { limit: '0' }, { limit: '-1' }, { limit: 'abc' }, { limit: '1.5' },
                { cursor: 'garbage' }, { cursor: Buffer.from('["a"]').toString('base64url') },
                { cursor: Buffer.from('["a","bad id!"]').toString('base64url') },
                { fav: 'yes' },
            ]
            for (const query of queries) {
                const { body, statusCode } = await getPage(cookies, { id: listData.id, ...query })
                expect(statusCode, JSON.stringify(query)).toBe(400)
                expect(body).toEqual({ errorCode: ApiErrorCode.BAD_REQUEST })
            }

            await list.delete();
        })
    })

    describe('POST - create an item in the list', () => {
        // to add: default header, default layout,

        test('should create item with title, poster, cover, layout (with logos), media images, and tags (existing + new)', async () => {
            const list = await $mockList();
            const { listData, userMock } = list
            const { cookies } = await userMock.createCookie();

            const existingTags = await $mockTag({ label: 'existingTag' }, list)

            const form = new FormData();
            form.append('title', 'new item');
            form.append('description', 'new item description');
            form.append('fav', JSON.stringify(true));

            form.append('header', JSON.stringify({ type: 'poster_beside' }))
            form.append('poster', file, TEST_MOCK_FILE_NAME);
            form.append('cover', file, TEST_MOCK_FILE_NAME);

            form.append('tags', JSON.stringify([
                existingTags.tagData.id,
                'newTag that will be created'
            ]))

            const logoID = $generateID(10)
            form.append(`logoPaths[${logoID}]`, file, TEST_MOCK_FILE_NAME);

            const [imageID1, imageID2] = [$generateID(10), $generateID(10)]
            form.append('media', JSON.stringify([
                { title: 'image1', path: imageID1, keywords: ['keyword1', 'keyword2'] },
                { title: null, path: 'shouldIgnorethis' },
                { path: imageID2 },
            ]))
            form.append(`mediaImages[${imageID1}]`, file, TEST_MOCK_FILE_NAME);
            form.append(`mediaImages[${imageID2}]`, file, TEST_MOCK_FILE_NAME);

            form.append('layout', JSON.stringify([
                [{ type: 'one_row', label: 'tab1' }, [{ type: 'labelText', label: 'label', body: 'text', logoPath: logoID }]],
                [{ type: 'one_row', label: 'tab2' }, [
                    { type: 'labelText', label: 'label', body: 'text' },
                    { type: 'image', imageId: imageID1 },
                ]],
            ] as ItemLayoutTab[]))

            const { body, statusCode } = await $mockHttp(itemsRouter).post(form, { cookies, query: { id: listData.id } });

            const item = body.item as ItemData

            expect(body).toEqual({
                item: {
                    id: expect.stringMatching(shortIdRegex),
                    userId: userMock.userData.id,
                    listId: listData.id,
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                    title: 'new item',
                    description: 'new item description',
                    posterPath: expect.any(String),
                    coverPath: expect.any(String),
                    extractor: null,
                    isTemplate: false,
                    layout: [
                        [
                            { type: 'one_row', label: 'tab1' },
                            [{ type: 'labelText', label: 'label', body: 'text', logoPath: expect.any(String) }]
                        ],
                        [
                            { type: 'one_row', label: 'tab2' },
                            [
                                { type: 'labelText', label: 'label', body: 'text' },
                                { type: 'image', imageId: body.newMedia[0].id }
                            ],
                        ],
                    ],
                    header: { type: 'poster_beside' },
                    trash: false,
                    fav: true,
                    tags: [
                        existingTags.tagData.id,
                        expect.any(String),
                    ],
                },
                newTags: [{
                    id: expect.stringMatching(longIdRegex),
                    listId: listData.id,
                    userId: userMock.userData.id,
                    label: 'newTag that will be created',
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                }],
                newMedia: [
                    {
                        id: expect.stringMatching(longIdRegex),
                        userId: userMock.userData.id,
                        itemId: item.id,
                        path: expect.any(String),
                        type: 'image',
                        title: 'image1',
                        keywords: ['keyword1', 'keyword2'],
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String)
                    },
                    {
                        id: expect.stringMatching(longIdRegex),
                        userId: userMock.userData.id,
                        itemId: item.id,
                        path: expect.any(String),
                        type: 'image',
                        title: null,
                        keywords: [],
                        createdAt: expect.any(String),
                        updatedAt: expect.any(String)
                    },
                ]
            })

            const itemDir = join(list.listDir, item.id)

            const logoPath = body.item.layout[0][1][0].logoPath
            const logoExists = fileExists(itemDir, logoPath, THUMBNAILS_OPTIONS.LOGO)
            expect(logoExists).toBe(true)

            const posterExists = fileExists(itemDir, item.posterPath as string, THUMBNAILS_OPTIONS.ITEM_POSTER)
            expect(posterExists).toBe(true)

            const coverExists = fileExists(itemDir, item.coverPath as string, THUMBNAILS_OPTIONS.ITEM_COVER)
            expect(coverExists).toBe(true)

            const mediaImage1Exists = fileExists(itemDir, body.newMedia[0].path, THUMBNAILS_OPTIONS.ITEM_MEDIA)
            expect(mediaImage1Exists).toBe(true)

            const mediaImage2Exists = fileExists(itemDir, body.newMedia[1].path, THUMBNAILS_OPTIONS.ITEM_MEDIA)
            expect(mediaImage2Exists).toBe(true)

            expect(statusCode).toBe(201);

            await list.delete();
        })

        test('should create item with only title', async () => {
            const list = await $mockList();
            const { listData, userMock } = list
            const { cookies } = await userMock.createCookie();

            const form = new FormData();
            form.append('title', 'new item');
            const { body, statusCode } = await $mockHttp(itemsRouter).post(form, { cookies, query: { id: listData.id } });

            expect(body).toEqual({
                item: {
                    id: expect.stringMatching(shortIdRegex),
                    userId: userMock.userData.id,
                    listId: listData.id,
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                    title: 'new item',
                    trash: false,
                    fav: false,
                    extractor: null,
                    isTemplate: false,
                    tags: [],
                    layout: [],
                    header: {},
                    posterPath: null,
                    coverPath: null,
                    description: null,
                },
                newTags: [],
                newMedia: []
            })

            expect(statusCode).toBe(201);

            await list.delete();
        })

        test('should return 400 if title is not provided', async () => {
            const list = await $mockList();
            const { listData, userMock } = list
            const { cookies } = await userMock.createCookie();

            const form = new FormData();

            const { body, statusCode } = await $mockHttp(itemsRouter).post(form, { cookies, query: { id: listData.id } });

            expect(body).toEqual({
                message: 'Title is required',
                errorCode: ApiErrorCode.BAD_REQUEST
            });
            expect(statusCode).toBe(400);

            await list.delete();
        })
    })

})

const fileExists = (dir: string, fileName: string, thumbnailOptions: ThumbnailOptions[]) => {
    const fileExisst = fs.existsSync(join(dir, fileName))

    const thumbnailsExists = thumbnailOptions
        ? thumbnailOptions.map((option) =>
            fs.existsSync(join(dir, thumbnailName(fileName, option)))
        ).every(Boolean)
        : true

    return fileExisst && thumbnailsExists
}