import { FileSchema, type UploadedFile } from "../interface/upload";
import { getFileExtension } from "../utils/utils";

export class UploadService {
	constructor(private r2: R2Bucket, private kv: KVNamespace) {}

	private cacheKey(hash: string): string {
		return `file:${hash}`;
	}

	private async generateFileHash(buffer: ArrayBuffer): Promise<string> {
		const { sha256 } = await import("hash-wasm");
		return await sha256(new Uint8Array(buffer));
	}

	private async checkIfFileExists(hash: string): Promise<string | null> {
		const cacheKey = this.cacheKey(hash);
		const existingUrl = await this.kv.get<string>(cacheKey);

		if (existingUrl) {
			console.log(
				`✅ Duplicate found in cache: ${hash} (instant lookup)`
			);
			return existingUrl;
		}

		const listed = await this.r2.list({ prefix: `file/${hash}` });

		if (listed.objects.length > 0) {
			const existingKey = listed.objects[0].key;
			console.log(`✅ Duplicate found in R2: ${hash}`);

			await this.kv.put(cacheKey, existingKey, {
				expirationTtl: 86400 * 30,
			});

			return existingKey;
		}

		return null;
	}

	private validateFile(file: File): { valid: boolean; error?: string } {
		const result = FileSchema.safeParse(file);

		if (!result.success) {
			return {
				valid: false,
				error: result.error.issues.map((i) => i.message).join("; "),
			};
		}

		return { valid: true };
	}

	async uploadFile(file: File): Promise<{
		success: boolean;
		file?: UploadedFile;
		error?: string;
	}> {
		const validation = this.validateFile(file);

		if (!validation.valid) {
			return { success: false, error: validation.error };
		}

		try {
			const buffer = await file.arrayBuffer();
			const hash = await this.generateFileHash(buffer);
			console.log(
				`📝 File: ${file.name} (${(file.size / 1024 / 1024).toFixed(
					2
				)}MB) | Hash: ${hash.substring(0, 16)}...`
			);

			const existingKey = await this.checkIfFileExists(hash);

			if (existingKey) {
				return {
					success: true,
					file: {
						key: existingKey,
						name: file.name,
						size: file.size,
						contentType: file.type,
						hash,
						uploadedAt: file.lastModified
							? new Date(file.lastModified).toISOString()
							: new Date().toISOString(),
					},
				};
			}

			const extension = getFileExtension(file.type);
			const timestamp = Date.now();
			const r2Key = `file/${hash}_${timestamp}${extension}`;

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

			await this.kv.put(`file:${hash}`, r2Key, {
				expirationTtl: 86400 * 30,
			});

			const uploadedFile: UploadedFile = {
				key: r2Key,
				name: file.name,
				size: file.size,
				contentType: file.type,
				hash,
				uploadedAt: new Date().toISOString(),
			};

			console.log(`⚡ Upload completed for file: ${file.name}	`);

			return { success: true, file: uploadedFile };
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

	async uploadFiles(files: File[]): Promise<{
		uploaded: UploadedFile[];
		errors: Array<{ name: string; error: string }>;
	}> {
		const uploaded: UploadedFile[] = [];
		const errors: Array<{ name: string; error: string }> = [];

		const results = await Promise.allSettled(
			files.map((file) => this.uploadFile(file))
		);

		results.forEach((result, index) => {
			const file = files[index];

			if (result.status === "fulfilled") {
				const uploadResult = result.value;

				if (uploadResult.success && uploadResult.file) {
					uploaded.push(uploadResult.file);
				} else if (!uploadResult.success) {
					errors.push({
						name: file.name,
						error: uploadResult.error || "Unknown error",
					});
				}
			} else {
				errors.push({
					name: file.name,
					error: result.reason?.message || "Upload failed",
				});
			}
		});

		console.log(
			`📊 Batch upload: ${uploaded.length} uploaded, ${errors.length} errors in total.`
		);

		return { uploaded, errors };
	}
}
