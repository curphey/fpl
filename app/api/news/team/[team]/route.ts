import { NextRequest, NextResponse } from "next/server";
import { getTeamNews } from "@/lib/claude/news-client";
import { withRateLimit } from "@/lib/api/rate-limit";

/**
 * GET /api/news/team/[team]
 * Get team news and lineup predictions
 *
 * Params:
 * - team: team name (URL encoded)
 *
 * Query params:
 * - gw: gameweek number (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ team: string }> },
) {
  // Check rate limit (10 requests per minute for Claude endpoints)
  const rateLimitResponse = await withRateLimit(request, "claude");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { team } = await params;
  const searchParams = request.nextUrl.searchParams;
  const gwParam = searchParams.get("gw");

  if (!gwParam) {
    return NextResponse.json(
      { error: "Missing required parameter: gw (gameweek)" },
      { status: 400 },
    );
  }

  const gameweek = parseInt(gwParam, 10);
  if (isNaN(gameweek) || gameweek < 1 || gameweek > 38) {
    return NextResponse.json(
      { error: "Invalid gameweek (must be 1-38)" },
      { status: 400 },
    );
  }

  const teamName = decodeURIComponent(team);

  try {
    const teamNews = await getTeamNews(teamName, gameweek);

    if (!teamNews) {
      return NextResponse.json(
        { error: "No team news found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...teamNews,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Team news error:", error);

    if (error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "News search not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch team news" },
      { status: 500 },
    );
  }
}
