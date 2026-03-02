import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { managerIdSchema } from "@/lib/api/validation";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";
import type { Pick } from "@/lib/fpl/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rl = await withRateLimit(request, "fpl");
  if (rl) return rl;

  const managerIdResult = managerIdSchema.safeParse(
    request.nextUrl.searchParams.get("managerId"),
  );
  if (!managerIdResult.success)
    return createValidationErrorResponse(managerIdResult.error);

  const managerId = managerIdResult.data;

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
    if (
      error instanceof Error &&
      (error.message === "FPL_SESSION_EXPIRED" ||
        error.message === "FPL_UNAUTHORIZED")
    ) {
      return createErrorResponse(
        "FPL session expired. Please reconnect in Settings.",
        "UNAUTHORIZED",
      );
    }
    console.error("Failed to fetch pending squad:", error);
    return createErrorResponse(
      "Failed to fetch pending squad",
      "INTERNAL_ERROR",
    );
  }
}
