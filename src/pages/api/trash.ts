import { db } from '@/server/db';
import { $deleteItems, $updateItems } from '@/server/db/queries/items';
import { $deleteLists, $updateLists } from '@/server/db/queries/lists';
import { itemsTable, listsTable } from '@/server/db/schema';
import { $validateAuthCookies } from '@/server/utils/auth/cookies';
import $deleteFolder from '@/server/utils/file/deleteFolder';
import $getDir from '@/server/utils/file/getDir';
import { validateShortID } from '@/utils/lib/generateID';
import { ApiCode, ApiErrorCode } from '@/utils/types/serverResponse';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/sqlite-core';
import type { NextApiRequest, NextApiResponse } from 'next';

interface RequestData { items: string[], lists: string[] }

/** api/trash/
 * Get: Get all deleted items & lists
 * Delete: delete selected items & lists as provided in RequestData
 * Patch: restore selected items & lists as provided in RequestData
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { user } = await $validateAuthCookies(req, res);
        if (!user) return res.status(401).json({ errorCode: ApiErrorCode.UNAUTHORIZED })

        if (req.method === 'GET') {
            const listsAndItems = await getTrash(user.id)
            return res.status(200).json(listsAndItems);
        }

        if (req.method === 'DELETE') {
            const { items, lists }: RequestData = JSON.parse(req.body);
            if (!Array.isArray(items) && !Array.isArray(lists))
                return res.status(400).json(BAD_REQUEST)

            if (items?.some(id => !validateShortID(id)) || lists?.some(id => !validateShortID(id)))
                return res.status(400).json(BAD_REQUEST)

            const trashDb = await getTrash(user.id, items, lists)
            if (!trashDb.length) return res.status(400).json(BAD_REQUEST)

            if (items && items?.length !== trashDb.filter(item => item.listId).length ||
                lists && lists?.length !== trashDb.filter(list => !list.listId).length
            )
                return res.status(400).json(BAD_REQUEST)
            // folder structure: /users/:userId/:listId/:itemId, thus we just need to delete the folders
            let TrustedlistsIDs = new Set<string>([])

            if (lists?.length) {
                const deletedLists = await $deleteLists(user.id, lists)

                TrustedlistsIDs = new Set<string>(deletedLists.map(list => list.id))

                deletedLists.forEach(async list => {
                    const dir = await $getDir(user.id, list.id)
                    const listDir = dir.list
                    $deleteFolder(listDir)
                })
            }

            if (items?.length) {
                const deletedItems = await $deleteItems(user.id, items)

                deletedItems.forEach(async item => {
                    // if the list is already deleted
                    if (TrustedlistsIDs.has(item.listId!)) return

                    const dir = await $getDir(user.id, item.listId!, item.id)
                    const itemDir = dir.item as string
                    $deleteFolder(itemDir)
                })
            }

            return res.status(200).json({ code: ApiCode.DESTROYED });
        }

        if (req.method === 'PATCH') {
            const { items, lists }: RequestData = JSON.parse(req.body);

            if (!Array.isArray(items) && !Array.isArray(lists))
                return res.status(400).json(BAD_REQUEST)

            if (items?.some(id => !validateShortID(id)) || lists?.some(id => !validateShortID(id)))
                return res.status(400).json(BAD_REQUEST)

            const trashDb = await getTrash(user.id, items, lists)
            if (!trashDb.length) return res.status(400).json(BAD_REQUEST)

            if (items && items?.length !== trashDb.filter(item => item.listId).length ||
                lists && lists?.length !== trashDb.filter(list => !list.listId).length
            )
                return res.status(400).json(BAD_REQUEST)

            let itemsData;
            let listsData;

            const updatedAt = new Date(Date.now())

            if (lists?.length)
                listsData = await $updateLists(user.id, lists, { trash: false, updatedAt })

            if (items?.length)
                itemsData = await $updateItems(user.id, items, { trash: false, updatedAt })

            return res.status(200).json({ items: itemsData || [], lists: listsData || [] });
        }

        res.status(405).json({ errorCode: ApiErrorCode.METHOD_NOT_ALLOWED })
    } catch (error) {
        console.log("[Error] api/lists: ", error)
        res.status(500).json({ errorCode: ApiErrorCode.INTERNAL_SERVER_ERROR })
    }
}

const getTrash = async (userId: string, itemsIDs?: string[], listIDs?: string[]) => {

    let andReqItems = [
        eq(itemsTable.userId, userId),
        eq(itemsTable.trash, true),
    ]
    if (itemsIDs) andReqItems.push(inArray(itemsTable.id, itemsIDs))

    let andReqLists = [
        eq(listsTable.userId, userId),
        eq(listsTable.trash, true),
    ]
    if (listIDs) andReqLists.push(inArray(listsTable.id, listIDs))

    const items = db.select({
        id: itemsTable.id,
        listId: itemsTable.listId,
        title: itemsTable.title,
        coverPath: itemsTable.posterPath,
        updatedAt: itemsTable.updatedAt,
    }).from(itemsTable).where(and(...andReqItems))

    const lists = db.select({
        id: listsTable.id,
        listId: sql`NULL`.as('listId'),
        title: listsTable.title,
        coverPath: listsTable.coverPath,
        updatedAt: listsTable.updatedAt,
    }).from(listsTable).where(and(...andReqLists))

    const listsAndItems = await unionAll(lists, items).orderBy(desc(itemsTable.updatedAt))

    return listsAndItems;
}

const BAD_REQUEST = { errorCode: ApiErrorCode.BAD_REQUEST }