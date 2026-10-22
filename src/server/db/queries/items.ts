import { and, eq, inArray } from "drizzle-orm";
import { db } from "..";
import { itemsMedia, itemsTable } from "../schema";
import { $logRowsChanges } from "./sync";

export const $getItems = async (userId: string, listId: string | null, trash: boolean = false, isTemplate: boolean = false) => {
    let rules = [
        eq(itemsTable.userId, userId),
        eq(itemsTable.trash, trash),
        eq(itemsTable.isTemplate, isTemplate)
    ]
    if (listId) rules.push(eq(itemsTable.listId, listId))
    return await db
        .select()
        .from(itemsTable)
        .where(and(...rules))
        .orderBy(trash ? itemsTable.updatedAt : itemsTable.title);
}

export const $getItem = async (userId: string, itemId: string) =>
    await db
        .select()
        .from(itemsTable)
        .where(and(
            eq(itemsTable.userId, userId),
            eq(itemsTable.id, itemId)
        )).limit(1);

export const $createItems = async (data: typeof itemsTable.$inferInsert[] | typeof itemsTable.$inferInsert) => {
    const rows = await db
        .insert(itemsTable)
        .values(Array.isArray(data) ? data : [data])
        .returning();
    await $logRowsChanges('items', rows)
    return rows
}

export const $updateItems = async (userId: string, itemIDs: string | string[], data: Partial<typeof itemsTable.$inferInsert>) => {
    itemIDs = Array.isArray(itemIDs) ? itemIDs : [itemIDs]
    const rows = await db
        .update(itemsTable)
        .set(data)
        .where(and(
            eq(itemsTable.userId, userId),
            inArray(itemsTable.id, itemIDs),
        )).limit(itemIDs.length)
        .returning();
    await $logRowsChanges('items', rows)
    return rows
}

export const $deleteItems = async (userId: string, itemsIDs: string[]) => {
    const deletedMedia = await db.delete(itemsMedia).where(and(
        eq(itemsMedia.userId, userId),
        inArray(itemsMedia.itemId, itemsIDs)
    )).returning({
        id: itemsMedia.id,
        userId: itemsMedia.userId,
    })
    await $logRowsChanges('media', deletedMedia)

    const rows = await db
        .delete(itemsTable)
        .where(and(
            eq(itemsTable.userId, userId),
            inArray(itemsTable.id, itemsIDs),
        )).limit(itemsIDs.length)
        .returning({
            id: itemsTable.id,
            listId: itemsTable.listId,
            userId: itemsTable.userId,
        })
    await $logRowsChanges('items', rows)
    return rows
}
