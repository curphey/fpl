import { NextRequest, NextResponse } from "next/server";
import { fplClient } from "@/lib/fpl/client";
import { leagueIdSchema, pageSchema } from "@/lib/api/validation";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Check rate limit (100 requests per minute for FPL proxy endpoints)
  const rateLimitResponse = await withRateLimit(request, "fpl");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await params;

    const leagueParseResult = leagueIdSchema.safeParse(id);
    if (!leagueParseResult.success) {
      return createValidationErrorResponse(leagueParseResult.error);
    }
    const leagueId = leagueParseResult.data;

    const searchParams = request.nextUrl.searchParams;
    const pageParseResult = pageSchema.safeParse(searchParams.get("page") || 1);
    const page = pageParseResult.success ? pageParseResult.data : 1;

    const data = await fplClient.getLeagueStandings(leagueId, page);
    return NextResponse.json(data);
  } catch (error) {
    return createErrorFromUnknown(error, "fetching league standings");
  }
}
