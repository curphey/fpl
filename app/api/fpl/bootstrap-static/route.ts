import { NextRequest, NextResponse } from "next/server";
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import { withRateLimit } from "@/lib/api/rate-limit";
import { enrichPlayers } from "@/lib/fpl/utils";
import type { BootstrapStatic } from "@/lib/fpl/types";
import type { EnrichedPlayer } from "@/lib/fpl/utils";

export const dynamic = "force-dynamic";
export const revalidate = 300; // Cache for 5 minutes

/**
 * Extended bootstrap response with optional enriched players.
 * When enrich=true, elements array contains EnrichedPlayer objects
 * with pre-computed values (form, xG, xA, etc.)
 */
export interface EnrichedBootstrapStatic extends Omit<
  BootstrapStatic,
  "elements"
> {
  elements: EnrichedPlayer[];
  enriched: true;
}

export type BootstrapStaticResponse = BootstrapStatic | EnrichedBootstrapStatic;

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
    if (error instanceof FPLApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch bootstrap data" },
      { status: 500 },
    );
  }
}
