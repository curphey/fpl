import { NextRequest, NextResponse } from "next/server";
import { fplClient } from "@/lib/fpl/client";
import { managerIdSchema } from "@/lib/api/validation";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";

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

    // Validate manager ID with Zod
    const parseResult = managerIdSchema.safeParse(id);
    if (!parseResult.success) {
      return createValidationErrorResponse(parseResult.error);
    }
    const managerId = parseResult.data;

    const data = await fplClient.getManager(managerId);
    return NextResponse.json(data);
  } catch (error) {
    return createErrorFromUnknown(error, "fetching manager data");
  }
}
