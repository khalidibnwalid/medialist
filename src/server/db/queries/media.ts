import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "..";
import { itemsMedia } from "../schema";
import { $logRowsChanges } from "./sync";

export const $getItemMedia = async (userId: string, item_id: string) => {
    return await db
        .select()
        .from(itemsMedia)
        .where(and(
            eq(itemsMedia.userId, userId),
            eq(itemsMedia.itemId, item_id)
        )).orderBy(desc(itemsMedia.createdAt))
}

export const $getItemMediaById = async (userId: string, id: string) => {
    return await db
        .select()
        .from(itemsMedia)
        .where(and(
            eq(itemsMedia.userId, userId),
            eq(itemsMedia.id, id)
        ))
}

export const $createItemMedia = async (data: typeof itemsMedia.$inferInsert[] | typeof itemsMedia.$inferInsert) => {
    const rows = await db
        .insert(itemsMedia)
        .values(Array.isArray(data) ? data : [data])
        .returning();
    await $logRowsChanges('media', rows)
    return rows
}

export const $updateItemMedia = async (userId: string, id: string, data: Partial<typeof itemsMedia.$inferInsert>) => {
    const rows = await db
        .update(itemsMedia)
        .set(data)
        .where(and(
            eq(itemsMedia.userId, userId),
            eq(itemsMedia.id, id),
        )).limit(1)
        .returning();
    await $logRowsChanges('media', rows)
    return rows
}

export const $deleteItemMedia = async (userId: string, ids: string[] | string) => {
    if (!Array.isArray(ids)) ids = [ids];
    const rows = await db
        .delete(itemsMedia)
        .where(and(
            eq(itemsMedia.userId, userId),
            inArray(itemsMedia.id, ids),
        )).limit(ids.length)
        .returning();
    await $logRowsChanges('media', rows)
    return rows
}
