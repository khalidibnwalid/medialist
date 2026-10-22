import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "..";
import { SyncEntity, syncChangesTable } from "../schema";

const MAX_ROWS_PER_INSERT = 500;

/** appends a change entry per id to the sync log, so offline clients can pull it (api/sync) */
export const $logChanges = async (userId: string, entity: SyncEntity, ids: string | string[]) => {
    ids = Array.isArray(ids) ? ids : [ids]
    if (!userId || ids.length === 0) return

    const createdAt = new Date(Date.now())
    const rows = ids.map(entityId => ({ userId, entity, entityId, createdAt }))

    for (let i = 0; i < rows.length; i += MAX_ROWS_PER_INSERT)
        await db.insert(syncChangesTable).values(rows.slice(i, i + MAX_ROWS_PER_INSERT))
}

/** logs rows returned by insert/update/delete queries, grouped by their owner */
export const $logRowsChanges = async (entity: SyncEntity, rows: { id: string, userId: string | null }[]) => {
    const byUser = new Map<string, string[]>()
    rows.forEach(row => {
        if (!row.userId) return
        const ids = byUser.get(row.userId) || []
        ids.push(row.id)
        byUser.set(row.userId, ids)
    })

    for (const [userId, ids] of byUser)
        await $logChanges(userId, entity, ids)
}

/** the latest seq of a user, 0 if none */
export const $getSyncCursor = async (userId: string) => {
    const [row] = await db
        .select({ seq: syncChangesTable.seq })
        .from(syncChangesTable)
        .where(eq(syncChangesTable.userId, userId))
        .orderBy(desc(syncChangesTable.seq))
        .limit(1)
    return row?.seq ?? 0
}

/** distinct changed entities after a cursor, ordered by their latest change */
export const $getChangedEntities = async (userId: string, since: number, limit: number) => {
    const seq = sql<number>`max(${syncChangesTable.seq})`.as('max_seq')
    const sub = db
        .select({
            entity: syncChangesTable.entity,
            entityId: syncChangesTable.entityId,
            seq,
        })
        .from(syncChangesTable)
        .where(and(
            eq(syncChangesTable.userId, userId),
            gt(syncChangesTable.seq, since),
        ))
        .groupBy(syncChangesTable.entity, syncChangesTable.entityId)
        .as('changed')

    return await db
        .select()
        .from(sub)
        .orderBy(asc(sub.seq))
        .limit(limit)
}
