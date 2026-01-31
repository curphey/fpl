import { NextRequest, NextResponse } from "next/server";
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import { playerIdSchema, validationErrorResponse } from "@/lib/api/validation";
import { withRateLimit } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Check rate limit (100 requests per minute for FPL proxy endpoints)
  const rateLimitResponse = await withRateLimit(request, "fpl");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id } = await params;

    // Validate player ID with Zod
    const parseResult = playerIdSchema.safeParse(id);
    if (!parseResult.success) {
      return NextResponse.json(validationErrorResponse(parseResult.error), {
        status: 400,
      });
    }
    const playerId = parseResult.data;

    const data = await fplClient.getPlayerSummary(playerId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch player summary" },
      { status: 500 },
    );
  }
}
