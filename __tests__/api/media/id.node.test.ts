import itemsMediaRouter from '@/pages/api/media/[id]';
import { $generateLongID } from '@/server/utils/lib/generateID';
import { thumbnailName, ThumbnailOptions, THUMBNAILS_OPTIONS } from '@/utils/lib/fileHandling/thumbnailOptions';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import { $mockItem } from '@tests/test-utils/mocks/data/mockItem';
import $mockItemMedia from '@tests/test-utils/mocks/data/mockItemMedia';
import $mockHttp from '@tests/test-utils/mocks/mockHttp';
import { fs } from 'memfs';
import { join } from 'path';
import { describe, expect, test, vi } from 'vitest';

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('@/server/db');

describe('api/media/[id]', async () => {
    describe('should return 404', () => {
        test('if a fake/unexisting media ID is provided', async () => {
            const item = await $mockItem({ title: 'Item' });
            const { userData, ...user } = item.userMock;
            const { cookies } = await user.createCookie();
            const media = await $mockItemMedia({}, item);

            const { body, statusCode } = await $mockHttp(itemsMediaRouter).get(undefined, { cookies, query: { id: $generateLongID() } });
            expect(body).toEqual({ errorCode: ApiErrorCode.NOT_FOUND });
            expect(statusCode).toBe(404);

            await item.delete();
        })

        test('if an ID of other user\'s media is provided', async () => {
            const item = await $mockItem();
            const { userData, ...user } = item.userMock;

            const { mediaData } = await $mockItemMedia({}, item);
            const { mediaData: otherUserMedia } = await $mockItemMedia({});

            const { cookies } = await user.createCookie();

            const { body, statusCode } = await $mockHttp(itemsMediaRouter).get(undefined, { cookies, query: { id: otherUserMedia.id } });
            expect(body).toEqual({ errorCode: ApiErrorCode.NOT_FOUND });
            expect(statusCode).toBe(404);

            await item.delete();
        })
    })

    test('should return 400 Bad Request if an invalid ID is provided', async () => {
        const { userMock, ...item } = await $mockItem();
        const { userData, ...user } = userMock;
        const { cookies } = await user.createCookie();

        const r1 = await $mockHttp(itemsMediaRouter).get(undefined, { cookies, query: { id: 'invalidID' } });
        expect(r1.body).toEqual({ errorCode: ApiErrorCode.BAD_REQUEST });
        expect(r1.statusCode).toBe(400);

        const r2 = await $mockHttp(itemsMediaRouter).get(undefined, { cookies, query: { id: '' } });
        expect(r2.body).toEqual({ errorCode: ApiErrorCode.BAD_REQUEST });
        expect(r2.statusCode).toBe(400);

        //to-add: 
        // const fakeString = 'a'.repeat(10 ** 10);
        // const r3 = await $mockHttp(itemsRouter).get(undefined, { cookies, query: { id: fakeString } });
        // expect(r3.body).toEqual({ errorCode: ApiErrorCode.BAD_REQUEST });
        // expect(r3.statusCode).toBe(400);

        await item.delete();
    })

    test('GET - should return media data by id', async () => {
        const { mediaData, userMock, ...media } = await $mockItemMedia({});
        const { userData, ...user } = userMock;
        const { cookies } = await user.createCookie();

        const { body, statusCode } = await $mockHttp(itemsMediaRouter).get(undefined, { cookies, query: { id: mediaData.id } });
        expect(body).toEqual(mediaData);
        expect(statusCode).toBe(200);

        await media.delete();
    })

    test('PATCH - should update media data by id', async () => {
        const { mediaData, userMock, ...media } = await $mockItemMedia({
            createdAt: new Date(2000, 1),
            updatedAt: new Date(2000, 1)
        });
        const { userData, ...user } = userMock;
        const { cookies } = await user.createCookie();

        const title = 'New Title';
        const keywords = ['new', 'keywords'];

        const { body, statusCode } = await $mockHttp(itemsMediaRouter).patch({ title, keywords }, { cookies, query: { id: mediaData.id } });
        await new Promise(setImmediate);

        expect(body).toEqual({
            ...mediaData,
            title,
            keywords,
            updatedAt: expect.not.stringMatching(mediaData.updatedAt)
        });

        expect(statusCode).toBe(200);

        const fileStillExists = fileExists(media.itemDir, mediaData.path, THUMBNAILS_OPTIONS.ITEM_MEDIA);
        expect(fileStillExists).toBe(true);

        await media.delete();
    })

    test('DELETE - should delete media by id', async () => {
        const { mediaData, userMock, ...media } = await $mockItemMedia({});
        const { userData, ...user } = userMock;
        const { cookies } = await user.createCookie();

        const { body, statusCode } = await $mockHttp(itemsMediaRouter).delete(undefined, { cookies, query: { id: mediaData.id } });
        await new Promise(setImmediate);

        expect(body).toEqual(mediaData);
        expect(statusCode).toBe(200);

        const fileStillExists = fileExists(media.itemDir, mediaData.path, THUMBNAILS_OPTIONS.ITEM_MEDIA);
        expect(fileStillExists).toBe(false);

        await media.delete();
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