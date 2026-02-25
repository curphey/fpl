import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import { createValidationErrorResponse } from "@/lib/api/errors";
import { getTransferPredictions } from "@/lib/db/gw-plan";

export const runtime = "nodejs";

const getQuerySchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimitResponse = await rateLimit(request, "fpl");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    sessionId: searchParams.get("sessionId") ?? undefined,
  };

  const parseResult = getQuerySchema.safeParse(rawQuery);
  if (!parseResult.success) {
    return createValidationErrorResponse(parseResult.error);
  }

  const { sessionId } = parseResult.data;

  const predictions = getTransferPredictions(sessionId);

  return NextResponse.json({ predictions });
}
