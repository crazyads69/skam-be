import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { poweredBy } from "hono/powered-by";
import { rateLimiter } from "hono-rate-limiter";
import bankRouter from "./route/bank.route";
import caseRouter from "./route/case.route";
import uploadRouter from "./route/upload.route";
import { generateRateLimitKey } from "./utils/utils";

const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api/v1");

app.use(
	"*",
	cors({
		origin: "*",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "X-Fingerprint"],
		exposeHeaders: [
			"X-RateLimit-Limit",
			"X-RateLimit-Remaining",
			"X-RateLimit-Reset",
			"Retry-After",
		],
		maxAge: 86400,
	})
);

app.use(
	poweredBy({
		serverName: "Cloudflare Workers",
	})
);

app.use("*", logger());

app.use("*", async (c, next) => {
	const _path = c.req.path;

	if (_path === "/api/v1/health") {
		return next();
	}

	if (_path.startsWith("/api/v1/upload")) {
		return rateLimiter<{ Bindings: CloudflareBindings }>({
			binding: c.env.SKAM_RATE_LIMIT_UPLOAD,
			keyGenerator: (c) => generateRateLimitKey(c),
		})(c, next);
	}

	if (_path.startsWith("/api/v1/cases")) {
		return rateLimiter<{ Bindings: CloudflareBindings }>({
			binding: c.env.SKAM_RATE_LIMIT_SUBMIT,
			keyGenerator: (c) => generateRateLimitKey(c),
		})(c, next);
	}

	if (_path.startsWith("/api/v1/search")) {
		return rateLimiter<{ Bindings: CloudflareBindings }>({
			binding: c.env.SKAM_RATE_LIMIT_SEARCH,
			keyGenerator: (c) => generateRateLimitKey(c),
		})(c, next);
	}

	// Fallback to rate limiting default
	return rateLimiter<{ Bindings: CloudflareBindings }>({
		binding: c.env.SKAM_RATE_LIMIT,
		keyGenerator: (c) => generateRateLimitKey(c),
	})(c, next);
});

app.get("/health", (c) => {
	return c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		version: "1.0.0",
	});
});

app.route("/banks", bankRouter);
app.route("/upload", uploadRouter);
app.route("/cases", caseRouter);

app.notFound((c) => {
	return c.json({ success: false, error: "Not found" }, 404);
});

export default app;
