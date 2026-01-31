import { NextRequest, NextResponse } from "next/server";
import { runOptimization } from "@/lib/claude/client";
import { fplClient, getCurrentGameweek } from "@/lib/fpl/client";
import type { OptimizeRequest } from "@/lib/claude/types";
import { optimizeRequestSchema } from "@/lib/api/validation";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60 seconds for extended thinking

export async function POST(request: NextRequest) {
  // Check rate limit (10 requests per minute for Claude endpoints)
  const rateLimitResponse = await withRateLimit(request, "claude");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const rawBody = await request.json();

    // Validate request with Zod
    const parseResult = optimizeRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return createValidationErrorResponse(parseResult.error);
    }
    const body = parseResult.data as OptimizeRequest;

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return createErrorResponse(
        "Claude API not configured",
        "SERVICE_UNAVAILABLE",
      );
    }

    // Fetch FPL data for context
    const [bootstrap, fixtures] = await Promise.all([
      fplClient.getBootstrapStatic(),
      fplClient.getFixtures(),
    ]);

    const currentGw = getCurrentGameweek(bootstrap);

    // Prepare player data (top players by form)
    const playerData = bootstrap.elements
      .filter((p) => p.minutes > 90)
      .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
      .slice(0, 100)
      .map((p) => {
        const team = bootstrap.teams.find((t) => t.id === p.team);
        const posMap: Record<number, string> = {
          1: "GK",
          2: "DEF",
          3: "MID",
          4: "FWD",
        };
        return {
          name: p.web_name,
          position: posMap[p.element_type] || "???",
          team: team?.short_name || "???",
          price: p.now_cost / 10,
          form: parseFloat(p.form) || 0,
          totalPoints: p.total_points,
          ownership: parseFloat(p.selected_by_percent) || 0,
          expectedPoints: parseFloat(p.ep_next || "0") || 0,
        };
      });

    // Prepare fixture data (next 5 GWs per team)
    const fixtureData = bootstrap.teams.map((team) => {
      const teamFixtures = fixtures
        .filter(
          (f) =>
            f.event !== null &&
            f.event >= currentGw &&
            f.event <= currentGw + 5 &&
            (f.team_h === team.id || f.team_a === team.id),
        )
        .map((f) => {
          const isHome = f.team_h === team.id;
          const opponentId = isHome ? f.team_a : f.team_h;
          const opponent = bootstrap.teams.find((t) => t.id === opponentId);
          return {
            gw: f.event!,
            opponent: opponent?.short_name || "???",
            difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
            home: isHome,
          };
        })
        .sort((a, b) => a.gw - b.gw);

      return {
        team: team.short_name,
        fixtures: teamFixtures,
      };
    });

    // Run optimization
    const result = await runOptimization(body, playerData, fixtureData);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Optimization error:", error);

    // Handle timeout errors specifically
    if (
      error instanceof Error &&
      (error.message.includes("timeout") || error.message.includes("Timeout"))
    ) {
      return createErrorResponse(
        "Request timed out. Try a simpler query.",
        "SERVICE_UNAVAILABLE",
      );
    }

    return createErrorFromUnknown(error, "running optimization");
  }
}
