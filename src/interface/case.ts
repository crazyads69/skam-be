// src/interface/case.ts
import { z } from "zod";
import { MAX_FILES_PER_REQUEST } from "../utils/utils";

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

	accountNumber: z
		.string()
		.regex(/^\d+$/, "Account number must contain only digits")
		.min(6, "Account number must be at least 6 digits")
		.max(20, "Account number is too long"),

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

export type SubmitCaseInput = z.infer<typeof SubmitCaseSchema>;

// Response schema for returning cases
export const CaseResponseSchema = z.object({
	id: z.number(),
	scammerName: z.string(),
	bankAccountName: z.string(),
	bankCode: z.string(),
	bankName: z.string(),
	accountNumber: z.string(),
	scamDescription: z.string(),
	amountLost: z.number().nullable(),
	evidenceJson: z.array(
		z.object({
			key: z.string(),
			name: z.string(),
			size: z.number(),
		})
	),
	status: z.enum(["pending", "approved", "rejected"]),
	submittedAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type CaseResponse = z.infer<typeof CaseResponseSchema>;
