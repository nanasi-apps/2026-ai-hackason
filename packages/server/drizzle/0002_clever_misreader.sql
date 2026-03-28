CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`note_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `notes` ADD `recommend_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `notes` ADD `is_unlocked` integer DEFAULT false NOT NULL;
