// src/interface/case.ts
import { z } from "zod";
import { MAX_FILES_PER_REQUEST } from "../utils/utils";

// ============= REQUEST SCHEMAS =============

export const SubmitCaseSchema = z.object({
	// Scammer Info
	scammerName: z
		.string()
		.min(2, "Scammer name must be at least 2 characters")
		.max(100, "Scammer name is too long"),

	bankAccountName: z
		.string()
		.min(2, "Bank account name must be at least 2 characters")
		.max(100, "Bank account name is too long"),

	bankCode: z.string().min(2, "Bank code is required"),

	bankName: z.string().min(2, "Bank name is required"),

	accountIdentifier: z
		.string()
		.regex(
			/^[a-zA-Z0-9]+$/,
			"Account identifier must contain only letters and numbers"
		)
		.min(6, "Account identifier must be at least 6 characters")
		.max(20, "Account identifier is too long"),

	// Case Details
	scamDescription: z
		.string()
		.min(50, "Description must be at least 50 characters")
		.max(5000, "Description is too long"),

	amountLost: z.number().int().positive().optional().nullable(),

	evidenceFiles: z
		.array(
			z.object({
				key: z.string(),
				name: z.string(),
				size: z.number(),
			})
		)
		.min(1, "At least one evidence file is required")
		.max(
			MAX_FILES_PER_REQUEST,
			`Maximum ${MAX_FILES_PER_REQUEST} evidence files allowed`
		),
});

export const SearchScammerQuerySchema = z.object({
	input: z.string().min(1),
	bankCode: z.string().min(2),
});

export const GetCaseByIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export const GetCasesByAccountParamSchema = z.object({
	accountIdentifier: z
		.string()
		.min(6)
		.max(20)
		.regex(/^[a-zA-Z0-9]+$/),
	bankCode: z.string().min(2),
});

export const GetCasesByAccountQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
});

// ============= TYPES =============

export type SubmitCaseInput = z.infer<typeof SubmitCaseSchema>;
export type SearchScammerQuery = z.infer<typeof SearchScammerQuerySchema>;
export type GetCaseByIdParam = z.infer<typeof GetCaseByIdParamSchema>;
export type GetCasesByAccountParam = z.infer<
	typeof GetCasesByAccountParamSchema
>;
export type GetCasesByAccountQuery = z.infer<
	typeof GetCasesByAccountQuerySchema
>;

// ============= RESPONSE SCHEMAS =============

export const EvidenceFileSchema = z.object({
	key: z.string(),
	name: z.string(),
	size: z.number(),
});

export const CaseResponseSchema = z.object({
	id: z.number(),
	scammerName: z.string(),
	bankAccountName: z.string(),
	bankCode: z.string(),
	bankName: z.string(),
	accountIdentifier: z.string(),
	scamDescription: z.string(),
	amountLost: z.number().nullable(),
	evidenceJson: z.array(EvidenceFileSchema),
	status: z.enum(["pending", "approved", "rejected"]),
	submittedAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const SubmitCaseResponseSchema = z.object({
	id: z.number(),
	status: z.enum(["pending", "approved", "rejected"]),
	submittedAt: z.date(),
});

export const ScammerStatsResponseSchema = z.object({
	accountIdentifier: z.string(),
	bankCode: z.string(),
	bankName: z.string(),
	scammerName: z.string(),
	bankAccountName: z.string(),
	totalCases: z.number(),
	totalAmountLost: z.number(),
	firstReportedAt: z.date(),
	lastReportedAt: z.date(),
	lastUpdatedAt: z.date(),
	recentCases: z.array(CaseResponseSchema).max(5),
});

export const GetCasesByAccountResponseSchema = z.object({
	cases: z.array(CaseResponseSchema),
	count: z.number(),
	accountIdentifier: z.string(),
	bankCode: z.string(),
	limit: z.number(),
	offset: z.number(),
});

export const CaseCountResponseSchema = z.object({
	count: z.object({
		total: z.number(),
		approved: z.number(),
	}),
});

// ============= SERVICE RETURN TYPES =============

export interface CaseServiceSubmitCaseResult {
	id: number;
	scammerName: string;
	bankAccountName: string;
	bankCode: string;
	bankName: string;
	accountIdentifier: string;
	scamDescription: string;
	amountLost: number | null;
	evidenceJson: Array<{
		key: string;
		name: string;
		size: number;
	}> | null;
	status: "pending" | "approved" | "rejected";
	submittedAt: Date;
	createdAt: Date;
	updatedAt: Date;
	reviewedByAdmin: string | null;
	reviewedAt: Date | null;
	adminNotes: string | null;
}

export type CaseServiceGetCaseByIdResult = CaseServiceSubmitCaseResult | null;

export type CaseServiceGetCasesByAccountIdentifierResult =
	CaseServiceSubmitCaseResult[];

export interface CaseServiceSearchCasesResult {
	cases: CaseServiceSubmitCaseResult[];
}

export interface CaseServiceCountCasesResult {
	total: number;
	approved: number;
}

export type CaseServiceUpdateCaseStatusResult = undefined;

export interface CaseServiceSearchScammerStatsResult {
	accountIdentifier: string;
	bankCode: string;
	bankName: string;
	scammerName: string;
	bankAccountName: string;
	totalCases: number;
	totalAmountLost: number;
	firstReportedAt: Date;
	lastReportedAt: Date;
	lastUpdatedAt: Date;
	recentCases: CaseServiceSubmitCaseResult[];
}

// ============= RESPONSE TYPES =============

export type EvidenceFile = z.infer<typeof EvidenceFileSchema>;
export type CaseResponse = z.infer<typeof CaseResponseSchema>;
export type SubmitCaseResponse = z.infer<typeof SubmitCaseResponseSchema>;
export type ScammerStatsResponse = z.infer<typeof ScammerStatsResponseSchema>;
export type GetCasesByAccountResponse = z.infer<
	typeof GetCasesByAccountResponseSchema
>;
export type CaseCountResponse = z.infer<typeof CaseCountResponseSchema>;
