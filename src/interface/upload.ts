import { z } from "zod";
import {
	ALLOWED_FILE_TYPES,
	isAllowedFileType,
	MAX_FILE_SIZE,
	MAX_FILES_PER_REQUEST,
} from "../utils/utils";

// ============= REQUEST SCHEMAS =============

// File validation schema
export const FileSchema = z
	.instanceof(File)
	.refine((file) => file.size <= MAX_FILE_SIZE, {
		message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
	})
	.refine((file) => file.size > 0, {
		message: "File cannot be empty",
	})
	.refine((file) => isAllowedFileType(file.type), {
		message: `Unsupported file type. Allowed: ${Object.keys(
			ALLOWED_FILE_TYPES
		).join(", ")}`,
	});

export const FilesSchema = z.array(FileSchema).max(MAX_FILES_PER_REQUEST, {
	message: `Maximum ${MAX_FILES_PER_REQUEST} files allowed`,
});

// ============= RESPONSE SCHEMAS =============

export const UploadedFileSchema = z.object({
	key: z.string(), // R2 key (hash-based)
	name: z.string(), // Original filename
	size: z.number(), // File size in bytes
	contentType: z.string(), // MIME type
	hash: z.string(), // SHA-256 hash
	url: z.string().optional(), // Public URL if needed
	uploadedAt: z.string(), // ISO timestamp
});

export const UploadErrorSchema = z.object({
	name: z.string(),
	error: z.string(),
});

export const UploadFilesResponseSchema = z.object({
	uploaded: z.array(UploadedFileSchema),
	errors: z.array(UploadErrorSchema),
});

// ============= SERVICE RETURN TYPES =============

export interface UploadServiceUploadFileResult {
	success: boolean;
	file?: UploadedFile;
	error?: string;
}

export interface UploadServiceUploadFilesResult {
	uploaded: UploadedFile[];
	errors: UploadError[];
}

// ============= TYPES =============

export type UploadedFile = z.infer<typeof UploadedFileSchema>;
export type UploadError = z.infer<typeof UploadErrorSchema>;
export type UploadFilesResponse = z.infer<typeof UploadFilesResponseSchema>;
