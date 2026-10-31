CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text NOT NULL,
	CONSTRAINT `group_members_pk` PRIMARY KEY(`group_id`, `user_id`),
	CONSTRAINT `fk_group_members_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_group_members_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `group_members_user_id_idx` ON `group_members` (`user_id`);