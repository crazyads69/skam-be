CREATE TABLE `scam_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`scammer_name` text NOT NULL,
	`bank_code` text NOT NULL,
	`bank_name` text NOT NULL,
	`account_number` text NOT NULL,
	`scam_description` text NOT NULL,
	`amount_lost` integer,
	`evidence_json` text,
	`submitter_ip_hash` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by_admin` text,
	`reviewed_at` integer,
	`admin_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_status` ON `scam_cases` (`status`);--> statement-breakpoint
CREATE INDEX `idx_account_number` ON `scam_cases` (`account_number`);--> statement-breakpoint
CREATE INDEX `idx_scammer_name_lower` ON `scam_cases` (`scammer_name`);--> statement-breakpoint
CREATE INDEX `idx_submitted_at` ON `scam_cases` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_status_submitted` ON `scam_cases` (`status`,`submitted_at`);