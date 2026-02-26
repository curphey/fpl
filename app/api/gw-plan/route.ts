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
import { getFplSession } from "@/lib/fpl/auth-client";
import { enrichPlayers } from "@/lib/fpl/utils";
import { scoreTransferTargets } from "@/lib/fpl/transfer-model";
import { scoreCaptainOptions } from "@/lib/fpl/captain-model";
import { predictPoints } from "@/lib/fpl/points-model";
import type { GwPlanRequest } from "@/lib/claude/gw-plan-client";
import { hasAnthropicApiKey } from "@/lib/db/settings";

const POS_MAP: Record<number, string> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

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
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

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

    // Check for Anthropic API key
    if (!hasAnthropicApiKey()) {
      return createErrorResponse(
        "Anthropic API key not configured. Please add your API key in Settings.",
        "SERVICE_UNAVAILABLE",
      );
    }

    // Fetch FPL data — picks may not exist for the upcoming GW yet (before
    // deadline), so fall back to the previous GW to get the current squad.
    const [bootstrap, fixtures] = await Promise.all([
      fplClient.getBootstrapStatic(),
      fplClient.getFixtures(),
    ]);

    let picks;
    for (let gw = gameweek; gw >= Math.max(1, gameweek - 2); gw--) {
      try {
        picks = await fplClient.getManagerPicks(managerId, gw);
        break;
      } catch {
        // try previous GW
      }
    }
    if (!picks) {
      return createErrorResponse(
        "Could not fetch your squad picks. Make sure your FPL team is set up and try again.",
        "NOT_FOUND",
      );
    }

    // Enrich players with derived fields
    const enrichedPlayers = enrichPlayers(bootstrap);

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
      gameweek,
    );
    const captainOptions = scoreCaptainOptions(
      enrichedPlayers,
      fixtures,
      teamMap,
      gameweek,
    );
    const pointsPredictions = predictPoints(
      enrichedPlayers,
      fixtures,
      gameweek,
    );
    const pointsMap = new Map(pointsPredictions.map((p) => [p.player.id, p]));

    // Build squad from picks
    const squad = picks.picks.map((pick) => {
      const player = playerMap.get(pick.element);
      const pts = pointsMap.get(pick.element);
      const team = player ? teamMap.get(player.team) : undefined;
      const isStarter = pick.position <= 11;

      return {
        id: pick.element,
        name: player?.web_name ?? `Player ${pick.element}`,
        team: team?.short_name ?? "???",
        position: player ? (POS_MAP[player.element_type] ?? "???") : "???",
        predictedPtsNextGW: pts ? Math.round(pts.predictedPoints * 10) / 10 : 0,
        predicted4GW: pts ? Math.round(pts.predictedPoints * 4 * 10) / 10 : 0,
        form: player?.form ?? "0.0",
        upcomingDifficulty: 3,
        // selling_price is only returned by the FPL API for authenticated (own-team)
        // requests. Fall back to now_cost as a conservative estimate for public calls.
        sellingPrice:
          Math.round(
            ((pick.selling_price ?? player?.now_cost ?? 0) / 10) * 10,
          ) / 10,
        isStarter,
        benchPriority: isStarter ? undefined : pick.position - 11,
      };
    });

    // Pre-filter transfer targets to only those the manager can afford.
    // Use bank + sum of top 2 selling prices to cover double-transfer scenarios.
    // Fall back to now_cost when selling_price is absent (unauthenticated API call).
    const bank = picks.entry_history.bank;
    const top2SellingPricesSum = picks.picks
      .map((p) => p.selling_price ?? playerMap.get(p.element)?.now_cost ?? 0)
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((s, p) => s + p, 0);
    const maxAffordableCost = bank + top2SellingPricesSum;
    const affordableTargets = transferTargets.filter(
      (r) => r.player.now_cost <= maxAffordableCost,
    );

    // Calculate free transfers
    // With auth: derive from manager history (last GW transfers banked)
    // Without auth: default to 1
    let freeTransfers = 1;
    const fplSession = getFplSession();
    if (fplSession) {
      try {
        const history = await fplClient.getManagerHistory(managerId);
        const lastGwEntry = history.current
          .filter((e) => e.event < gameweek)
          .sort((a, b) => b.event - a.event)[0];
        if (lastGwEntry) {
          // FPL rule: if no transfers were made last GW (or all were free with no cost),
          // manager banks 1 extra → has 2 free transfers this GW
          freeTransfers = lastGwEntry.event_transfers === 0 ? 2 : 1;
        }
      } catch {
        // non-critical; keep default of 1
      }
    }

    // Build position-diverse target list: top N targets per position so that
    // lower-scoring positions (e.g. FWD) are not crowded out by high-scoring
    // ones (e.g. MID), and Claude always has same-position options to choose from.
    const TARGETS_PER_POSITION: Record<string, number> = {
      GK: 2,
      DEF: 5,
      MID: 5,
      FWD: 5,
    };
    const targetsByPosition = new Map<string, typeof affordableTargets>();
    for (const target of affordableTargets) {
      const pos = POS_MAP[target.player.element_type] ?? "???";
      if (!targetsByPosition.has(pos)) targetsByPosition.set(pos, []);
      targetsByPosition.get(pos)!.push(target);
    }
    const positionDiverseTargets = Array.from(
      targetsByPosition.entries(),
    ).flatMap(([pos, targets]) =>
      targets.slice(0, TARGETS_PER_POSITION[pos] ?? 5),
    );

    const gwPlanRequest: GwPlanRequest = {
      gameweek,
      squad,
      freeTransfers,
      bank,
      topTargets: positionDiverseTargets.map((r) => ({
        id: r.player.id,
        name: r.player.web_name,
        team: teamMap.get(r.player.team)?.short_name ?? "???",
        position: POS_MAP[r.player.element_type] ?? "???",
        score: Math.round(r.score * 100) / 100,
        predicted4GW: pointsMap.get(r.player.id)
          ? Math.round(pointsMap.get(r.player.id)!.predictedPoints * 4 * 10) /
            10
          : 0,
        form: r.player.form,
        upcomingDifficulty: r.upcomingDifficulty,
        cost: Math.round((r.player.now_cost / 10) * 10) / 10,
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
