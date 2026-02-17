import { NextRequest, NextResponse } from "next/server";
import { analyzeRival } from "@/lib/claude/simulator-client";
import { z } from "zod";
import { withRateLimit } from "@/lib/api/rate-limit";
import { hasAnthropicApiKey } from "@/lib/db/settings";
import { createErrorFromUnknown } from "@/lib/api/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const rivalAnalysisRequestSchema = z.object({
  rival: z.object({
    managerId: z.number(),
    name: z.string(),
    chipsUsed: z.array(
      z.object({
        chip: z.string(),
        gameweek: z.number(),
      }),
    ),
    captainHistory: z.array(
      z.object({
        gameweek: z.number(),
        player: z.string(),
        points: z.number(),
      }),
    ),
    transferPatterns: z.array(
      z.object({
        gameweek: z.number(),
        in: z.string(),
        out: z.string(),
      }),
    ),
    rank: z.number(),
    pointsGap: z.number(),
  }),
  yourSquad: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      position: z.string(),
      team: z.string(),
      expectedPoints: z.number(),
      ownership: z.number(),
    }),
  ),
  upcomingFixtures: z.array(
    z.object({
      gameweek: z.number(),
      isDGW: z.boolean(),
      isBGW: z.boolean(),
      favorableTeams: z.array(z.string()),
    }),
  ),
  currentGameweek: z.number().min(1).max(38),
});

export async function POST(request: NextRequest) {
  // Check rate limit (10 requests per minute for Claude endpoints)
  const rateLimitResponse = await withRateLimit(request, "claude");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const rawBody = await request.json();

    const parseResult = rivalAnalysisRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          code: "VALIDATION_ERROR",
          details: parseResult.error.issues,
        },
        { status: 400 },
      );
    }

    if (!hasAnthropicApiKey()) {
      return NextResponse.json(
        {
          error:
            "Anthropic API key not configured. Please add your API key in Settings.",
          code: "API_ERROR",
        },
        { status: 503 },
      );
    }

    const result = await analyzeRival(parseResult.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Rival analysis error:", error);
    return createErrorFromUnknown(error, "analyzing rival");
  }
}
