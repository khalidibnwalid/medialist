import { TagData } from "@/utils/types/global";
import { ItemHeader, ItemLayoutTab, ExtractorConfig } from "@/utils/types/item";
import { ListData } from "@/utils/types/list";
import { MediaData } from "@/utils/types/media";
import { InferSelectModel, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// primary keys and unique columns are all autoindexed by sqlite
export const usersTable = sqliteTable("users", {
    id: text("id")
        .notNull()
        .primaryKey(),
    username: text("username")
        .notNull()
        .unique(),
    passwordHash: text("password_hash")
        .notNull(),
    role: text("role", { enum: ["user", "admin"] })
        .notNull()
        .default("user")
        .$type<"user" | "admin">(),
    createdAt: integer("created_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
});

export const sessionsTable = sqliteTable("sessions", {
    id: text("id")
        .notNull()
        .primaryKey(),
    userId: text("user_id")
        .references(() => usersTable.id, { onDelete: "set null" }),
    agent: text("agent_json", { mode: "json" })
        .notNull()
        .default("{}"),
    expiresAt: integer("expires_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
    createdAt: integer("created_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
}, (table) => [
    index("sessions_user_id_idx").on(table.userId),
]);

export const listsTable = sqliteTable("lists", {
    id: text("id")
        .notNull()
        .primaryKey(),
    userId: text("user_id")
        .references(() => usersTable.id, { onDelete: "set null" }),
    title: text("title")
        .notNull(),
    coverPath: text("cover_path"),
    configs: text("configs_json", { mode: "json" })
        .notNull()
        .default("{}")
        .$type<ListData['configs']>(),
    trash: integer("trash", { mode: "boolean" })
        .notNull()
        .default(false),
    createdAt: integer("created_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
    // fav: integer("fav", { mode: "boolean" }).notNull().default(false),
    // templates: text("templates").notNull().default("[]"), // JSON string
    // apis: text("templates").notNull().default("[]"), // JSON string
}, (table) => [
    index("lists_user_id_trash_idx").on(table.userId, table.trash),
]);

export const itemsTable = sqliteTable("items", {
    id: text("id")
        .notNull()
        .primaryKey(),
    userId: text("user_id")
        .references(() => usersTable.id, { onDelete: "set null" }),
    listId: text("list_id")
        .references(() => listsTable.id, { onDelete: "set null" }),
    title: text("title")
        .notNull(),
    posterPath: text("poster_path"),
    coverPath: text("cover_path"),
    description: text("description"),
    trash: integer("trash", { mode: "boolean" })
        .notNull()
        .default(false),
    tags: text("tags_ids_json", { mode: "json" })
        .default([])
        .$type<string[]>(),
    layout: text("layout_json", { mode: "json" })
        .default([])
        .$type<ItemLayoutTab[]>(),
    header: text("header_json", { mode: "json" })
        .default({})
        .$type<ItemHeader>(),
    extractor: text("extractor_json", { mode: "json" })
        .$type<ExtractorConfig>(),
    createdAt: integer("created_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
    fav: integer("fav", { mode: "boolean" })
        .notNull()
        .default(false),
    isTemplate: integer("is_template", { mode: "boolean" })
        .notNull()
        .default(false),
    // templates: text("templates").notNull().default("[]"), // JSON string
    // configs: text("templates").notNull().default("[]"), // JSON string
    // apis: text("templates").notNull().default("[]"), // JSON string
}, (table) => [
    index("items_active_user_list_idx")
        .on(table.userId, table.listId)
        .where(sql`trash = false AND is_template = false`),
    index("items_user_template_idx")
        .on(table.userId)
        .where(sql`is_template = true`),
]);

export const listsTagsTable = sqliteTable("lists_tags", {
    id: text("id")
        .notNull()
        .primaryKey(),
    listId: text("list_id")
        .references(() => listsTable.id, { onDelete: "set null" }),
    userId: text("user_id")
        .references(() => usersTable.id, { onDelete: "set null" }),
    label: text("label")
        .notNull(),
    description: text("description"),
    groupName: text("group_name"),
    badgeable: text("badgeable")
        .default('')
        .$type<TagData['badgeable']>(),
    createdAt: integer("created_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
}, (table) => [
    index("lists_tags_user_list_idx").on(table.userId, table.listId),
]);

export const itemsMedia = sqliteTable("items_media", {
    id: text("id")
        .notNull()
        .primaryKey(),
    itemId: text("item_id")
        .references(() => itemsTable.id, { onDelete: "set null" }),
    userId: text("user_id")
        .references(() => usersTable.id, { onDelete: "set null" }),
    title: text("title"),
    keywords: text("json_keywords", { mode: "json" })
        .notNull()
        .default("[]")
        .$type<string[]>(),
    path: text("path")
        .notNull(),
    type: text("type")
        .notNull()
        .default("image")
        .$type<MediaData['type']>(),
    createdAt: integer("created_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", {
        mode: "timestamp"
    }).notNull()
        .default(sql`(unixepoch())`),
}, (table) => [
    index("items_media_user_item_idx").on(table.userId, table.itemId),
]);

export type User = InferSelectModel<typeof usersTable>;
export type Session = InferSelectModel<typeof sessionsTable>;