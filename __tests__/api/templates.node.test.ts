import templatesRouter from '@/pages/api/templates/index';
import templatesIdRouter from '@/pages/api/templates/[id]/index';
import { db } from '@/server/db';
import { itemsTable } from '@/server/db/schema';
import { shortIdRegex } from '@/utils/lib/generateID';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import $mockUser from '@tests/test-utils/mocks/data/mockUser';
import $mockHttp from '@tests/test-utils/mocks/mockHttp';
import { and, eq } from 'drizzle-orm';
import { describe, expect, test, vi } from 'vitest';

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('@/server/db');

describe('api/templates', async () => {
    describe('GET /api/templates', () => {
        test('should return empty list initially', async () => {
            const user = await $mockUser();
            const { cookies } = await user.createCookie();

            const { body, statusCode } = await $mockHttp(templatesRouter).get(undefined, { cookies });
            expect(statusCode).toBe(200);
            expect(body).toEqual([]);

            await user.delete();
        });
    });

    describe('POST /api/templates', () => {
        test('should create a template successfully', async () => {
            const user = await $mockUser();
            const { cookies } = await user.createCookie();

            const payload = {
                title: 'Template 1',
                description: 'A test template',
                layout: [[{ type: 'one_row' }, []]],
                header: { type: 'poster_beside' }
            };

            const { body, statusCode } = await $mockHttp(templatesRouter).post(payload, { cookies });
            expect(statusCode).toBe(201);
            expect(body).toMatchObject({
                title: 'Template 1',
                description: 'A test template',
                isTemplate: true,
                trash: false,
                userId: user.userData.id,
            });
            expect(body.id).toMatch(shortIdRegex);
            expect(body.layout).toEqual([[{ type: 'one_row' }, []]]);

            // DB Verification
            const [dbItem] = await db.select().from(itemsTable).where(eq(itemsTable.id, body.id));
            expect(dbItem).toBeDefined();
            expect(dbItem.title).toBe('Template 1');
            expect(dbItem.isTemplate).toBe(true);

            await user.delete();
        });

        test('should reject creation without title', async () => {
            const user = await $mockUser();
            const { cookies } = await user.createCookie();

            const payload = { description: 'No title' };

            const { body, statusCode } = await $mockHttp(templatesRouter).post(payload, { cookies });
            expect(statusCode).toBe(400);
            expect(body.errorCode).toBe(ApiErrorCode.BAD_REQUEST);

            await user.delete();
        });
    });

    describe('api/templates/[id]', () => {
        test('GET - should fetch a single template', async () => {
            const user = await $mockUser();
            const { cookies } = await user.createCookie();

            const payload = { title: 'Template to fetch' };
            const postReq = await $mockHttp(templatesRouter).post(payload, { cookies });
            const templateId = postReq.body.id;

            const { body, statusCode } = await $mockHttp(templatesIdRouter).get(undefined, { cookies, query: { id: templateId } });
            expect(statusCode).toBe(200);
            expect(body.title).toBe('Template to fetch');
            expect(body.isTemplate).toBe(true);

            await user.delete();
        });

        test('PUT - should update template data and reflect in DB', async () => {
            const user = await $mockUser();
            const { cookies } = await user.createCookie();

            const postReq = await $mockHttp(templatesRouter).post({ title: 'Old Title' }, { cookies });
            const templateId = postReq.body.id;

            const { body, statusCode } = await $mockHttp(templatesIdRouter).put({ title: 'New Title' }, { cookies, query: { id: templateId } });
            expect(statusCode).toBe(200);
            expect(body.title).toBe('New Title');

            // DB Verification
            const [dbItem] = await db.select().from(itemsTable).where(eq(itemsTable.id, templateId));
            expect(dbItem.title).toBe('New Title');

            await user.delete();
        });

        test('DELETE - should remove template from DB', async () => {
            const user = await $mockUser();
            const { cookies } = await user.createCookie();

            const postReq = await $mockHttp(templatesRouter).post({ title: 'To Delete' }, { cookies });
            const templateId = postReq.body.id;

            const { statusCode } = await $mockHttp(templatesIdRouter).delete(undefined, { cookies, query: { id: templateId } });
            expect(statusCode).toBe(200);

            // DB Verification
            const [dbItem] = await db.select().from(itemsTable).where(eq(itemsTable.id, templateId));
            expect(dbItem).toBeUndefined();

            await user.delete();
        });

        test('should return 404 for non-existent template', async () => {
            const user = await $mockUser();
            const { cookies } = await user.createCookie();

            const { statusCode } = await $mockHttp(templatesIdRouter).get(undefined, { cookies, query: { id: 'ABCDEFGHJKLMNP' } });
            expect(statusCode).toBe(404);

            await user.delete();
        });
    });
});
