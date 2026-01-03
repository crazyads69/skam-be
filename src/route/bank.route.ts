import { Hono } from "hono";
import { BankService } from "../service/bank.service";
import { errorResponse, successResponse } from "../interface/response";

const bankRouter = new Hono<{ Bindings: Env }>();

bankRouter.get("/", async (c) => {
	try {
		const bankService = new BankService(c.env.SKAM_RATE_LIMIT);
		const banks = await bankService.getBanks();

		return successResponse(c, banks, "Banks fetched successfully");
	} catch (error) {
		console.error("Error fetching banks:", error);
		return errorResponse(c, "Failed to fetch banks", 500);
	}
});

export default bankRouter;
