import { and, count, desc, eq, like, or, sql } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import {
	type SelectScamCase,
	type SelectScammerStats,
	scamCasesTable,
	scammerStatsTable,
} from "../db/schema";
import type {
	CaseServiceCountCasesResult,
	CaseServiceGetCaseByIdResult,
	CaseServiceGetCasesByAccountIdentifierResult,
	CaseServiceSearchScammerStatsResult,
	CaseServiceSubmitCaseResult,
	CaseServiceUpdateCaseStatusResult,
	SubmitCaseInput,
} from "../interface/case";

export class CaseService {
	private db: DrizzleD1Database;
	private kv: KVNamespace;
	private readonly CACHE_TTL = 3600;
	private readonly COUNT_CACHE_TTL = 600;

	// Cache key prefixes
	private readonly CACHE_PREFIX = {
		CASE: "case:",
		CASES: "cases:",
		COUNT: "count:approved",
		STATS_SEARCH: "stats-search::",
	} as const;

	constructor(d1: D1Database, kv: KVNamespace) {
		this.db = drizzle(d1);
		this.kv = kv;
	}

	// Cache key generators
	private getCaseKey(id: number): string {
		return `${this.CACHE_PREFIX.CASE}${id}`;
	}

	private getCasesByAccountKey(
		accountIdentifier: string,
		bankCode: string,
		limit: number,
		offset: number
	): string {
		return `${this.CACHE_PREFIX.CASES}${accountIdentifier}:${bankCode}:${limit}:${offset}`;
	}

	private getStatsCacheKey(params: {
		input?: string;
		bankCode?: string;
	}): string {
		const { input, bankCode } = params;
		const parts = [
			this.CACHE_PREFIX.STATS_SEARCH.slice(0, -2), // Remove trailing ::
			input ? `input:${input.toLowerCase().trim()}` : "",
			bankCode ? `bank:${bankCode.trim()}` : "",
		].filter(Boolean);
		return parts.join("::");
	}

	// Cache helpers
	private async getCached<T>(key: string): Promise<T | null> {
		return await this.kv.get<T>(key, "json");
	}

	private async setCached<T>(
		key: string,
		value: T,
		ttl: number = this.CACHE_TTL
	): Promise<void> {
		await this.kv.put(key, JSON.stringify(value), {
			expirationTtl: ttl,
		});
	}

	private async invalidateCacheByPrefix(prefix: string): Promise<void> {
		const listResult = await this.kv.list({ prefix });
		const deletePromises = listResult.keys.map((key) =>
			this.kv.delete(key.name)
		);
		await Promise.all(deletePromises);
	}

	async submitCase(
		input: SubmitCaseInput
	): Promise<CaseServiceSubmitCaseResult> {
		const now = new Date();

		const [newCase] = await this.db
			.insert(scamCasesTable)
			.values({
				scammerName: input.scammerName.trim(),
				bankAccountName: input.bankAccountName.trim(),
				bankCode: input.bankCode.trim(),
				bankName: input.bankName.trim(),
				accountIdentifier: input.accountIdentifier.trim(),
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

	async getCaseById(id: number): Promise<CaseServiceGetCaseByIdResult> {
		const cacheKey = this.getCaseKey(id);
		const cached = await this.getCached<SelectScamCase>(cacheKey);

		if (cached) {
			console.log(`✅ Cache HIT: Case #${id} [${cacheKey}]`);
			return cached;
		}

		console.log(`❌ Cache MISS: Case #${id} [${cacheKey}]`);

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

		if (result?.status === "approved") {
			await this.setCached(cacheKey, result);
			console.log(`✅ Cached case #${id}`);
		}

		return result || null;
	}

	async getCasesByAccountIdentifier(
		accountIdentifier: string,
		bankCode: string,
		limit = 50,
		offset = 0
	): Promise<CaseServiceGetCasesByAccountIdentifierResult> {
		const cacheKey = this.getCasesByAccountKey(
			accountIdentifier,
			bankCode,
			limit,
			offset
		);
		const cached = await this.getCached<SelectScamCase[]>(cacheKey);

		if (cached) {
			console.log(
				`✅ Cache HIT: Cases for ${accountIdentifier} - ${bankCode} (limit: ${limit}, offset: ${offset}) [${cacheKey}]`
			);
			return cached;
		}

		console.log(
			`❌ Cache MISS: Cases for ${accountIdentifier} - ${bankCode} (limit: ${limit}, offset: ${offset}) [${cacheKey}]`
		);

		const results = await this.db
			.select()
			.from(scamCasesTable)
			.where(
				and(
					eq(scamCasesTable.accountIdentifier, accountIdentifier),
					eq(scamCasesTable.bankCode, bankCode),
					eq(scamCasesTable.status, "approved")
				)
			)
			.orderBy(desc(scamCasesTable.submittedAt))
			.limit(limit)
			.offset(offset);

		await this.setCached(cacheKey, results);
		console.log(
			`✅ Cached ${results.length} cases for ${accountIdentifier} - ${bankCode}`
		);

		return results;
	}

	async countCases(): Promise<CaseServiceCountCasesResult> {
		const cacheKey = this.CACHE_PREFIX.COUNT;
		const cached = await this.getCached<CaseServiceCountCasesResult>(
			cacheKey
		);

		if (cached) {
			console.log(
				`✅ Cache HIT: Case counts - total: ${cached.total}, approved: ${cached.approved} [${cacheKey}]`
			);
			return cached;
		}

		console.log(`❌ Cache MISS: Case counts [${cacheKey}]`);

		const [totalResult, approvedResult] = await Promise.all([
			this.db
				.select({ count: count(scamCasesTable.id) })
				.from(scamCasesTable),
			this.db
				.select({ count: count(scamCasesTable.id) })
				.from(scamCasesTable)
				.where(eq(scamCasesTable.status, "approved")),
		]);

		const counts: CaseServiceCountCasesResult = {
			total: totalResult[0].count,
			approved: approvedResult[0].count,
		};

		await this.setCached(cacheKey, counts, this.COUNT_CACHE_TTL);
		console.log(
			`✅ Cached case counts - total: ${counts.total}, approved: ${counts.approved}`
		);

		return counts;
	}

	async updateCaseStatus(
		id: number,
		status: "approved" | "rejected",
		adminUsername: string,
		adminNotes?: string
	): Promise<CaseServiceUpdateCaseStatusResult> {
		const now = new Date();

		// Get the case details before updating
		const [caseToUpdate] = await this.db
			.select()
			.from(scamCasesTable)
			.where(eq(scamCasesTable.id, id))
			.limit(1);

		if (!caseToUpdate) {
			throw new Error(`Case #${id} not found`);
		}

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

		// If approved, upsert into scammer_stats table
		if (status === "approved") {
			await this.upsertScammerStats(caseToUpdate);
		}

		console.log(`✅ Case #${id} updated to status: ${status}`);

		// Invalidate relevant caches
		await this.kv.delete(this.getCaseKey(id));
		await this.invalidateStatsCache(
			caseToUpdate.accountIdentifier,
			caseToUpdate.bankCode
		);
	}

	private async upsertScammerStats(
		approvedCase: SelectScamCase
	): Promise<void> {
		const now = new Date();

		// Check if stats record exists
		const [existingStats] = await this.db
			.select()
			.from(scammerStatsTable)
			.where(
				and(
					eq(
						scammerStatsTable.accountIdentifier,
						approvedCase.accountIdentifier
					),
					eq(scammerStatsTable.bankCode, approvedCase.bankCode)
				)
			)
			.limit(1);

		if (existingStats) {
			// Increment existing stats
			await this.db
				.update(scammerStatsTable)
				.set({
					scammerName: approvedCase.scammerName,
					bankAccountName: approvedCase.bankAccountName,
					bankName: approvedCase.bankName,
					totalCases: sql`${scammerStatsTable.totalCases} + 1`,
					totalAmountLost: sql`${
						scammerStatsTable.totalAmountLost
					} + ${approvedCase.amountLost || 0}`,
					lastReportedAt: approvedCase.submittedAt,
					lastUpdatedAt: now,
				})
				.where(
					and(
						eq(
							scammerStatsTable.accountIdentifier,
							approvedCase.accountIdentifier
						),
						eq(scammerStatsTable.bankCode, approvedCase.bankCode)
					)
				);

			console.log(
				`✅ Updated scammer stats for ${approvedCase.accountIdentifier}`
			);
		} else {
			// Insert new stats
			await this.db.insert(scammerStatsTable).values({
				accountIdentifier: approvedCase.accountIdentifier,
				bankCode: approvedCase.bankCode,
				bankName: approvedCase.bankName,
				scammerName: approvedCase.scammerName,
				bankAccountName: approvedCase.bankAccountName,
				totalCases: 1,
				totalAmountLost: approvedCase.amountLost || 0,
				firstReportedAt: approvedCase.submittedAt,
				lastReportedAt: approvedCase.submittedAt,
				lastUpdatedAt: now,
			});

			console.log(
				`✅ Created scammer stats for ${approvedCase.accountIdentifier}`
			);
		}
	}

	private async invalidateStatsCache(
		accountIdentifier: string,
		bankCode: string
	): Promise<void> {
		// Delete stats cache
		await this.kv.delete(`stats:${accountIdentifier}:${bankCode}`);

		// Clear all paginated cache entries for this account
		const casesCachePrefix = `${this.CACHE_PREFIX.CASES}${accountIdentifier}:${bankCode}:`;
		await this.invalidateCacheByPrefix(casesCachePrefix);

		// Clear stats search cache
		await this.invalidateCacheByPrefix(this.CACHE_PREFIX.STATS_SEARCH);

		console.log(`🗑️ Invalidated caches for ${accountIdentifier}`);
	}

	async searchScammerStats(params: {
		input: string;
		bankCode: string;
	}): Promise<CaseServiceSearchScammerStatsResult | null> {
		const { input, bankCode } = params;
		const cacheKey = this.getStatsCacheKey({ input, bankCode });

		const cached =
			await this.getCached<CaseServiceSearchScammerStatsResult>(cacheKey);

		if (cached !== null) {
			console.log(`✅ Cache HIT: Stats Search [${cacheKey}]`);
			return cached;
		}

		console.log(`❌ Cache MISS: Stats Search [${cacheKey}]`);

		const searchTerm = `%${input.trim().toLowerCase()}%`;
		const searchCondition = or(
			like(scammerStatsTable.scammerName, searchTerm),
			like(scammerStatsTable.bankAccountName, searchTerm),
			like(scammerStatsTable.accountIdentifier, searchTerm)
		);

		const conditions = [
			searchCondition,
			eq(scammerStatsTable.bankCode, bankCode.trim()),
		].filter(Boolean);

		const [statsResult] = await this.db
			.select()
			.from(scammerStatsTable)
			.where(and(...conditions))
			.orderBy(desc(scammerStatsTable.lastReportedAt))
			.limit(1);

		if (!statsResult) {
			await this.setCached(cacheKey, null);
			console.log("✅ No stats found, cached null result");
			return null;
		}

		// Get the 5 most recent cases for this stats record
		const recentCases = await this.db
			.select()
			.from(scamCasesTable)
			.where(
				and(
					eq(
						scamCasesTable.accountIdentifier,
						statsResult.accountIdentifier
					),
					eq(scamCasesTable.bankCode, statsResult.bankCode),
					eq(scamCasesTable.status, "approved")
				)
			)
			.orderBy(desc(scamCasesTable.submittedAt))
			.limit(5);

		const result: CaseServiceSearchScammerStatsResult = {
			...statsResult,
			recentCases,
		};

		await this.setCached(cacheKey, result);
		console.log("✅ Cached stats search result with recent cases");

		return result;
	}
}
