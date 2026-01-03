import z from "zod";

export enum TurnstileErrorCode {
	MissingInputSecret = "missing-input-secret",
	InvalidInputSecret = "invalid-input-secret",
	MissingInputResponse = "missing-input-response",
	InvalidInputResponse = "invalid-input-response",
	BadRequest = "bad-request",
	TimeoutOrDuplicate = "timeout-or-duplicate",
	InternalError = "internal-error",
}

export const TurnstileResponseSchema = z.object({
	success: z.boolean(),
	challenge_ts: z.string().optional(),
	hostname: z.string().optional(),
	"error-codes": z.array(z.enum(TurnstileErrorCode)).optional(),
	action: z.string().optional(),
	cdata: z.string().optional(),
	metadata: z
		.object({
			ephemeral_id: z.string().optional(),
		})
		.optional(),
});

export type TurnstileResponse = z.infer<typeof TurnstileResponseSchema>;
