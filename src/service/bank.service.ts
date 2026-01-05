import z from "zod";
import {
	type Bank,
	BankResponseSchema,
	type BankServiceClearCacheResult,
	type BankServiceGetBanksResult,
	type BankServiceRefreshCacheResult,
} from "../interface/bank";

const VIETQR_API_URL = "https://api.vietqr.io/v2/banks";
const CACHE_KEY = "bank:";
const CACHE_TTL = 86400; // 1 day

export class BankService {
	constructor(private kv: KVNamespace) {}

	async getBanks(): Promise<BankServiceGetBanksResult> {
		const cached = await this.kv.get<Bank[]>(CACHE_KEY, "json");

		if (cached) {
			console.log("✅ Cache HIT: Banks loaded from KV");
			return cached;
		}

		console.log("❌ Cache MISS: Fetching from VietQR API");

		const banks = await this.fetchBanksFromAPI();

		await this.kv.put(CACHE_KEY, JSON.stringify(banks), {
			expirationTtl: CACHE_TTL,
		});

		console.log(`✅ Cached ${banks.length} banks in KV`);

		return banks;
	}

	async refreshCache(): Promise<BankServiceRefreshCacheResult> {
		console.log("🔄 Force refreshing banks cache...");

		const banks = await this.fetchBanksFromAPI();

		await this.kv.put(CACHE_KEY, JSON.stringify(banks), {
			expirationTtl: CACHE_TTL,
		});

		console.log(`✅ Cache refreshed with ${banks.length} banks`);

		return banks;
	}

	async clearCache(): Promise<BankServiceClearCacheResult> {
		await this.kv.delete(CACHE_KEY);
		console.log("🗑️ Banks cache cleared");
	}

	private async fetchBanksFromAPI(): Promise<Bank[]> {
		try {
			const response = await fetch(VIETQR_API_URL, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
				},
			});

			if (!response.ok) {
				throw new Error(`VietQR API error: ${response.status}`);
			}

			const rawData = await response.json();

			const data = BankResponseSchema.parse(rawData);

			if (data.code !== "00") {
				throw new Error(`VietQR API returned error: ${data.desc}`);
			}

			return data.data;
		} catch (error) {
			console.error("❌ Failed to fetch banks from VietQR:", error);

			if (error instanceof z.ZodError) {
				console.error("Validation errors:", error.issues);
				throw new Error("Invalid response structure from VietQR API");
			}

			throw new Error("Failed to fetch banks from VietQR API");
		}
	}
}
