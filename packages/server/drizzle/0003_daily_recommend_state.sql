CREATE TABLE `daily_recommend_state` (
	`id` text PRIMARY KEY NOT NULL,
	`published_day` text NOT NULL,
	`source_day` text NOT NULL,
	`note_id` text,
	`manual` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_recommend_state_published_day_unique` ON `daily_recommend_state` (`published_day`);
