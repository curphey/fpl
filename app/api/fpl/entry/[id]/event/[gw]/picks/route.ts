import { NextRequest, NextResponse } from "next/server";
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import { withRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gw: string }> },
) {
  // Check rate limit (100 requests per minute for FPL proxy endpoints)
  const rateLimitResponse = await withRateLimit(request, "fpl");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id, gw } = await params;
    const managerId = parseInt(id, 10);
    const gameweek = parseInt(gw, 10);

    if (isNaN(managerId) || managerId <= 0 || managerId > 100_000_000) {
      return NextResponse.json(
        { error: "Invalid manager ID" },
        { status: 400 },
      );
    }

    if (isNaN(gameweek) || gameweek < 1 || gameweek > 38) {
      return NextResponse.json(
        { error: "Invalid gameweek (must be 1-38)" },
        { status: 400 },
      );
    }

    const data = await fplClient.getManagerPicks(managerId, gameweek);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch manager picks" },
      { status: 500 },
    );
  }
}
