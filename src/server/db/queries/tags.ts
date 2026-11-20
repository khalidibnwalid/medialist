import { and, eq, inArray } from "drizzle-orm";
import { db } from "..";
import { listsTagsTable } from "../schema";
import { $logRowsChanges } from "./sync";

export const $getTags = async (userId: string, listId: string) =>
    await db
        .select()
        .from(listsTagsTable)
        .where(and(
            eq(listsTagsTable.userId, userId),
            eq(listsTagsTable.listId, listId),
        ))

export const $getTag = async (userId: string, tagId: string) =>
    await db
        .select()
        .from(listsTagsTable)
        .where(and(
            eq(listsTagsTable.userId, userId),
            eq(listsTagsTable.id, tagId),
        )).limit(1)

export const $createTags = async (data: typeof listsTagsTable.$inferInsert[] |  typeof listsTagsTable.$inferInsert) => {
    const rows = await db
        .insert(listsTagsTable)
        .values(Array.isArray(data) ? data : [data])
        .returning()
    await $logRowsChanges('tags', rows)
    return rows
}

export const $updateTag = async (userId: string, tagId: string, data: Partial<typeof listsTagsTable.$inferInsert>) => {
    const rows = await db
        .update(listsTagsTable)
        .set(data)
        .where(and(
            eq(listsTagsTable.userId, userId),
            eq(listsTagsTable.id, tagId),
        )).limit(1)
        .returning()
    await $logRowsChanges('tags', rows)
    return rows
}

export const $deleteTags = async (userId: string, tagId: string | string[]) => {
    tagId = Array.isArray(tagId) ? tagId : [tagId]
    const rows = await db
        .delete(listsTagsTable)
        .where(and(
            eq(listsTagsTable.userId, userId),
            inArray(listsTagsTable.id, tagId),
        )).limit(tagId.length)
        .returning()
    await $logRowsChanges('tags', rows)
    return rows
}
