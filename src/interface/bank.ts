import { z } from "zod";

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

export type Bank = z.infer<typeof BankSchema>;
export type BankResponse = z.infer<typeof BankResponseSchema>;
