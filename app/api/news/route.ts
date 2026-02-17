import { NextRequest, NextResponse } from "next/server";
import { searchFPLNews } from "@/lib/claude/news-client";
import type { NewsSearchRequest, NewsCategory } from "@/lib/claude/news-types";
import { withRateLimit } from "@/lib/api/rate-limit";
import { createErrorFromUnknown } from "@/lib/api/errors";

const VALID_CATEGORIES = new Set([
  "injury",
  "transfer",
  "team_news",
  "press_conference",
  "suspension",
  "general",
]);

/**
 * GET /api/news
 * Search for FPL news
 *
 * Query params:
 * - q: search query (max 500 chars)
 * - players: comma-separated player names (max 10)
 * - teams: comma-separated team names (max 20)
 * - categories: comma-separated categories (injury,transfer,team_news,press_conference,suspension,general)
 * - limit: max results (1-50, default 10)
 */
export async function GET(request: NextRequest) {
  // Check rate limit (10 requests per minute for Claude endpoints)
  const rateLimitResponse = await withRateLimit(request, "claude");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const searchParams = request.nextUrl.searchParams;

  const query = searchParams.get("q") || undefined;
  const playersParam = searchParams.get("players");
  const teamsParam = searchParams.get("teams");
  const categoriesParam = searchParams.get("categories");
  const limitParam = searchParams.get("limit");

  // Validate query length
  if (query && query.length > 500) {
    return NextResponse.json(
      {
        error: "Query too long (max 500 characters)",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const players = playersParam
    ? playersParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10)
    : undefined;
  const teams = teamsParam
    ? teamsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20)
    : undefined;

  // Validate categories
  let categories: NewsCategory[] | undefined;
  if (categoriesParam) {
    const raw = categoriesParam.split(",").map((s) => s.trim());
    const invalid = raw.filter((c) => !VALID_CATEGORIES.has(c));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid categories: ${invalid.join(", ")}`,
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }
    categories = raw as NewsCategory[];
  }

  // Validate and clamp limit
  const maxResults = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50)
    : 10;

  const searchRequest: NewsSearchRequest = {
    query,
    players,
    teams,
    categories,
    maxResults,
  };

  // At least one search parameter required
  if (!query && !playersParam && !teamsParam && !categoriesParam) {
    searchRequest.query = "Premier League FPL news injuries transfers";
  }

  try {
    const response = await searchFPLNews(searchRequest);
    return NextResponse.json(response);
  } catch (error) {
    console.error("News search error:", error);
    return createErrorFromUnknown(error, "searching news");
  }
}
