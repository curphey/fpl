import { NextRequest, NextResponse } from "next/server";
import { getInjuryUpdates } from "@/lib/claude/news-client";
import { withRateLimit } from "@/lib/api/rate-limit";

/**
 * GET /api/news/injuries
 * Get injury updates for players
 *
 * Query params:
 * - players: comma-separated player names (optional, defaults to all flagged players)
 */
export async function GET(request: NextRequest) {
  // Check rate limit (10 requests per minute for Claude endpoints)
  const rateLimitResponse = await withRateLimit(request, "claude");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const playersParam = searchParams.get("players");

  const players = playersParam
    ? playersParam.split(",").map((s) => s.trim())
    : undefined;

  try {
    const injuries = await getInjuryUpdates(players);
    return NextResponse.json({
      injuries,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Injury updates error:", error);

    if (error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "News search not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch injury updates" },
      { status: 500 },
    );
  }
}
