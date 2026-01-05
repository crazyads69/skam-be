import { z } from "zod";

// ============= RESPONSE SCHEMAS =============

export const BankSchema = z.object({
	id: z.number(),
	name: z.string(),
	code: z.string(),
	bin: z.string(),
	shortName: z.string(),
	logo: z.string(),
	swift_code: z.string().nullable(),
});

export const BankResponseSchema = z.object({
	code: z.string(),
	desc: z.string(),
	data: z.array(BankSchema),
});

export const GetBanksResponseSchema = z.array(BankSchema);

// ============= SERVICE RETURN TYPES =============

export type BankServiceGetBanksResult = Bank[];
export type BankServiceRefreshCacheResult = Bank[];
export type BankServiceClearCacheResult = undefined;

// ============= TYPES =============

export type Bank = z.infer<typeof BankSchema>;
export type BankResponse = z.infer<typeof BankResponseSchema>;
export type GetBanksResponse = z.infer<typeof GetBanksResponseSchema>;
