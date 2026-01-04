ALTER TABLE `scam_cases` ADD `bank_account_name` text NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_bank_account_name_lower` ON `scam_cases` (`bank_account_name`);--> statement-breakpoint
ALTER TABLE `scam_cases` DROP COLUMN `title`;--> statement-breakpoint
ALTER TABLE `scam_cases` DROP COLUMN `submitter_ip_hash`;