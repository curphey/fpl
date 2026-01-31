import { NextRequest, NextResponse } from "next/server";
import { simulateDecision } from "@/lib/claude/simulator-client";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const simulationActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("captain_change"),
    from: z.string(),
    to: z.string(),
  }),
  z.object({
    type: z.literal("transfer"),
    out: z.string(),
    in: z.string(),
    cost: z.number(),
  }),
  z.object({
    type: z.literal("chip"),
    chip: z.enum(["freehit", "wildcard", "benchboost", "triplecaptain"]),
    gameweek: z.number(),
  }),
  z.object({
    type: z.literal("hold"),
    description: z.string(),
  }),
]);

const simulationRequestSchema = z.object({
  squad: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      position: z.string(),
      team: z.string(),
      expectedPoints: z.number(),
      ownership: z.number(),
    }),
  ),
  action: simulationActionSchema,
  leagueContext: z
    .object({
      rank: z.number(),
      totalManagers: z.number(),
      gapToLeader: z.number(),
      gameweeksRemaining: z.number(),
      rivalCaptains: z.array(z.string()).optional(),
    })
    .optional(),
  currentGameweek: z.number().min(1).max(38),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();

    const parseResult = simulationRequestSchema.safeParse(rawBody);
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

    const result = await simulateDecision(parseResult.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Simulation error:", error);

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
