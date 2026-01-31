/**
 * League Analysis Aggregation API
 * Server-side endpoint to fetch and aggregate rival picks, eliminating N+1 queries from client.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import {
  managerIdSchema,
  gameweekSchema,
  validationErrorResponse,
  FPL_CONSTANTS,
} from "@/lib/api/validation";
import {
  createErrorResponse,
  createErrorFromUnknown,
  createValidationErrorResponse,
} from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import type {
  ManagerPicks,
  ManagerHistory,
  ManagerChip,
} from "@/lib/fpl/types";

// Request validation schema
const leagueAnalysisSchema = z.object({
  managerIds: z
    .array(managerIdSchema)
    .min(1, "At least one manager ID required")
    .max(50, "Maximum 50 managers allowed"),
  gameweek: gameweekSchema,
  includeChips: z.boolean().optional().default(false),
});

export type LeagueAnalysisRequest = z.infer<typeof leagueAnalysisSchema>;

export interface RivalPicksData {
  managerId: number;
  picks: ManagerPicks | null;
  error?: string;
}

export interface RivalChipData {
  managerId: number;
  chips: ManagerChip[];
  error?: string;
}

export interface LeagueAnalysisResponse {
  gameweek: number;
  rivalPicks: RivalPicksData[];
  rivalChips?: RivalChipData[];
  fetchedAt: string;
  stats: {
    totalRequested: number;
    successfulPicks: number;
    failedPicks: number;
    successfulChips?: number;
    failedChips?: number;
  };
}

export async function POST(request: NextRequest) {
  // Rate limiting - use FPL tier since this aggregates FPL API calls
  const rateLimitResponse = await withRateLimit(request, "fpl");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const parseResult = leagueAnalysisSchema.safeParse(body);

    if (!parseResult.success) {
      return createValidationErrorResponse(parseResult.error);
    }

    const { managerIds, gameweek, includeChips } = parseResult.data;

    // Fetch all rival picks in parallel
    const picksPromises = managerIds.map(
      async (managerId): Promise<RivalPicksData> => {
        try {
          const picks = await fplClient.getManagerPicks(managerId, gameweek);
          return { managerId, picks };
        } catch (error) {
          const message =
            error instanceof FPLApiError
              ? error.message
              : "Failed to fetch picks";
          return { managerId, picks: null, error: message };
        }
      },
    );

    // Optionally fetch chip histories in parallel
    let chipsPromises: Promise<RivalChipData>[] = [];
    if (includeChips) {
      chipsPromises = managerIds.map(
        async (managerId): Promise<RivalChipData> => {
          try {
            const history = await fplClient.getManagerHistory(managerId);
            return { managerId, chips: history.chips };
          } catch (error) {
            const message =
              error instanceof FPLApiError
                ? error.message
                : "Failed to fetch history";
            return { managerId, chips: [], error: message };
          }
        },
      );
    }

    // Execute all fetches concurrently
    const [rivalPicks, rivalChips] = await Promise.all([
      Promise.all(picksPromises),
      includeChips ? Promise.all(chipsPromises) : Promise.resolve(undefined),
    ]);

    // Calculate stats
    const successfulPicks = rivalPicks.filter((r) => r.picks !== null).length;
    const failedPicks = rivalPicks.length - successfulPicks;

    const stats: LeagueAnalysisResponse["stats"] = {
      totalRequested: managerIds.length,
      successfulPicks,
      failedPicks,
    };

    if (includeChips && rivalChips) {
      stats.successfulChips = rivalChips.filter((r) => !r.error).length;
      stats.failedChips = rivalChips.length - stats.successfulChips;
    }

    const response: LeagueAnalysisResponse = {
      gameweek,
      rivalPicks,
      ...(includeChips && rivalChips ? { rivalChips } : {}),
      fetchedAt: new Date().toISOString(),
      stats,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return createErrorFromUnknown(error, "league analysis");
  }
}
