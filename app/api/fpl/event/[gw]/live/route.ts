import { NextRequest, NextResponse } from "next/server";
import { fplClient } from "@/lib/fpl/client";
import { gameweekSchema } from "@/lib/api/validation";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gw: string }> },
) {
  // Check rate limit (100 requests per minute for FPL proxy endpoints)
  const rateLimitResponse = await withRateLimit(request, "fpl");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { gw } = await params;

    const parseResult = gameweekSchema.safeParse(gw);
    if (!parseResult.success) {
      return createValidationErrorResponse(parseResult.error);
    }
    const gameweek = parseResult.data;

    const data = await fplClient.getLiveGameweek(gameweek);
    return NextResponse.json(data);
  } catch (error) {
    return createErrorFromUnknown(error, "fetching live gameweek data");
  }
}
