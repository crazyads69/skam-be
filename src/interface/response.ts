import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface ApiSuccessResponse<T = unknown> {
	success: true;
	data: T;
	message?: string;
}

export interface ApiErrorResponse {
	success: false;
	error: string;
	details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export const successResponse = <T>(
	c: Context,
	data: T,
	message?: string,
	status: ContentfulStatusCode = 200
) => {
	return c.json<ApiSuccessResponse<T>>(
		{
			success: true,
			data,
			message,
		},
		status
	);
};

export const errorResponse = (
	c: Context,
	error: string,
	status: ContentfulStatusCode = 400,
	details?: unknown
) => {
	return c.json<ApiErrorResponse>(
		{
			success: false,
			error,
			details,
		},
		status
	);
};
