import { and, eq, inArray } from "drizzle-orm";
import { db } from "..";
import { itemsTable } from "../schema";

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

export const $createItems = async (data: typeof itemsTable.$inferInsert[] | typeof itemsTable.$inferInsert) =>
    await db
        .insert(itemsTable)
        .values(Array.isArray(data) ? data : [data])
        .returning();

export const $updateItems = async (userId: string, itemIDs: string | string[], data: Partial<typeof itemsTable.$inferInsert>) => {
    itemIDs = Array.isArray(itemIDs) ? itemIDs : [itemIDs]
    return await db
        .update(itemsTable)
        .set(data)
        .where(and(
            eq(itemsTable.userId, userId),
            inArray(itemsTable.id, itemIDs),
        )).limit(itemIDs.length)
        .returning();
}

export const $deleteItems = async (userId: string, itemsIDs: string[]) =>
    await db
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