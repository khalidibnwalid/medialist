import { and, eq, inArray } from "drizzle-orm";
import { db } from "..";
import { itemsTable, listsTagsTable, listsTable } from "../schema";
import { $deleteItems } from "./items";
import { $logRowsChanges } from "./sync";

export const $getLists = async (userId: string, trash?: boolean) => {
    let rules = [eq(listsTable.userId, userId)]
    if (typeof trash === 'boolean') rules.push(eq(listsTable.trash, trash))
    return await db
        .select()
        .from(listsTable)
        .where(and(...rules))
        .orderBy(trash ? listsTable.updatedAt : listsTable.title);
}


export const $getList = async (userId: string, listId: string) =>
    await db
        .select()
        .from(listsTable)
        .where(and(
            eq(listsTable.userId, userId),
            eq(listsTable.id, listId)
        )).limit(1);

export const $createLists = async (data: typeof listsTable.$inferInsert[] | typeof listsTable.$inferInsert) => {
    const rows = await db
        .insert(listsTable)
        .values(Array.isArray(data) ? data : [data])
        .returning();
    await $logRowsChanges('lists', rows)
    return rows
}

export const $updateLists = async (userId: string, listIDs: string | string[], data: Partial<typeof listsTable.$inferInsert>) => {
    listIDs = Array.isArray(listIDs) ? listIDs : [listIDs]
    const rows = await db
        .update(listsTable)
        .set(data)
        .where(and(
            eq(listsTable.userId, userId),
            inArray(listsTable.id, listIDs),
        )).limit(listIDs.length)
        .returning();
    await $logRowsChanges('lists', rows)
    return rows
}

export const $deleteLists = async (userId: string, listsIDs: string[]) => {
    const itemsToDelete = await db.select({ id: itemsTable.id }).from(itemsTable).where(and(
        eq(itemsTable.userId, userId),
        inArray(itemsTable.listId, listsIDs)
    ))

    // $deleteItems logs the deletion of the items and their media
    if (itemsToDelete.length > 0) {
        const ids = itemsToDelete.map(i => i.id)
        await $deleteItems(userId, ids)
    }

    const deletedTags = await db.delete(listsTagsTable).where(and(
        eq(listsTagsTable.userId, userId),
        inArray(listsTagsTable.listId, listsIDs)
    )).returning({
        id: listsTagsTable.id,
        userId: listsTagsTable.userId,
    })
    await $logRowsChanges('tags', deletedTags)

    const rows = await db
        .delete(listsTable)
        .where(and(
            eq(listsTable.userId, userId),
            inArray(listsTable.id, listsIDs),
        )).limit(listsIDs.length)
        .returning({
            id: listsTable.id,
            userId: listsTable.userId,
        });
    await $logRowsChanges('lists', rows)
    return rows
}
