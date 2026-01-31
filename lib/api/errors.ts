/**
 * Standardized API error handling utilities.
 * Provides consistent error responses across all API routes.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Standard error codes used across the API.
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "FPL_API_ERROR"
  | "CLAUDE_API_ERROR"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  | "SERVICE_UNAVAILABLE";

/**
 * Standard API error response structure.
 */
export interface ApiErrorResponse {
  error: string;
  code: ApiErrorCode;
  details?: unknown;
}

/**
 * HTTP status codes for each error code.
 */
const ERROR_STATUS_CODES: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  FPL_API_ERROR: 502,
  CLAUDE_API_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/**
 * Create a standardized error response.
 *
 * @param message - Human-readable error message
 * @param code - Error code for programmatic handling
 * @param details - Optional additional context
 * @returns NextResponse with JSON error body
 *
 * @example
 * return createErrorResponse("Manager not found", "NOT_FOUND");
 *
 * @example
 * return createErrorResponse(
 *   "Rate limit exceeded",
 *   "RATE_LIMITED",
 *   { retryAfter: 60 }
 * );
 */
export function createErrorResponse(
  message: string,
  code: ApiErrorCode,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  const status = ERROR_STATUS_CODES[code];
  const body: ApiErrorResponse = { error: message, code };

  if (details !== undefined) {
    body.details = details;
  }

  return NextResponse.json(body, { status });
}

/**
 * Create an error response from a Zod validation error.
 *
 * @param error - Zod error from failed validation
 * @returns NextResponse with 400 status and validation details
 *
 * @example
 * const result = schema.safeParse(data);
 * if (!result.success) {
 *   return createValidationErrorResponse(result.error);
 * }
 */
export function createValidationErrorResponse(
  error: z.ZodError,
): NextResponse<ApiErrorResponse> {
  const firstIssue = error.issues[0];
  const path = firstIssue?.path.join(".") || "request";
  const message = firstIssue?.message || "Invalid request";

  return createErrorResponse(`${path}: ${message}`, "VALIDATION_ERROR", {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
  });
}

/**
 * Create an error response from an unknown error.
 * Safely handles different error types and avoids exposing internal details.
 *
 * @param error - Any error object
 * @param context - Optional context about where the error occurred
 * @returns NextResponse with appropriate status and message
 *
 * @example
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   return createErrorFromUnknown(error, "fetching player data");
 * }
 */
export function createErrorFromUnknown(
  error: unknown,
  context?: string,
): NextResponse<ApiErrorResponse> {
  // Handle rate limiting errors
  if (error instanceof Error && error.message.includes("rate")) {
    return createErrorResponse(
      "Rate limit exceeded. Please try again later.",
      "RATE_LIMITED",
    );
  }

  // Handle FPL API errors
  if (error instanceof Error && error.name === "FPLApiError") {
    const fplError = error as Error & {
      statusCode?: number;
      endpoint?: string;
    };
    const status = fplError.statusCode || 502;

    if (status === 404) {
      return createErrorResponse(
        context ? `${context} not found` : "Resource not found",
        "NOT_FOUND",
      );
    }

    return createErrorResponse(
      `FPL API error: ${error.message}`,
      "FPL_API_ERROR",
      { endpoint: fplError.endpoint },
    );
  }

  // Handle Claude API errors
  if (error instanceof Error && error.message.includes("Claude")) {
    return createErrorResponse(
      "AI service temporarily unavailable",
      "CLAUDE_API_ERROR",
    );
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : context
          ? `Error ${context}`
          : "An unexpected error occurred";

    return createErrorResponse(message, "INTERNAL_ERROR");
  }

  // Unknown error type
  return createErrorResponse(
    context ? `Error ${context}` : "An unexpected error occurred",
    "INTERNAL_ERROR",
  );
}

/**
 * Create a not found error response.
 *
 * @param resource - Name of the resource that wasn't found
 * @returns NextResponse with 404 status
 *
 * @example
 * return createNotFoundResponse("Manager");
 * // Returns: { error: "Manager not found", code: "NOT_FOUND" }
 */
export function createNotFoundResponse(
  resource: string,
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(`${resource} not found`, "NOT_FOUND");
}

/**
 * Create an unauthorized error response.
 *
 * @param message - Optional custom message
 * @returns NextResponse with 401 status
 */
export function createUnauthorizedResponse(
  message = "Authentication required",
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, "UNAUTHORIZED");
}

/**
 * Create a rate limited error response.
 *
 * @param retryAfterSeconds - Optional seconds until rate limit resets
 * @returns NextResponse with 429 status
 */
export function createRateLimitedResponse(
  retryAfterSeconds?: number,
): NextResponse<ApiErrorResponse> {
  const response = createErrorResponse(
    "Rate limit exceeded. Please try again later.",
    "RATE_LIMITED",
    retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined,
  );

  if (retryAfterSeconds) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return response;
}

/**
 * Create a bad request error response.
 *
 * @param message - Description of what's wrong with the request
 * @returns NextResponse with 400 status
 */
export function createBadRequestResponse(
  message: string,
): NextResponse<ApiErrorResponse> {
  return createErrorResponse(message, "BAD_REQUEST");
}
