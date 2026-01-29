import { NextRequest, NextResponse } from "next/server";
import { searchFPLNews } from "@/lib/claude/news-client";
import type { NewsSearchRequest, NewsCategory } from "@/lib/claude/news-types";

/**
 * GET /api/news
 * Search for FPL news
 *
 * Query params:
 * - q: search query
 * - players: comma-separated player names
 * - teams: comma-separated team names
 * - categories: comma-separated categories (injury,transfer,team_news,press_conference,suspension,general)
 * - limit: max results (default 10)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const query = searchParams.get("q") || undefined;
  const playersParam = searchParams.get("players");
  const teamsParam = searchParams.get("teams");
  const categoriesParam = searchParams.get("categories");
  const limitParam = searchParams.get("limit");

  const searchRequest: NewsSearchRequest = {
    query,
    players: playersParam
      ? playersParam.split(",").map((s) => s.trim())
      : undefined,
    teams: teamsParam ? teamsParam.split(",").map((s) => s.trim()) : undefined,
    categories: categoriesParam
      ? (categoriesParam.split(",").map((s) => s.trim()) as NewsCategory[])
      : undefined,
    maxResults: limitParam ? parseInt(limitParam, 10) : 10,
  };

  // At least one search parameter required
  if (!query && !playersParam && !teamsParam && !categoriesParam) {
    // Default to general FPL news
    searchRequest.query = "Premier League FPL news injuries transfers";
  }

  try {
    const response = await searchFPLNews(searchRequest);
    return NextResponse.json(response);
  } catch (error) {
    console.error("News search error:", error);

    if (error instanceof Error && error.message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "News search not configured" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 },
    );
  }
}
