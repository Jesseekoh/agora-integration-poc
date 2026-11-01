CREATE TABLE `call_participants` (
	`call_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`joined_at` text,
	`created_at` text NOT NULL,
	CONSTRAINT `call_participants_pk` PRIMARY KEY(`call_id`, `user_id`),
	CONSTRAINT `fk_call_participants_call_id_calls_id_fk` FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_call_participants_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `call_participants_user_id_created_at_idx` ON `call_participants` (`user_id`,`created_at`);