import { NextRequest, NextResponse } from "next/server";
import { fplClient } from "@/lib/fpl/client";
import { managerIdSchema, gameweekSchema } from "@/lib/api/validation";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gw: string }> },
) {
  // Check rate limit (100 requests per minute for FPL proxy endpoints)
  const rateLimitResponse = await withRateLimit(request, "fpl");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id, gw } = await params;

    const managerResult = managerIdSchema.safeParse(id);
    if (!managerResult.success) {
      return createValidationErrorResponse(managerResult.error);
    }
    const managerId = managerResult.data;

    const gwResult = gameweekSchema.safeParse(gw);
    if (!gwResult.success) {
      return createValidationErrorResponse(gwResult.error);
    }
    const gameweek = gwResult.data;

    const data = await fplClient.getManagerPicks(managerId, gameweek);
    return NextResponse.json(data);
  } catch (error) {
    return createErrorFromUnknown(error, "fetching manager picks");
  }
}
