import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
	GetCaseByIdParamSchema,
	GetCasesByAccountParamSchema,
	GetCasesByAccountQuerySchema,
	SearchScammerQuerySchema,
	SubmitCaseSchema,
} from "../interface/case";
import { errorResponse, successResponse } from "../interface/response";
import { turnstileVerify } from "../middleware/turnstile.middleware";
import { CaseService } from "../service/case.service";

const caseRouter = new Hono<{ Bindings: CloudflareBindings }>();

// Submit a new case
caseRouter.post(
	"/",
	turnstileVerify({
		secretKey: (c) => c.env.TURNSTILE_SECRET_KEY,
	}),
	zValidator("json", SubmitCaseSchema),
	async (c) => {
		try {
			const caseService = new CaseService(
				c.env.skam_db_dev,
				c.env.SKAM_CACHE
			);

			const input = c.req.valid("json");
			const newCase = await caseService.submitCase(input);

			return successResponse(
				c,
				{
					id: newCase.id,
					status: newCase.status,
					submittedAt: newCase.submittedAt,
				},
				"Case submitted successfully and pending review",
				201
			);
		} catch (error) {
			console.error("Submit case error:", error);
			return errorResponse(
				c,
				"Failed to submit case",
				500,
				error instanceof Error ? error.message : undefined
			);
		}
	}
);

// Search for scammer stats
caseRouter.get(
	"/search",
	zValidator("query", SearchScammerQuerySchema),
	async (c) => {
		try {
			const caseService = new CaseService(
				c.env.skam_db_dev,
				c.env.SKAM_CACHE
			);

			const params = c.req.valid("query");
			const result = await caseService.searchScammerStats(params);

			if (!result) {
				return errorResponse(c, "No scammer found", 404);
			}

			return successResponse(
				c,
				result,
				"Scammer stats found successfully"
			);
		} catch (error) {
			console.error("Search error:", error);
			return errorResponse(
				c,
				"Failed to search scammer",
				500,
				error instanceof Error ? error.message : undefined
			);
		}
	}
);

// Get case by ID
caseRouter.get(
	"/:id",
	zValidator("param", GetCaseByIdParamSchema),
	async (c) => {
		try {
			const caseService = new CaseService(
				c.env.skam_db_dev,
				c.env.SKAM_CACHE
			);

			const { id } = c.req.valid("param");
			const caseData = await caseService.getCaseById(id);

			if (!caseData) {
				return errorResponse(c, "Case not found", 404);
			}

			return successResponse(c, caseData, "Case retrieved successfully");
		} catch (error) {
			console.error("Get case error:", error);
			return errorResponse(
				c,
				"Failed to retrieve case",
				500,
				error instanceof Error ? error.message : undefined
			);
		}
	}
);

// Get cases by account identifier
caseRouter.get(
	"/account/:accountIdentifier/:bankCode",
	zValidator("param", GetCasesByAccountParamSchema),
	zValidator("query", GetCasesByAccountQuerySchema),
	async (c) => {
		try {
			const caseService = new CaseService(
				c.env.skam_db_dev,
				c.env.SKAM_CACHE
			);

			const { accountIdentifier, bankCode } = c.req.valid("param");
			const { limit, offset } = c.req.valid("query");

			const cases = await caseService.getCasesByAccountIdentifier(
				accountIdentifier,
				bankCode,
				limit,
				offset
			);

			return successResponse(
				c,
				{
					cases,
					count: cases.length,
					accountIdentifier,
					bankCode,
					limit,
					offset,
				},
				"Cases retrieved successfully"
			);
		} catch (error) {
			console.error("Get cases by account error:", error);
			return errorResponse(
				c,
				"Failed to retrieve cases",
				500,
				error instanceof Error ? error.message : undefined
			);
		}
	}
);

caseRouter.get("/stats/count", async (c) => {
	try {
		const caseService = new CaseService(
			c.env.skam_db_dev,
			c.env.SKAM_CACHE
		);

		const count = await caseService.countCases();

		return successResponse(
			c,
			{ count },
			"Approved cases count retrieved successfully"
		);
	} catch (error) {
		console.error("Count cases error:", error);
		return errorResponse(
			c,
			"Failed to count cases",
			500,
			error instanceof Error ? error.message : undefined
		);
	}
});

export default caseRouter;
