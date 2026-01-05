import type {
	UploadedFile,
	UploadServiceUploadFileResult,
	UploadServiceUploadFilesResult,
} from "../interface/upload";
import { getFileExtension } from "../utils/utils";

export class UploadService {
	private readonly CACHE_TTL = 86400 * 30; // 30 days
	private readonly CACHE_PREFIX = "file:";
	private readonly R2_PREFIX = "file/";

	constructor(private r2: R2Bucket, private kv: KVNamespace) {}

	// Cache key generator
	private getCacheKey(hash: string): string {
		return `${this.CACHE_PREFIX}${hash}`;
	}

	// Generate R2 key for new uploads
	private generateR2Key(
		hash: string,
		timestamp: number,
		extension: string
	): string {
		return `${this.R2_PREFIX}${hash}_${timestamp}${extension}`;
	}

	// Generate SHA-256 hash from file buffer
	private async generateFileHash(buffer: ArrayBuffer): Promise<string> {
		const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	// Create UploadedFile object
	private createUploadedFile(
		file: File,
		r2Key: string,
		hash: string
	): UploadedFile {
		return {
			key: r2Key,
			name: file.name,
			size: file.size,
			contentType: file.type,
			hash,
			uploadedAt: file.lastModified
				? new Date(file.lastModified).toISOString()
				: new Date().toISOString(),
		};
	}

	// Check if file already exists in cache or R2
	private async checkIfFileExists(hash: string): Promise<string | null> {
		const cacheKey = this.getCacheKey(hash);
		const existingUrl = await this.kv.get<string>(cacheKey);

		if (existingUrl) {
			console.log(
				`✅ Duplicate found in cache: ${hash} (instant lookup)`
			);
			return existingUrl;
		}

		const listed = await this.r2.list({
			prefix: `${this.R2_PREFIX}${hash}`,
		});

		if (listed.objects.length > 0) {
			const existingKey = listed.objects[0].key;
			console.log(`✅ Duplicate found in R2: ${hash}`);

			await this.kv.put(cacheKey, existingKey, {
				expirationTtl: this.CACHE_TTL,
			});

			return existingKey;
		}

		return null;
	}

	// Upload file to R2 and cache the key
	private async uploadToR2(
		buffer: ArrayBuffer,
		file: File,
		hash: string
	): Promise<string> {
		const extension = getFileExtension(file.type);
		const timestamp = Date.now();
		const r2Key = this.generateR2Key(hash, timestamp, extension);

		await this.r2.put(r2Key, buffer, {
			httpMetadata: {
				contentType: file.type,
			},
			customMetadata: {
				originalName: file.name,
				hash,
				uploadedAt: new Date().toISOString(),
			},
		});

		await this.kv.put(this.getCacheKey(hash), r2Key, {
			expirationTtl: this.CACHE_TTL,
		});

		return r2Key;
	}

	async uploadFile(file: File): Promise<UploadServiceUploadFileResult> {
		try {
			const buffer = await file.arrayBuffer();
			const hash = await this.generateFileHash(buffer);

			const sizeMB = (file.size / 1024 / 1024).toFixed(2);
			const shortHash = hash.substring(0, 16);
			console.log(
				`📝 File: ${file.name} (${sizeMB}MB) | Hash: ${shortHash}...`
			);

			// Check for existing file
			const existingKey = await this.checkIfFileExists(hash);
			if (existingKey) {
				return {
					success: true,
					file: this.createUploadedFile(file, existingKey, hash),
				};
			}

			// Upload new file
			const r2Key = await this.uploadToR2(buffer, file, hash);
			console.log(`⚡ Upload completed for file: ${file.name}`);

			return {
				success: true,
				file: this.createUploadedFile(file, r2Key, hash),
			};
		} catch (error) {
			console.error("Upload error:", error);
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Unknown upload error",
			};
		}
	}

	async uploadFiles(files: File[]): Promise<UploadServiceUploadFilesResult> {
		const uploaded: UploadedFile[] = [];
		const errors: Array<{ name: string; error: string }> = [];

		const results = await Promise.allSettled(
			files.map((file) => this.uploadFile(file))
		);

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const file = files[i];

			if (result.status === "fulfilled" && result.value.success) {
				if (result.value.file) {
					uploaded.push(result.value.file);
				}
			} else {
				const errorMessage =
					result.status === "fulfilled"
						? result.value.error || "Unknown error"
						: result.reason?.message || "Upload failed";

				errors.push({ name: file.name, error: errorMessage });
			}
		}

		console.log(
			`📊 Batch upload: ${uploaded.length} uploaded, ${errors.length} errors in total.`
		);

		return { uploaded, errors };
	}
}
