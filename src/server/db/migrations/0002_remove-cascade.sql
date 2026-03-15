PRAGMA foreign_keys = OFF;
--> statement-breakpoint
-- 1. CREATE THE BACKUPS (SNAPSHOTS)
CREATE TABLE `bak_items_media` AS
SELECT *
FROM `items_media`;
--> statement-breakpoint
CREATE TABLE `bak_items` AS
SELECT *
FROM `items`;
--> statement-breakpoint
CREATE TABLE `bak_lists` AS
SELECT *
FROM `lists`;
--> statement-breakpoint
CREATE TABLE `bak_lists_tags` AS
SELECT *
FROM `lists_tags`;
--> statement-breakpoint
CREATE TABLE `bak_sessions` AS
SELECT *
FROM `sessions`;
--> statement-breakpoint
-- 2. RECONSTRUCT SCHEMAS (Metadata only)
CREATE TABLE `__new_items_media` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text,
	`user_id` text,
	`title` text,
	`json_keywords` text DEFAULT '[]' NOT NULL,
	`path` text NOT NULL,
	`type` text DEFAULT 'image' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE
	set null,
		FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE
	set null
);
--> statement-breakpoint
DROP TABLE `items_media`;
--> statement-breakpoint
ALTER TABLE `__new_items_media`
	RENAME TO `items_media`;
--> statement-breakpoint
CREATE INDEX `items_media_user_item_idx` ON `items_media` (`user_id`, `item_id`);
--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`list_id` text,
	`title` text NOT NULL,
	`poster_path` text,
	`cover_path` text,
	`description` text,
	`trash` integer DEFAULT false NOT NULL,
	`tags_ids_json` text DEFAULT '[]',
	`layout_json` text DEFAULT '[]',
	`header_json` text DEFAULT '{}',
	`extractor_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`fav` integer DEFAULT false NOT NULL,
	`is_template` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE
	set null,
		FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE
	set null
);
--> statement-breakpoint
DROP TABLE `items`;
--> statement-breakpoint
ALTER TABLE `__new_items`
	RENAME TO `items`;
--> statement-breakpoint
CREATE INDEX `items_active_user_list_idx` ON `items` (`user_id`, `list_id`)
WHERE trash = false
	AND is_template = false;
--> statement-breakpoint
CREATE INDEX `items_user_template_idx` ON `items` (`user_id`)
WHERE is_template = true;
--> statement-breakpoint
CREATE TABLE `__new_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`title` text NOT NULL,
	`cover_path` text,
	`configs_json` text DEFAULT '{}' NOT NULL,
	`trash` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE
	set null
);
--> statement-breakpoint
DROP TABLE `lists`;
--> statement-breakpoint
ALTER TABLE `__new_lists`
	RENAME TO `lists`;
--> statement-breakpoint
CREATE INDEX `lists_user_id_trash_idx` ON `lists` (`user_id`, `trash`);
--> statement-breakpoint
CREATE TABLE `__new_lists_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text,
	`user_id` text,
	`label` text NOT NULL,
	`description` text,
	`group_name` text,
	`badgeable` text DEFAULT '',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE
	set null,
		FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE
	set null
);
--> statement-breakpoint
DROP TABLE `lists_tags`;
--> statement-breakpoint
ALTER TABLE `__new_lists_tags`
	RENAME TO `lists_tags`;
--> statement-breakpoint
CREATE INDEX `lists_tags_user_list_idx` ON `lists_tags` (`user_id`, `list_id`);
--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`agent_json` text DEFAULT '{}' NOT NULL,
	`expires_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE
	set null
);
--> statement-breakpoint
DROP TABLE `sessions`;
--> statement-breakpoint
ALTER TABLE `__new_sessions`
	RENAME TO `sessions`;
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);
--> statement-breakpoint
-- 3. FINAL DATA RESTORATION FROM BACKUPS
PRAGMA foreign_keys = OFF;
--> statement-breakpoint
INSERT INTO `lists`
SELECT *
FROM `bak_lists`;
--> statement-breakpoint
INSERT INTO `lists_tags`
SELECT *
FROM `bak_lists_tags`;
--> statement-breakpoint
INSERT INTO `items`
SELECT *
FROM `bak_items`;
--> statement-breakpoint
INSERT INTO `items_media`
SELECT *
FROM `bak_items_media`;
--> statement-breakpoint
INSERT INTO `sessions`
SELECT *
FROM `bak_sessions`;
--> statement-breakpoint
-- 4. CLEANUP
DROP TABLE IF EXISTS `bak_items_media`;
--> statement-breakpoint
DROP TABLE IF EXISTS `bak_items`;
--> statement-breakpoint
DROP TABLE IF EXISTS `bak_lists`;
--> statement-breakpoint
DROP TABLE IF EXISTS `bak_lists_tags`;
--> statement-breakpoint
DROP TABLE IF EXISTS `bak_sessions`;
--> statement-breakpoint
PRAGMA foreign_keys = ON;