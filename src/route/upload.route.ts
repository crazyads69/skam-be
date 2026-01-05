import { Hono } from "hono";
import { errorResponse, successResponse } from "../interface/response";
import { FilesSchema } from "../interface/upload";
import { turnstileVerify } from "../middleware/turnstile.middleware";
import { UploadService } from "../service/upload.service";

const uploadRouter = new Hono<{ Bindings: CloudflareBindings }>();

uploadRouter.post(
	"/",
	turnstileVerify({
		secretKey: (c) => c.env.TURNSTILE_SECRET_KEY,
	}),
	async (c) => {
		try {
			const uploadService = new UploadService(
				c.env.skam,
				c.env.SKAM_CACHE
			);

			const formData = await c.req.formData();
			const files: File[] = [];

			for (const [key, value] of formData.entries()) {
				if (value instanceof File) {
					files.push(value);
				}
			}

			const validation = FilesSchema.safeParse(files);

			if (!validation.success) {
				const errors = validation.error.issues.map((err) => ({
					field: err.path.join("."),
					message: err.message,
				}));
				return errorResponse(c, "File validation failed", 400, errors);
			}

			const result = await uploadService.uploadFiles(validation.data);

			if (result.uploaded.length === 0 && result.errors.length > 0) {
				return errorResponse(
					c,
					"All files failed to upload",
					400,
					result.errors
				);
			}

			return successResponse(
				c,
				{
					uploaded: result.uploaded,
					errors: result.errors,
				},
				`Uploaded ${result.uploaded.length} file(s), ${result.errors.length} error(s)`,
				201
			);
		} catch (error) {
			console.error("Upload error:", error);
			return errorResponse(
				c,
				"Failed to process upload",
				500,
				error instanceof Error ? error.message : undefined
			);
		}
	}
);

export default uploadRouter;
