import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import bankRouter from "./route/bank.route";

const app = new Hono<{ Bindings: Env }>().basePath("/api/v1");

app.use(
	"*",
	cors({
		origin: "*", // TODO: restrict in production
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		maxAge: 86400,
	})
);

app.use("*", logger());

app.get("/health", (c) => {
	return c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		version: "1.0.0",
	});
});

app.route("/banks", bankRouter);

export default app;
