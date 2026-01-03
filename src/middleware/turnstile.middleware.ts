import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { errorResponse } from "../interface/response";
import {
	TurnstileResponseSchema,
	type TurnstileResponse,
} from "../interface/turnstile";

interface TurnstileOptions {
	secretKey: string | ((c: Context) => string);
	expectedAction?: string;
	expectedHostname?: string;
}

export const turnstileVerify = (
	options: TurnstileOptions
): MiddlewareHandler => {
	const { secretKey, expectedAction, expectedHostname } = options;

	if (!secretKey) {
		throw new Error("Turnstile secret key is required");
	}

	return createMiddleware<{
		Variables: {
			turnstileValidation: TurnstileResponse;
		};
	}>(async (c, next) => {
		try {
			const secret =
				typeof secretKey === "function" ? secretKey(c) : secretKey;

			if (!secret) {
				return errorResponse(c, "Turnstile secret key is missing", 500);
			}

			let token: string | null = null;
			const contentType = c.req.header("content-type") || "";

			if (contentType.includes("application/json")) {
				const body = await c.req.json().catch(() => ({}));
				token = body["cf-turnstile-response"] || null;
			} else if (
				contentType.includes("application/x-www-form-urlencoded") ||
				contentType.includes("multipart/form-data")
			) {
				const formData = await c.req
					.formData()
					.catch(() => new FormData());
				token = formData.get("cf-turnstile-response") as string | null;
			}

			if (!token) {
				return errorResponse(c, "Turnstile token is missing", 400);
			}

			if (token.length > 2048) {
				return errorResponse(c, "Turnstile token is invalid", 400);
			}

			const remoteIp =
				c.req.header("CF-Connecting-IP") ||
				c.req.header("X-Forwarded-For") ||
				c.req.header("X-Real-IP");

			const formData = new FormData();
			formData.append("secret", secret);
			formData.append("response", token);
			if (remoteIp) {
				formData.append("remoteip", remoteIp);
			}

			const response = await fetch(
				"https://challenges.cloudflare.com/turnstile/v0/siteverify",
				{
					method: "POST",
					body: formData,
				}
			);

			if (!response.ok) {
				return errorResponse(
					c,
					"Turnstile verification service error",
					500
				);
			}

			const result: TurnstileResponse =
				await TurnstileResponseSchema.parseAsync(await response.json());

			if (!result.success) {
				return errorResponse(
					c,
					"Turnstile verification failed",
					400,
					result["error-codes"]
				);
			}

			if (expectedAction && result.action !== expectedAction) {
				return errorResponse(c, "Turnstile action mismatch", 400);
			}

			if (expectedHostname && result.hostname !== expectedHostname) {
				return errorResponse(c, "Turnstile hostname mismatch", 400);
			}

			c.set("turnstileValidation", result);

			await next();
		} catch (error) {
			console.error("Turnstile verification error:", error);
			return errorResponse(
				c,
				"Internal error during verification",
				500,
				error instanceof Error ? error.message : undefined
			);
		}
	});
};
