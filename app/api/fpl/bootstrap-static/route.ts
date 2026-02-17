import { NextRequest, NextResponse } from "next/server";
import { fplClient } from "@/lib/fpl/client";
import { withRateLimit } from "@/lib/api/rate-limit";
import { createErrorFromUnknown } from "@/lib/api/errors";
import { enrichPlayers } from "@/lib/fpl/utils";
import type { EnrichedBootstrapStatic } from "@/lib/fpl/hooks/use-fpl";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Check rate limit (100 requests per minute for FPL proxy endpoints)
  const rateLimitResponse = await withRateLimit(request, "fpl");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const data = await fplClient.getBootstrapStatic();

    // Check for enrich query parameter
    const enrich = request.nextUrl.searchParams.get("enrich") === "true";

    if (enrich) {
      // Perform enrichment on the server
      const enrichedElements = enrichPlayers(data);
      const enrichedResponse: EnrichedBootstrapStatic = {
        ...data,
        elements: enrichedElements,
        enriched: true,
      };
      return NextResponse.json(enrichedResponse);
    }

    return NextResponse.json(data);
  } catch (error) {
    return createErrorFromUnknown(error, "fetching bootstrap data");
  }
}
