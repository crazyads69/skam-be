CREATE TABLE `scammer_stats` (
	`account_number` text PRIMARY KEY NOT NULL,
	`scammer_name` text NOT NULL,
	`bank_account_name` text NOT NULL,
	`bank_code` text NOT NULL,
	`bank_name` text NOT NULL,
	`total_cases` integer DEFAULT 0 NOT NULL,
	`total_amount_lost` integer DEFAULT 0 NOT NULL,
	`average_amount_lost` integer DEFAULT 0 NOT NULL,
	`first_reported_at` integer NOT NULL,
	`last_reported_at` integer NOT NULL,
	`last_updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_stats_scammer_name` ON `scammer_stats` (`scammer_name`);--> statement-breakpoint
CREATE INDEX `idx_stats_bank_account_name` ON `scammer_stats` (`bank_account_name`);--> statement-breakpoint
CREATE INDEX `idx_stats_bank_code` ON `scammer_stats` (`bank_code`);--> statement-breakpoint
CREATE INDEX `idx_stats_total_cases` ON `scammer_stats` (`total_cases`);--> statement-breakpoint
CREATE INDEX `idx_stats_total_amount` ON `scammer_stats` (`total_amount_lost`);--> statement-breakpoint
CREATE INDEX `idx_stats_last_reported` ON `scammer_stats` (`last_reported_at`);--> statement-breakpoint
CREATE INDEX `idx_account_status` ON `scam_cases` (`account_number`,`status`);