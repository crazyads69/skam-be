import type { Context } from "hono";

export const generateRateLimitKey = (c: Context) => {
	return (
		c.req.header("X-Fingerprint") ||
		c.req.header("cf-connecting-ip") ||
		"unknown"
	);
};

export const ALLOWED_FILE_TYPES = {
	"image/jpeg": [".jpg", ".jpeg"],
	"image/png": [".png"],
	"image/webp": [".webp"],
	"video/mp4": [".mp4"],
	"video/webm": [".webm"],
	"audio/mpeg": [".mp3"],
	"audio/wav": [".wav"],
	"application/pdf": [".pdf"],
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
		".docx",
	],
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
		".xlsx",
	],
	"text/plain": [".txt"],
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 5;

export const isAllowedFileType = (contentType: string): boolean => {
	return contentType in ALLOWED_FILE_TYPES;
};

export const getFileExtension = (contentType: string): string => {
	const extensions =
		ALLOWED_FILE_TYPES[contentType as keyof typeof ALLOWED_FILE_TYPES];
	return extensions ? extensions[0] : "";
};
