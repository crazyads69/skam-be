import { and, count, desc, eq, like, or } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { type SelectScamCase, scamCasesTable } from "../db/schema";
import type { SubmitCaseInput } from "../interface/case";

export class CaseService {
	private db: DrizzleD1Database;
	private kv: KVNamespace;
	private CACHE_TTL = 3600;

	constructor(d1: D1Database, kv: KVNamespace) {
		this.db = drizzle(d1);
		this.kv = kv;
	}

	private generateSearchCacheKey(params: {
		input?: string; // Could be scammer name, bank account name, or account number
		bankCode?: string;
		limit?: number;
		offset?: number;
	}): string {
		const { input, bankCode, limit, offset } = params;
		const parts = [
			"search",
			input ? `input:${input.toLowerCase().trim()}` : "",
			bankCode ? `bank:${bankCode.trim()}` : "",
			`limit:${limit}`,
			`offset:${offset}`,
		].filter(Boolean);

		return parts.join("::");
	}

	async submitCase(input: SubmitCaseInput): Promise<SelectScamCase> {
		const now = new Date();

		const [newCase] = await this.db
			.insert(scamCasesTable)
			.values({
				scammerName: input.scammerName.trim(),
				bankAccountName: input.bankAccountName.trim(),
				bankCode: input.bankCode.trim(),
				bankName: input.bankName.trim(),
				accountNumber: input.accountNumber.trim(),
				scamDescription: input.scamDescription.trim(),
				amountLost: input.amountLost ?? null,
				evidenceJson: input.evidenceFiles,
				submittedAt: now,
				status: "pending",
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		console.log(`✅ Case #${newCase.id} submitted successfully`);

		return newCase;
	}

	async getCaseById(id: number): Promise<SelectScamCase | null> {
		const cacheKey = `case:${id}`;

		const cached = await this.kv.get<SelectScamCase>(cacheKey, "json");
		if (cached) {
			console.log(`✅ Cache HIT: Case #${id}`);
			return cached;
		}

		console.log(`❌ Cache MISS: Case #${id}`);

		const [result] = await this.db
			.select()
			.from(scamCasesTable)
			.where(
				and(
					eq(scamCasesTable.id, id),
					eq(scamCasesTable.status, "approved")
				)
			)
			.limit(1);

		if (result) {
			if (result.status === "approved") {
				await this.kv.put(cacheKey, JSON.stringify(result), {
					expirationTtl: this.CACHE_TTL,
				});
				console.log(`✅ Cached case #${id}`);
			}
		}

		return result || null;
	}

	async searchCases(params: {
		input?: string;
		bankCode?: string;
		limit?: number;
		offset?: number;
	}): Promise<SelectScamCase[]> {
		const { input, bankCode, limit = 50, offset = 0 } = params;

		const cacheKey = this.generateSearchCacheKey({
			input,
			bankCode,
			limit,
			offset,
		});

		const cached = await this.kv.get<SelectScamCase[]>(cacheKey, "json");
		if (cached) {
			console.log(`✅ Cache HIT: Search [${cacheKey}]`);
			return cached;
		}

		console.log(`❌ Cache MISS: Search [${cacheKey}]`);

		const conditions = [eq(scamCasesTable.status, "approved")];

		if (input?.trim()) {
			const searchTerm = `%${input.trim().toLowerCase()}%`;
			conditions.push(
				or(
					like(scamCasesTable.scammerName, searchTerm),
					like(scamCasesTable.bankAccountName, searchTerm),
					like(scamCasesTable.accountNumber, searchTerm)
				)!
			);
		}

		if (bankCode?.trim()) {
			conditions.push(eq(scamCasesTable.bankCode, bankCode.trim()));
		}

		const results = await this.db
			.select()
			.from(scamCasesTable)
			.where(and(...conditions))
			.orderBy(desc(scamCasesTable.submittedAt))
			.limit(limit)
			.offset(offset);

		await this.kv.put(cacheKey, JSON.stringify(results), {
			expirationTtl: this.CACHE_TTL,
		});

		console.log(`✅ Cached search results: ${results.length} cases`);

		return results;
	}

	async countApprovedCases(): Promise<number> {
		const cacheKey = "count:approved";

		const cached = await this.kv.get<number>(cacheKey, "json");
		if (cached !== null) {
			console.log(`✅ Cache HIT: Approved count = ${cached}`);
			return cached;
		}

		console.log("❌ Cache MISS: Approved count");

		const [result] = await this.db
			.select({
				count: count(scamCasesTable.id),
			})
			.from(scamCasesTable)
			.where(eq(scamCasesTable.status, "approved"));

		await this.kv.put(cacheKey, JSON.stringify(result.count), {
			expirationTtl: 600,
		});

		console.log(`✅ Cached approved count: ${result.count}`);

		return result.count;
	}

	async updateCaseStatus(
		id: number,
		status: "approved" | "rejected",
		adminUsername: string,
		adminNotes?: string
	): Promise<void> {
		const now = new Date();

		await this.db
			.update(scamCasesTable)
			.set({
				status,
				reviewedByAdmin: adminUsername,
				reviewedAt: now,
				adminNotes: adminNotes || null,
				updatedAt: now,
			})
			.where(eq(scamCasesTable.id, id));

		console.log(`✅ Case #${id} updated to status: ${status}`);

		await this.kv.delete(`case:${id}`);

		await this.invalidateSearchCache();
	}

	async invalidateSearchCache(): Promise<void> {
		try {
			const listResult = await this.kv.list({ prefix: "search::" });

			const deletePromises = listResult.keys.map((key) =>
				this.kv.delete(key.name)
			);

			await Promise.all(deletePromises);

			await this.kv.delete("count:approved");

			console.log(
				`🗑️ Invalidated ${listResult.keys.length} search cache entries`
			);
		} catch (error) {
			console.error("Error invalidating search cache:", error);
		}
	}

	// async clearAllCaches(): Promise<void> {
	// 	try {
	// 		const prefixes = ["search::", "case:", "count:"];

	// 		for (const prefix of prefixes) {
	// 			const listResult = await this.kv.list({ prefix });
	// 			const deletePromises = listResult.keys.map((key) =>
	// 				this.kv.delete(key.name)
	// 			);
	// 			await Promise.all(deletePromises);
	// 			console.log(
	// 				`🗑️ Cleared ${listResult.keys.length} cache entries with prefix: ${prefix}`
	// 			);
	// 		}

	// 		console.log("✅ All caches cleared");
	// 	} catch (error) {
	// 		console.error("Error clearing caches:", error);
	// 	}
	// }
}
