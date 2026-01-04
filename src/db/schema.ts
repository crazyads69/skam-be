import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scamCasesTable = sqliteTable(
	"scam_cases",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),

		// Scammer Info
		scammerName: text("scammer_name").notNull(),
		bankAccountName: text("bank_account_name").notNull(),
		bankCode: text("bank_code").notNull(),
		bankName: text("bank_name").notNull(),
		accountNumber: text("account_number").notNull(),

		// Case Details
		scamDescription: text("scam_description").notNull(),
		amountLost: integer("amount_lost"), // VNĐ (optional)

		// Evidence (JSON array of R2 keys)
		evidenceJson: text("evidence_json", { mode: "json" }).$type<
			EvidenceFile[]
		>(),

		submittedAt: integer("submitted_at", {
			mode: "timestamp_ms",
		}).notNull(),

		// Admin Approval
		status: text("status", {
			enum: ["pending", "approved", "rejected"],
		})
			.default("pending")
			.notNull(),
		reviewedByAdmin: text("reviewed_by_admin"),
		reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
		adminNotes: text("admin_notes"),

		// Metadata
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("idx_status").on(table.status),
		index("idx_account_number").on(table.accountNumber),
		index("idx_scammer_name_lower").on(table.scammerName),
		index("idx_bank_account_name_lower").on(table.bankAccountName),
		index("idx_submitted_at").on(table.submittedAt),
		index("idx_status_submitted").on(table.status, table.submittedAt),
	]
);

// Type for inserting a scam case
export type InsertScamCase = typeof scamCasesTable.$inferInsert;

// Type for selecting a scam case
export type SelectScamCase = typeof scamCasesTable.$inferSelect;

export type EvidenceFile = {
	key: string;
	name: string;
	size: number;
};
