import { NextRequest, NextResponse } from "next/server";
import { predictInjuryReturn } from "@/lib/claude/simulator-client";
import { z } from "zod";
import { withRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const injuryPredictionRequestSchema = z.object({
  player: z.object({
    id: z.number(),
    name: z.string(),
    team: z.string(),
    position: z.string(),
    injuryType: z.string(),
    news: z.string(),
    newsAdded: z.string().nullable(),
    chanceOfPlaying: z.number().nullable(),
    price: z.number(),
    formBeforeInjury: z.number(),
    expectedPointsPerGame: z.number(),
  }),
  currentGameweek: z.number().min(1).max(38),
  squadContext: z
    .object({
      hasPlayer: z.boolean(),
      replacementOptions: z.array(z.string()),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  // Check rate limit (10 requests per minute for Claude endpoints)
  const rateLimitResponse = await withRateLimit(request, "claude");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const rawBody = await request.json();

    const parseResult = injuryPredictionRequestSchema.safeParse(rawBody);
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Claude API not configured", code: "API_ERROR" },
        { status: 503 },
      );
    }

    const result = await predictInjuryReturn(parseResult.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Injury prediction error:", error);

    if (error instanceof Error) {
      if (error.message.includes("rate")) {
        return NextResponse.json(
          {
            error: "Rate limited. Please try again later.",
            code: "RATE_LIMITED",
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: error.message, code: "API_ERROR" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred", code: "API_ERROR" },
      { status: 500 },
    );
  }
}
