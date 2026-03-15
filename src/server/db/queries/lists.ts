import { and, eq, inArray } from "drizzle-orm";
import { db } from "..";
import { itemsTable, listsTagsTable, listsTable, itemsMedia } from "../schema";
import { $deleteItems } from "./items";

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

export const $createLists = async (data: typeof listsTable.$inferInsert[] | typeof listsTable.$inferInsert) =>
    await db
        .insert(listsTable)
        .values(Array.isArray(data) ? data : [data])
        .returning();

export const $updateLists = async (userId: string, listIDs: string | string[], data: Partial<typeof listsTable.$inferInsert>) => {
    listIDs = Array.isArray(listIDs) ? listIDs : [listIDs]
    return await db
        .update(listsTable)
        .set(data)
        .where(and(
            eq(listsTable.userId, userId),
            inArray(listsTable.id, listIDs),
        )).limit(listIDs.length)
        .returning();
}

export const $deleteLists = async (userId: string, listsIDs: string[]) => {
    const itemsToDelete = await db.select({ id: itemsTable.id }).from(itemsTable).where(and(
        eq(itemsTable.userId, userId),
        inArray(itemsTable.listId, listsIDs)
    ))

    if (itemsToDelete.length > 0) {
        const ids = itemsToDelete.map(i => i.id)
        await $deleteItems(userId, ids)
    }

    await db.delete(listsTagsTable).where(and(
        eq(listsTagsTable.userId, userId),
        inArray(listsTagsTable.listId, listsIDs)
    ))

    return await db
        .delete(listsTable)
        .where(and(
            eq(listsTable.userId, userId),
            inArray(listsTable.id, listsIDs),
        )).limit(listsIDs.length)
        .returning({
            id: listsTable.id,
            userId: listsTable.userId,
        });
}
