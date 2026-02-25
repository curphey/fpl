import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";
import {
  getGwPlan,
  saveGwPlan,
  insertTransferPrediction,
} from "@/lib/db/gw-plan";
import { generateGwPlan } from "@/lib/claude/gw-plan-client";
import { getSession } from "@/lib/db/sessions";
import { fplClient } from "@/lib/fpl/client";
import { enrichPlayers } from "@/lib/fpl/utils";
import { scoreTransferTargets } from "@/lib/fpl/transfer-model";
import { scoreCaptainOptions } from "@/lib/fpl/captain-model";
import { predictPoints } from "@/lib/fpl/points-model";
import type { GwPlanRequest } from "@/lib/claude/gw-plan-client";

export const runtime = "nodejs";
export const maxDuration = 60;

// =============================================================================
// Validation schemas
// =============================================================================

const getQuerySchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  gw: z.coerce.number().int().min(1).max(38),
});

const postBodySchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  gameweek: z.number().int().min(1).max(38),
});

// =============================================================================
// GET handler — return cached plan
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const rawQuery = {
    sessionId: searchParams.get("sessionId") ?? undefined,
    gw: searchParams.get("gw") ?? undefined,
  };

  const parseResult = getQuerySchema.safeParse(rawQuery);
  if (!parseResult.success) {
    return createValidationErrorResponse(parseResult.error);
  }

  const { sessionId, gw } = parseResult.data;

  const cached = getGwPlan(sessionId, gw);
  if (!cached) {
    return createErrorResponse("No plan found for this gameweek", "NOT_FOUND");
  }

  return NextResponse.json(cached);
}

// =============================================================================
// POST handler — generate a new plan
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit (claude tier — expensive AI call)
  const rateLimitResponse = await rateLimit(request, "claude");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const rawBody = await request.json();

    const parseResult = postBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return createValidationErrorResponse(parseResult.error);
    }

    const { sessionId, gameweek } = parseResult.data;

    // Verify session has a connected FPL manager
    const session = getSession(sessionId);
    if (!session?.fpl_manager_id) {
      return createErrorResponse(
        "No FPL manager connected to this session",
        "NOT_FOUND",
      );
    }

    const managerId = session.fpl_manager_id;

    // Fetch FPL data in parallel
    const [bootstrap, fixtures, picks] = await Promise.all([
      fplClient.getBootstrapStatic(),
      fplClient.getFixtures(),
      fplClient.getManagerPicks(managerId, gameweek),
    ]);

    // Enrich players with derived fields
    const enrichedPlayers = enrichPlayers(bootstrap);

    // Determine the active gameweek id
    const gwId =
      bootstrap.events.find((e) => e.id === gameweek)?.id ?? gameweek;

    // Build team lookup map for captain model
    const teamMap = new Map(
      bootstrap.teams.map((t) => [t.id, { short_name: t.short_name }]),
    );

    // Build player lookup map for squad building
    const playerMap = new Map(enrichedPlayers.map((p) => [p.id, p]));

    // Score models
    const transferTargets = scoreTransferTargets(
      enrichedPlayers,
      fixtures,
      gwId,
    );
    const captainOptions = scoreCaptainOptions(
      enrichedPlayers,
      fixtures,
      teamMap,
      gwId,
    );
    const pointsPredictions = predictPoints(enrichedPlayers, fixtures, gwId);
    const pointsMap = new Map(pointsPredictions.map((p) => [p.player.id, p]));

    // Build squad from picks
    const squad = picks.picks.map((pick) => {
      const player = playerMap.get(pick.element);
      const pts = pointsMap.get(pick.element);
      const posMap: Record<number, string> = {
        1: "GK",
        2: "DEF",
        3: "MID",
        4: "FWD",
      };
      const team = player ? teamMap.get(player.team) : undefined;

      return {
        id: pick.element,
        name: player?.web_name ?? `Player ${pick.element}`,
        team: team?.short_name ?? "???",
        position: player ? (posMap[player.element_type] ?? "???") : "???",
        predictedPtsNextGW: pts ? Math.round(pts.predictedPoints * 10) / 10 : 0,
        predicted4GW: pts ? Math.round(pts.predictedPoints * 4 * 10) / 10 : 0,
        form: player?.form ?? "0.0",
        upcomingDifficulty: 3,
      };
    });

    // Build the request for Claude
    const freeTransfers =
      picks.entry_history.event_transfers_cost === 0 ? 2 : 1;

    const gwPlanRequest: GwPlanRequest = {
      gameweek: gwId,
      squad,
      freeTransfers,
      bank: picks.entry_history.bank,
      topTargets: transferTargets.slice(0, 20).map((r) => ({
        id: r.player.id,
        name: r.player.web_name,
        team: teamMap.get(r.player.team)?.short_name ?? "???",
        position: (() => {
          const posMap: Record<number, string> = {
            1: "GK",
            2: "DEF",
            3: "MID",
            4: "FWD",
          };
          return posMap[r.player.element_type] ?? "???";
        })(),
        score: Math.round(r.score * 100) / 100,
        predicted4GW: pointsMap.get(r.player.id)
          ? Math.round(pointsMap.get(r.player.id)!.predictedPoints * 4 * 10) /
            10
          : 0,
        form: r.player.form,
        upcomingDifficulty: r.upcomingDifficulty,
      })),
      captainOptions: captainOptions.slice(0, 5).map((c) => ({
        id: c.player.id,
        name: c.player.web_name,
        score: Math.round(c.score * 100) / 100,
        opponentShortName: c.opponentShortName,
        isHome: c.isHome,
      })),
    };

    // Generate plan via Claude
    const { thinking, plan } = await generateGwPlan(gwPlanRequest);

    // Persist plan to DB
    const saved = saveGwPlan(sessionId, gameweek, plan, thinking);

    // Record transfer predictions for tracking
    for (const transfer of saved.plan.transfers) {
      insertTransferPrediction(
        sessionId,
        gameweek,
        transfer.playerOut.id,
        transfer.playerOut.name,
        transfer.playerIn.id,
        transfer.playerIn.name,
        transfer.pointsGain,
        transfer.reasoning,
      );
    }

    return NextResponse.json(saved);
  } catch (error) {
    console.error("GW plan generation error:", error);
    return createErrorFromUnknown(error, "generating GW plan");
  }
}
