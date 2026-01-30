import { NextRequest, NextResponse } from "next/server";
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import { gameweekSchema, validationErrorResponse } from "@/lib/api/validation";

export const dynamic = "force-dynamic";
export const revalidate = 60; // Cache for 1 minute during live games

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gw: string }> },
) {
  try {
    const { gw } = await params;

    // Validate gameweek with Zod
    const parseResult = gameweekSchema.safeParse(gw);
    if (!parseResult.success) {
      return NextResponse.json(validationErrorResponse(parseResult.error), {
        status: 400,
      });
    }
    const gameweek = parseResult.data;

    const data = await fplClient.getLiveGameweek(gameweek);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch live gameweek data" },
      { status: 500 },
    );
  }
}
