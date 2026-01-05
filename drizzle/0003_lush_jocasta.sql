DROP INDEX `idx_account_number`;--> statement-breakpoint
DROP INDEX `idx_account_status`;--> statement-breakpoint
ALTER TABLE `scam_cases` ADD `account_identifier` text NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_account_identifier` ON `scam_cases` (`account_identifier`);--> statement-breakpoint
CREATE INDEX `idx_account_bank` ON `scam_cases` (`account_identifier`,`bank_code`);--> statement-breakpoint
CREATE INDEX `idx_account_status` ON `scam_cases` (`account_identifier`,`status`);--> statement-breakpoint
ALTER TABLE `scam_cases` DROP COLUMN `account_number`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scammer_stats` (
	`account_identifier` text NOT NULL,
	`bank_code` text NOT NULL,
	`bank_name` text NOT NULL,
	`scammer_name` text NOT NULL,
	`bank_account_name` text NOT NULL,
	`total_cases` integer DEFAULT 0 NOT NULL,
	`total_amount_lost` integer DEFAULT 0 NOT NULL,
	`average_amount_lost` integer DEFAULT 0 NOT NULL,
	`first_reported_at` integer NOT NULL,
	`last_reported_at` integer NOT NULL,
	`last_updated_at` integer NOT NULL,
	PRIMARY KEY(`account_identifier`, `bank_code`)
);
--> statement-breakpoint
INSERT INTO `__new_scammer_stats`("account_identifier", "bank_code", "bank_name", "scammer_name", "bank_account_name", "total_cases", "total_amount_lost", "average_amount_lost", "first_reported_at", "last_reported_at", "last_updated_at") SELECT "account_identifier", "bank_code", "bank_name", "scammer_name", "bank_account_name", "total_cases", "total_amount_lost", "average_amount_lost", "first_reported_at", "last_reported_at", "last_updated_at" FROM `scammer_stats`;--> statement-breakpoint
DROP TABLE `scammer_stats`;--> statement-breakpoint
ALTER TABLE `__new_scammer_stats` RENAME TO `scammer_stats`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_stats_scammer_name` ON `scammer_stats` (`scammer_name`);--> statement-breakpoint
CREATE INDEX `idx_stats_bank_account_name` ON `scammer_stats` (`bank_account_name`);--> statement-breakpoint
CREATE INDEX `idx_stats_bank_code` ON `scammer_stats` (`bank_code`);--> statement-breakpoint
CREATE INDEX `idx_stats_total_cases` ON `scammer_stats` (`total_cases`);--> statement-breakpoint
CREATE INDEX `idx_stats_total_amount` ON `scammer_stats` (`total_amount_lost`);--> statement-breakpoint
CREATE INDEX `idx_stats_last_reported` ON `scammer_stats` (`last_reported_at`);