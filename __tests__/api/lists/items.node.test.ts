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