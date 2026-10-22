import syncHandler from '@/pages/api/sync';
import { $getItem, $updateItems } from '@/server/db/queries/items';
import { $getList } from '@/server/db/queries/lists';
import { $deleteTags } from '@/server/db/queries/tags';
import { $generateLongID, $generateShortID } from '@/server/utils/lib/generateID';
import { ApiErrorCode } from '@/utils/types/serverResponse';
import { $mockItem } from '@tests/test-utils/mocks/data/mockItem';
import $mockItemMedia from '@tests/test-utils/mocks/data/mockItemMedia';
import $mockList from '@tests/test-utils/mocks/data/mockList';
import $mockTag from '@tests/test-utils/mocks/data/mockTag';
import $mockUser from '@tests/test-utils/mocks/data/mockUser';
import $mockHttp from '@tests/test-utils/mocks/mockHttp';
import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, test, vi } from 'vitest';

vi.mock('node:fs')
vi.mock('node:fs/promises')
vi.mock('@/server/db');

type Cookies = Record<string, string>

const pull = async (cookies: Cookies, since?: number) =>
    await $mockHttp(syncHandler).get(undefined, {
        cookies,
        query: since === undefined ? {} : { since: String(since) }
    })

const push = async (cookies: Cookies, ops: object[]) =>
    await $mockHttp(syncHandler).post({ ops }, { cookies })

const ids = (rows: { id: string }[]) => rows.map(row => row.id)

let opCounter = 0
const op = (props: object) => ({ opId: `op-${++opCounter}`, ts: Date.now(), ...props })

describe('api/sync', () => {
    test('should return 401 if not logged in', async () => {
        const { body, statusCode } = await $mockHttp(syncHandler).get()
        expect(statusCode).toBe(401)
        expect(body).toEqual({ errorCode: ApiErrorCode.UNAUTHORIZED })
    })

    test('should return 400 for an invalid cursor', async () => {
        const user = await $mockUser()
        const { cookies } = await user.createCookie()

        const { statusCode } = await $mockHttp(syncHandler).get(undefined, { cookies, query: { since: 'abc' } })
        expect(statusCode).toBe(400)

        await user.delete()
    })

    describe('GET - pull', () => {
        test('since=0 returns a full snapshot of the user (incl. trash & templates)', async () => {
            const user = await $mockUser()
            const list = await $mockList({ title: 'list' }, user)
            const trashList = await $mockList({ title: 'trash list', trash: true }, user)
            const item = await $mockItem({ title: 'item' }, list)
            const trashItem = await $mockItem({ title: 'trash item', trash: true }, list)
            const template = await $mockItem({ title: 'template', isTemplate: true } as any, list)
            const tag = await $mockTag({ label: 'tag' }, list)
            const media = await $mockItemMedia({ title: 'media' }, item)

            const otherUserItem = await $mockItem({ title: 'other' })

            const { cookies, token } = await user.createCookie()
            const { body, statusCode } = await pull(cookies)

            expect(statusCode).toBe(200)
            expect(body.cursor).toBeGreaterThan(0)
            expect(body.hasMore).toBe(false)
            expect(typeof body.serverTime).toBe('number')
            expect(ids(body.changes.lists).sort()).toEqual([list.listData.id, trashList.listData.id].sort())
            expect(ids(body.changes.items).sort()).toEqual([
                item.itemData.id, trashItem.itemData.id, template.itemData.id
            ].sort())
            expect(body.changes.tags).toEqual([JSON.parse(JSON.stringify(tag.tagData))])
            expect(body.changes.media).toEqual([media.mediaData])
            expect(body.changes.items).toContainEqual(item.itemData)
            expect(body.deleted).toEqual({ lists: [], items: [], tags: [], media: [] })

            // bearer auth works too, and since=0 is the same as no since
            const bearer = await $mockHttp(syncHandler).get(undefined, {
                headers: { authorization: `Bearer ${token}` },
                query: { since: '0' },
            })
            expect(bearer.statusCode).toBe(200)
            expect(bearer.body.cursor).toBe(body.cursor)
            expect(bearer.body.changes.lists.length).toBe(2)

            await otherUserItem.delete()
            await user.delete()
        }, 20_000)

        test('incremental pull returns only rows updated after the cursor', async () => {
            const user = await $mockUser()
            const list = await $mockList(undefined, user)
            const item = await $mockItem({ title: 'old' }, list)
            await $mockItem({ title: 'untouched' }, list)
            const { cookies } = await user.createCookie()

            const { body: snapshot } = await pull(cookies)

            const nothing = await pull(cookies, snapshot.cursor)
            expect(nothing.body.cursor).toBe(snapshot.cursor)
            expect(nothing.body.changes).toEqual({ lists: [], items: [], tags: [], media: [] })

            await $updateItems(user.userData.id, item.itemData.id, { title: 'new', updatedAt: new Date() })
            await $updateItems(user.userData.id, item.itemData.id, { title: 'newer', updatedAt: new Date() })

            const { body } = await pull(cookies, snapshot.cursor)
            expect(body.cursor).toBeGreaterThan(snapshot.cursor)
            expect(body.changes.items.length).toBe(1)
            expect(body.changes.items[0]).toMatchObject({ id: item.itemData.id, title: 'newer' })
            expect(body.changes.lists).toEqual([])

            await user.delete()
        })

        test('pages with limit & hasMore', async () => {
            const user = await $mockUser()
            const list = await $mockList(undefined, user)
            const { cookies } = await user.createCookie()
            const { body: snapshot } = await pull(cookies)

            const a = await $mockItem({ title: 'a' }, list)
            const b = await $mockItem({ title: 'b' }, list)
            const c = await $mockItem({ title: 'c' }, list)

            const page1 = await $mockHttp(syncHandler).get(undefined, {
                cookies, query: { since: String(snapshot.cursor), limit: '2' }
            })
            expect(page1.body.hasMore).toBe(true)
            expect(ids(page1.body.changes.items).sort()).toEqual([a.itemData.id, b.itemData.id].sort())

            const page2 = await $mockHttp(syncHandler).get(undefined, {
                cookies, query: { since: String(page1.body.cursor), limit: '2' }
            })
            expect(page2.body.hasMore).toBe(false)
            expect(ids(page2.body.changes.items)).toEqual([c.itemData.id])

            await user.delete()
        })

        test('deleted rows show up in `deleted` (incl. cascades)', async () => {
            const user = await $mockUser()
            const list = await $mockList(undefined, user)
            const keptList = await $mockList(undefined, user)
            const tag = await $mockTag({ label: 'tag' }, list)
            const listTag = await $mockTag({ label: 'list tag' }, list)
            const item = await $mockItem(undefined, list)
            const media = await $mockItemMedia(undefined, item)
            const { cookies } = await user.createCookie()

            const { body: snapshot } = await pull(cookies)

            await $deleteTags(user.userData.id, tag.tagData.id)
            const r1 = await pull(cookies, snapshot.cursor)
            expect(r1.body.deleted.tags).toEqual([tag.tagData.id])
            expect(r1.body.changes.tags).toEqual([])

            // deleting a list (through a push op) deletes its items, media & tags
            const { body: pushed } = await push(cookies, [op({ entity: 'lists', id: list.listData.id, type: 'delete' })])
            expect(pushed.results[0].status).toBe('deleted')

            const r2 = await pull(cookies, r1.body.cursor)
            expect(r2.body.deleted).toEqual({
                lists: [list.listData.id],
                items: [item.itemData.id],
                tags: [listTag.tagData.id],
                media: [media.mediaData.id],
            })
            expect(existsSync(list.listDir)).toBe(false)
            expect(existsSync(keptList.listDir)).toBe(true)

            await user.delete()
        })
    })

    describe('POST - push', () => {
        test('creates lists, items, tags and media', async () => {
            const user = await $mockUser()
            const { cookies } = await user.createCookie()

            const listId = $generateShortID()
            const itemId = $generateShortID()
            const tagId = $generateLongID()
            const mediaId = $generateLongID()

            const { body, statusCode } = await push(cookies, [
                op({ entity: 'lists', id: listId, type: 'upsert', data: { title: 'offline list', userId: 'hacker', createdAt: 'x' } }),
                op({ entity: 'tags', id: tagId, type: 'upsert', data: { label: 'tag', listId } }),
                op({ entity: 'items', id: itemId, type: 'upsert', data: { title: 'offline item', listId, tags: [tagId], posterPath: '1_poster.jpg' } }),
                op({ entity: 'media', id: mediaId, type: 'upsert', data: { itemId, path: '1_media.jpg', keywords: ['k'] } }),
            ])

            expect(statusCode).toBe(200)
            expect(body.results.map((r: any) => r.status)).toEqual(['created', 'created', 'created', 'created'])
            expect(body.cursor).toBeGreaterThan(0)

            const [list, tag, item, media] = body.results.map((r: any) => r.row)
            expect(list).toMatchObject({
                id: listId, userId: user.userData.id, title: 'offline list',
                configs: { titlePlacement: 'title-below' }, trash: false, coverPath: null,
            })
            expect(tag).toMatchObject({ id: tagId, listId, userId: user.userData.id, label: 'tag', badgeable: '' })
            expect(item).toMatchObject({
                id: itemId, listId, userId: user.userData.id, title: 'offline item', tags: [tagId],
                posterPath: '1_poster.jpg', layout: [], header: { type: 'poster_inside', badges: [] },
                fav: false, trash: false, isTemplate: false,
            })
            expect(media).toMatchObject({ id: mediaId, itemId, userId: user.userData.id, path: '1_media.jpg', keywords: ['k'], type: 'image' })

            expect(existsSync(join(user.userDir, listId, itemId, 'thumbnails'))).toBe(true)

            // retrying the same create is idempotent
            const retry = await push(cookies, [
                op({ entity: 'lists', id: listId, type: 'upsert', data: { title: 'offline list' } }),
            ])
            expect(retry.body.results[0].status).toBe('applied')
            expect(retry.body.results[0].row.title).toBe('offline list')

            const { body: pulled } = await pull(cookies)
            expect(ids(pulled.changes.items)).toEqual([itemId])

            await user.delete()
        })

        test('rejects creates with missing required fields, bad paths or foreign references', async () => {
            const user = await $mockUser()
            const otherList = await $mockList()
            const { cookies } = await user.createCookie()
            const list = await $mockList(undefined, user)

            const { body } = await push(cookies, [
                op({ entity: 'lists', id: $generateShortID(), type: 'upsert', data: {} }),
                op({ entity: 'items', id: $generateShortID(), type: 'upsert', data: { title: 'x', listId: otherList.listData.id } }),
                op({ entity: 'items', id: $generateShortID(), type: 'upsert', data: { title: 'x', listId: list.listData.id, posterPath: '../../etc/passwd' } }),
                op({ entity: 'items', id: $generateShortID(), type: 'upsert', data: { title: 'x', listId: list.listData.id, layout: [[{ type: 'one_row', label: 'a' }, [{ type: 'link', label: 'l', url: 'u', logoPath: 'a/b.png' }]]] } }),
                op({ entity: 'items', id: 'bad-id', type: 'upsert', data: { title: 'x', listId: list.listData.id } }),
                op({ entity: 'tags', id: $generateShortID(), type: 'upsert', data: { label: 'x', listId: list.listData.id } }),
                op({ entity: 'items', id: $generateShortID(), type: 'upsert', data: { title: 'valid', listId: list.listData.id } }),
            ])

            const statuses = body.results.map((r: any) => r.status)
            expect(statuses).toEqual(['rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'created'])
            body.results.slice(0, 6).forEach((r: any) => expect(typeof r.error).toBe('string'))

            await otherList.delete()
            await user.delete()
        })

        test('rejects ops on another user\'s rows', async () => {
            const user = await $mockUser()
            const { cookies } = await user.createCookie()
            const other = await $mockItem({ title: 'not yours' })

            const { body } = await push(cookies, [
                op({ entity: 'items', id: other.itemData.id, type: 'upsert', data: { title: 'hacked' }, base: { title: 'not yours' } }),
                op({ entity: 'items', id: other.itemData.id, type: 'upsert', data: { title: 'hacked' } }),
                op({ entity: 'items', id: other.itemData.id, type: 'delete' }),
            ])

            expect(body.results.map((r: any) => r.status)).toEqual(['rejected', 'rejected', 'rejected'])
            const [item] = await $getItem(other.userMock.userData.id, other.itemData.id)
            expect(item.title).toBe('not yours')

            await other.delete()
            await user.delete()
        })

        test('non-conflicting concurrent edits of different fields both survive', async () => {
            const user = await $mockUser()
            const item = await $mockItem({ title: 'title', description: 'description' }, user)
            const { cookies } = await user.createCookie()

            // edited on the web
            await $updateItems(user.userData.id, item.itemData.id, { title: 'web title', updatedAt: new Date() })

            // edited offline, based on the old values
            const { body } = await push(cookies, [op({
                entity: 'items', id: item.itemData.id, type: 'upsert', ts: 0,
                data: { description: 'mobile description' },
                base: { description: 'description' },
            })])

            expect(body.results[0].status).toBe('applied')
            expect(body.results[0].row).toMatchObject({ title: 'web title', description: 'mobile description' })

            await user.delete()
        })

        test('conflicting edits of the same field are resolved by ts (last writer wins)', async () => {
            const user = await $mockUser()
            const item = await $mockItem({ title: 'title' }, user)
            const { cookies } = await user.createCookie()

            await $updateItems(user.userData.id, item.itemData.id, { title: 'web title', updatedAt: new Date() })

            // older edit loses
            const older = await push(cookies, [op({
                entity: 'items', id: item.itemData.id, type: 'upsert', ts: Date.now() - 60_000,
                data: { title: 'old mobile title' }, base: { title: 'title' },
            })])
            expect(older.body.results[0].status).toBe('merged')
            expect(older.body.results[0].row.title).toBe('web title')

            // newer edit wins
            const newer = await push(cookies, [op({
                entity: 'items', id: item.itemData.id, type: 'upsert', ts: Date.now() + 60_000,
                data: { title: 'new mobile title' }, base: { title: 'title' },
            })])
            expect(newer.body.results[0].status).toBe('merged')
            expect(newer.body.results[0].row.title).toBe('new mobile title')

            await user.delete()
        })

        test('tags arrays are merged as sets', async () => {
            const user = await $mockUser()
            const item = await $mockItem({ tags: ['t1', 't2'] }, user)
            const { cookies } = await user.createCookie()

            await $updateItems(user.userData.id, item.itemData.id, { tags: ['t1', 't2', 'web'], updatedAt: new Date() })

            const { body } = await push(cookies, [op({
                entity: 'items', id: item.itemData.id, type: 'upsert', ts: 0,
                data: { tags: ['t2', 'mobile'] }, base: { tags: ['t1', 't2'] },
            })])

            expect(body.results[0].status).toBe('merged')
            expect(body.results[0].row.tags).toEqual(['t2', 'web', 'mobile'])

            await user.delete()
        })

        test('updates lists, tags and media and bumps updatedAt', async () => {
            const user = await $mockUser()
            const list = await $mockList({ title: 'list', updatedAt: new Date(2000, 1) }, user)
            const tag = await $mockTag({ label: 'tag' }, list)
            const item = await $mockItem(undefined, list)
            const media = await $mockItemMedia({ title: 'media', keywords: ['a'] }, item)
            const { cookies } = await user.createCookie()

            const { body } = await push(cookies, [
                op({ entity: 'lists', id: list.listData.id, type: 'upsert', data: { trash: true, configs: { titlePlacement: 'hidden' } }, base: { trash: false, configs: list.listData.configs } }),
                op({ entity: 'tags', id: tag.tagData.id, type: 'upsert', data: { label: 'renamed', groupName: 'group' }, base: { label: 'tag', groupName: null } }),
                op({ entity: 'media', id: media.mediaData.id, type: 'upsert', data: { keywords: ['a', 'b'], path: 'ignored.jpg' }, base: { keywords: ['a'] } }),
            ])

            expect(body.results.map((r: any) => r.status)).toEqual(['applied', 'applied', 'applied'])
            expect(body.results[0].row).toMatchObject({ trash: true, configs: { titlePlacement: 'hidden' } })
            expect(new Date(body.results[0].row.updatedAt).getFullYear()).toBeGreaterThan(2000)
            expect(body.results[1].row).toMatchObject({ label: 'renamed', groupName: 'group' })
            expect(body.results[2].row).toMatchObject({ keywords: ['a', 'b'], path: media.mediaData.path })

            const [dbList] = await $getList(user.userData.id, list.listData.id)
            expect(dbList.trash).toBe(true)

            await user.delete()
        })

        test('deletes the old poster when it is replaced', async () => {
            const user = await $mockUser()
            const item = await $mockItem({ poster: true }, user)
            const { cookies } = await user.createCookie()
            const oldPoster = item.itemData.posterPath as string
            expect(existsSync(join(item.itemDir, oldPoster))).toBe(true)

            const { body } = await push(cookies, [op({
                entity: 'items', id: item.itemData.id, type: 'upsert',
                data: { posterPath: '2_new.jpg' }, base: { posterPath: oldPoster },
            })])

            expect(body.results[0].row.posterPath).toBe('2_new.jpg')
            expect(existsSync(join(item.itemDir, oldPoster))).toBe(false)

            await user.delete()
        })

        test('upsert on a row deleted on the server => gone', async () => {
            const user = await $mockUser()
            const item = await $mockItem(undefined, user)
            const { cookies } = await user.createCookie()

            await push(cookies, [op({ entity: 'items', id: item.itemData.id, type: 'delete' })])

            const { body } = await push(cookies, [op({
                entity: 'items', id: item.itemData.id, type: 'upsert',
                data: { title: 'edited offline' }, base: { title: item.itemData.title },
            })])

            expect(body.results[0].status).toBe('gone')
            expect(await $getItem(user.userData.id, item.itemData.id)).toEqual([])

            await user.delete()
        })

        test('delete op deletes permanently, a missing row => gone', async () => {
            const user = await $mockUser()
            const item = await $mockItem(undefined, user)
            const media = await $mockItemMedia(undefined, item)
            const { cookies } = await user.createCookie()

            const { body: snapshot } = await pull(cookies)

            const { body } = await push(cookies, [
                op({ entity: 'media', id: media.mediaData.id, type: 'delete' }),
                op({ entity: 'items', id: item.itemData.id, type: 'delete' }),
                op({ entity: 'items', id: item.itemData.id, type: 'delete' }),
                op({ entity: 'tags', id: $generateLongID(), type: 'delete' }),
            ])

            expect(body.results.map((r: any) => r.status)).toEqual(['deleted', 'deleted', 'gone', 'gone'])
            expect(body.results[0].opId).toMatch(/^op-/)
            expect(await $getItem(user.userData.id, item.itemData.id)).toEqual([])
            expect(existsSync(join(item.itemDir, media.mediaData.path))).toBe(false)
            expect(existsSync(item.itemDir)).toBe(false)

            const { body: pulled } = await pull(cookies, snapshot.cursor)
            expect(pulled.deleted.items).toEqual([item.itemData.id])
            expect(pulled.deleted.media).toEqual([media.mediaData.id])

            await user.delete()
        })

        test('returns 400 for a malformed body', async () => {
            const user = await $mockUser()
            const { cookies } = await user.createCookie()

            const { statusCode } = await $mockHttp(syncHandler).post({ notOps: true }, { cookies })
            expect(statusCode).toBe(400)

            await user.delete()
        })
    })
})
