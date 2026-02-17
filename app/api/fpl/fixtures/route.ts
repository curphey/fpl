import { NextRequest, NextResponse } from "next/server";
import { fplClient } from "@/lib/fpl/client";
import { gameweekSchema } from "@/lib/api/validation";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Check rate limit (100 requests per minute for FPL proxy endpoints)
  const rateLimitResponse = await withRateLimit(request, "fpl");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const event = searchParams.get("event");

    if (event) {
      const parseResult = gameweekSchema.safeParse(event);
      if (!parseResult.success) {
        return createValidationErrorResponse(parseResult.error);
      }
      const data = await fplClient.getFixturesByGameweek(parseResult.data);
      return NextResponse.json(data);
    }

    const data = await fplClient.getFixtures();
    return NextResponse.json(data);
  } catch (error) {
    return createErrorFromUnknown(error, "fetching fixtures");
  }
}
