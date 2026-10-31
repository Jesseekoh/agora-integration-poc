ALTER TABLE `calls` ADD `type` text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE `calls` ADD `group_id` text REFERENCES groups(id) ON DELETE CASCADE;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_calls` (
	`id` text PRIMARY KEY,
	`type` text DEFAULT 'direct' NOT NULL,
	`channel` text NOT NULL UNIQUE,
	`caller_id` text NOT NULL,
	`callee_id` text,
	`group_id` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_calls_caller_id_user_id_fk` FOREIGN KEY (`caller_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_calls_callee_id_user_id_fk` FOREIGN KEY (`callee_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_calls_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_calls`(`id`, `channel`, `caller_id`, `callee_id`, `status`, `created_at`, `updated_at`) SELECT `id`, `channel`, `caller_id`, `callee_id`, `status`, `created_at`, `updated_at` FROM `calls`;--> statement-breakpoint
DROP TABLE `calls`;--> statement-breakpoint
ALTER TABLE `__new_calls` RENAME TO `calls`;--> statement-breakpoint
PRAGMA foreign_keys=ON;