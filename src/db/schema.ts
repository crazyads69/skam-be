import { relations } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const scamCasesTable = sqliteTable(
	"scam_cases",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),

		scammerName: text("scammer_name").notNull(),
		bankAccountName: text("bank_account_name").notNull(),

		accountIdentifier: text("account_identifier").notNull(),

		bankCode: text("bank_code").notNull(),
		bankName: text("bank_name").notNull(),

		scamDescription: text("scam_description").notNull(),
		amountLost: integer("amount_lost"), // VNĐ (optional)

		evidenceJson: text("evidence_json", { mode: "json" }).$type<
			EvidenceFile[]
		>(),

		submittedAt: integer("submitted_at", {
			mode: "timestamp_ms",
		}).notNull(),

		status: text("status", {
			enum: ["pending", "approved", "rejected"],
		})
			.default("pending")
			.notNull(),
		reviewedByAdmin: text("reviewed_by_admin"),
		reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
		adminNotes: text("admin_notes"),

		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("idx_status").on(table.status),
		index("idx_account_identifier").on(table.accountIdentifier),
		index("idx_scammer_name_lower").on(table.scammerName),
		index("idx_bank_account_name_lower").on(table.bankAccountName),
		index("idx_submitted_at").on(table.submittedAt),
		index("idx_status_submitted").on(table.status, table.submittedAt),
		index("idx_account_bank").on(table.accountIdentifier, table.bankCode),
		index("idx_account_status").on(table.accountIdentifier, table.status),
	]
);

export const scammerStatsTable = sqliteTable(
	"scammer_stats",
	{
		accountIdentifier: text("account_identifier").notNull(),

		bankCode: text("bank_code").notNull(),
		bankName: text("bank_name").notNull(),

		scammerName: text("scammer_name").notNull(), // Most recent or most common
		bankAccountName: text("bank_account_name").notNull(), // Most recent or most common

		totalCases: integer("total_cases").notNull().default(0),
		totalAmountLost: integer("total_amount_lost").notNull().default(0),


		firstReportedAt: integer("first_reported_at", {
			mode: "timestamp_ms",
		}).notNull(),
		lastReportedAt: integer("last_reported_at", {
			mode: "timestamp_ms",
		}).notNull(),
		lastUpdatedAt: integer("last_updated_at", {
			mode: "timestamp_ms",
		}).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.accountIdentifier, table.bankCode] }),
		index("idx_stats_scammer_name").on(table.scammerName),
		index("idx_stats_bank_account_name").on(table.bankAccountName),
		index("idx_stats_bank_code").on(table.bankCode),
		index("idx_stats_total_cases").on(table.totalCases),
		index("idx_stats_total_amount").on(table.totalAmountLost),
		index("idx_stats_last_reported").on(table.lastReportedAt),
	]
);

export const scamCasesRelations = relations(scamCasesTable, ({ one }) => ({
	stats: one(scammerStatsTable, {
		fields: [scamCasesTable.accountIdentifier, scamCasesTable.bankCode],
		references: [
			scammerStatsTable.accountIdentifier,
			scammerStatsTable.bankCode,
		],
	}),
}));

export const scammerStatsRelations = relations(
	scammerStatsTable,
	({ many }) => ({
		cases: many(scamCasesTable),
	})
);

export type InsertScamCase = typeof scamCasesTable.$inferInsert;
export type SelectScamCase = typeof scamCasesTable.$inferSelect;

export type InsertScammerStats = typeof scammerStatsTable.$inferInsert;
export type SelectScammerStats = typeof scammerStatsTable.$inferSelect;

export type EvidenceFile = {
	key: string;
	name: string;
	size: number;
};
