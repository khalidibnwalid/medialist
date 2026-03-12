PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_items`(
		"id",
		"user_id",
		"list_id",
		"title",
		"poster_path",
		"cover_path",
		"description",
		"trash",
		"tags_ids_json",
		"layout_json",
		"header_json",
		"created_at",
		"updated_at",
		"fav"
	)
SELECT "id",
	"user_id",
	"list_id",
	"title",
	"poster_path",
	"cover_path",
	"description",
	"trash",
	"tags_ids_json",
	"layout_json",
	"header_json",
	"created_at",
	"updated_at",
	"fav"
FROM `items`;
--> statement-breakpoint
DROP TABLE `items`;
--> statement-breakpoint
ALTER TABLE `__new_items`
	RENAME TO `items`;
--> statement-breakpoint
PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE INDEX `items_active_user_list_idx` ON `items` (`user_id`, `list_id`)
WHERE trash = false
	AND is_template = false;
--> statement-breakpoint
CREATE INDEX `items_user_template_idx` ON `items` (`user_id`)
WHERE is_template = true;