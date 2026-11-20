import { ItemsFilters } from "@/utils/lib/itemsPagination";
import { and, asc, count, eq, gt, inArray, or, SQL, sql } from "drizzle-orm";
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

/** a page of the (title, id) ordered, non-trashed items of a list (keyset pagination)
 * @param after the (title, id) of the last item of the previous page
 * @param limit no limit if not provided
 * @returns `limit + 1` rows at most, the extra row tells that there is a next page */
export const $getItemsPage = async (
    userId: string,
    listId: string,
    { limit, after, filters = {} }: {
        limit?: number,
        after?: { title: string, id: string } | null,
        filters?: ItemsFilters
    }
) => {
    const rules = $itemsFiltersRules(userId, listId, filters)
    if (after) rules.push(or(
        gt(itemsTable.title, after.title),
        and(eq(itemsTable.title, after.title), gt(itemsTable.id, after.id))
    )!)

    const query = db
        .select()
        .from(itemsTable)
        .where(and(...rules))
        .orderBy(asc(itemsTable.title), asc(itemsTable.id))
        .$dynamic()
    return await (limit === undefined ? query : query.limit(limit + 1));
}

/** count of the non-trashed items of a list that match the filters */
export const $countItems = async (userId: string, listId: string, filters: ItemsFilters = {}) => {
    const [row] = await db
        .select({ count: count() })
        .from(itemsTable)
        .where(and(...$itemsFiltersRules(userId, listId, filters)));
    return row?.count ?? 0
}

function $itemsFiltersRules(userId: string, listId: string, { q, tags, fav }: ItemsFilters) {
    const rules: SQL[] = [
        eq(itemsTable.userId, userId),
        eq(itemsTable.listId, listId),
        eq(itemsTable.trash, false),
        eq(itemsTable.isTemplate, false),
    ]
    if (fav) rules.push(eq(itemsTable.fav, true))
    // LIKE is case-insensitive for ASCII in SQLite, the wildcards (% _) and the escape char (\) are escaped
    if (q) rules.push(sql`${itemsTable.title} LIKE ${'%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%'} ESCAPE '\\'`)
    // tags are stored as a JSON array of ids, the item must have all of them
    tags?.forEach(tagId => rules.push(
        sql`EXISTS (SELECT 1 FROM json_each(${itemsTable.tags}) WHERE json_each.value = ${tagId})`
    ))
    return rules
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
