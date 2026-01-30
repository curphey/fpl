import { NextRequest, NextResponse } from "next/server";
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import {
  leagueIdSchema,
  pageSchema,
  validationErrorResponse,
} from "@/lib/api/validation";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Validate league ID with Zod
    const leagueParseResult = leagueIdSchema.safeParse(id);
    if (!leagueParseResult.success) {
      return NextResponse.json(
        validationErrorResponse(leagueParseResult.error),
        { status: 400 },
      );
    }
    const leagueId = leagueParseResult.data;

    // Validate page parameter
    const searchParams = request.nextUrl.searchParams;
    const pageParseResult = pageSchema.safeParse(searchParams.get("page") || 1);
    const page = pageParseResult.success ? pageParseResult.data : 1;

    const data = await fplClient.getLeagueStandings(leagueId, page);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch league standings" },
      { status: 500 },
    );
  }
}
