import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";
import type { Pick } from "@/lib/fpl/types";

export const runtime = "nodejs";

const querySchema = z.object({
  managerId: z
    .string()
    .regex(/^\d+$/, "managerId must be a positive integer")
    .transform(Number),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rl = await withRateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = querySchema.safeParse({
    managerId: request.nextUrl.searchParams.get("managerId"),
  });
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { managerId } = parsed.data;

  const fplSession = getFplSession();
  if (!fplSession) {
    return createErrorResponse(
      "FPL session expired. Please reconnect in Settings.",
      "UNAUTHORIZED",
    );
  }

  try {
    const resp = await authenticatedFetch(
      `https://fantasy.premierleague.com/api/my-team/${managerId}/`,
    );
    if (!resp.ok) {
      return createErrorResponse(
        "Failed to fetch pending squad",
        "FPL_API_ERROR",
      );
    }
    const data = (await resp.json()) as { picks: Pick[] };
    return NextResponse.json({ picks: data.picks });
  } catch (error) {
    if (error instanceof Error && error.message === "FPL_SESSION_EXPIRED") {
      return createErrorResponse(
        "FPL session expired. Please reconnect in Settings.",
        "UNAUTHORIZED",
      );
    }
    return createErrorResponse(
      "Failed to fetch pending squad",
      "INTERNAL_ERROR",
    );
  }
}
