import type { Context } from "hono";

export const generateRateLimitKey = (c: Context) => {
	return (
		c.req.header("X-Fingerprint") ||
		c.req.header("cf-connecting-ip") ||
		"unknown"
	);
};
