import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
  createErrorFromUnknown,
} from "@/lib/api/errors";
import { getSession } from "@/lib/db/sessions";
import { saveGwPlan } from "@/lib/db/gw-plan";
import { getFplSession } from "@/lib/fpl/auth-client";
import { fplClient } from "@/lib/fpl/client";
import { generateChipPlan } from "@/lib/claude/chip-plan-client";
import { predictPoints } from "@/lib/fpl/points-model";
import { hasAnthropicApiKey } from "@/lib/db/settings";
import type {
  ChipPlanRequest,
  ChipPlanCurrentPlayer,
  ChipPlanCandidate,
} from "@/lib/claude/chip-plan-client";
import type { GwPlanResult } from "@/lib/db/gw-plan";

export const runtime = "nodejs";
export const maxDuration = 60;

const POS_MAP: Record<number, "GK" | "DEF" | "MID" | "FWD"> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  gameweek: z.number().int().min(1).max(38),
  chipType: z.enum(["wildcard", "freehit"]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "claude");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { sessionId, gameweek, chipType } = parsed.data;

  const session = getSession(sessionId);
  if (!session?.fpl_manager_id) {
    return createErrorResponse(
      "No FPL manager connected to this session",
      "UNAUTHORIZED",
    );
  }

  const fplSession = getFplSession();
  if (!fplSession) {
    return createErrorResponse(
      "FPL session expired. Please reconnect in Settings.",
      "UNAUTHORIZED",
    );
  }

  if (!hasAnthropicApiKey()) {
    return createErrorResponse(
      "Anthropic API key not configured. Please add your API key in Settings.",
      "SERVICE_UNAVAILABLE",
    );
  }

  const managerId = session.fpl_manager_id;

  try {
    // Check chip availability
    const history = await fplClient.getManagerHistory(managerId);
    if (chipType === "freehit") {
      const used = history.chips.some((c) => c.name === "freehit");
      if (used) {
        return createErrorResponse(
          "Free Hit chip has already been used this season",
          "CONFLICT",
        );
      }
    } else {
      // Wildcard: allowed once per half (GWs 1–19 = first half, 20–38 = second half)
      const isFirstHalf = gameweek <= 19;
      const usedInThisHalf = history.chips.some(
        (c) =>
          c.name === "wildcard" &&
          (isFirstHalf ? c.event <= 19 : c.event >= 20),
      );
      if (usedInThisHalf) {
        return createErrorResponse(
          "Wildcard chip has already been used in this half of the season",
          "CONFLICT",
        );
      }
    }

    // Fetch current squad + bootstrap + fixtures in parallel
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

    const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
    const playerMap = new Map(bootstrap.elements.map((e) => [e.id, e]));

    // Build current squad for context
    const currentSquad: ChipPlanCurrentPlayer[] = picks.picks.map((pick) => {
      const element = playerMap.get(pick.element);
      return {
        id: pick.element,
        name: element?.web_name ?? `Player ${pick.element}`,
        position: POS_MAP[element?.element_type ?? 1] ?? "GK",
        sellingPrice:
          Math.round(
            ((pick.selling_price ?? element?.now_cost ?? 0) / 10) * 10,
          ) / 10,
      };
    });

    // Budget: sum of all 15 selling prices + bank (all in 0.1m units)
    const totalSellingPrice = picks.picks.reduce(
      (sum, pick) =>
        sum +
        (pick.selling_price ?? playerMap.get(pick.element)?.now_cost ?? 0),
      0,
    );
    const budget = totalSellingPrice + picks.entry_history.bank;

    // Build candidate pools using points model
    // predictPoints expects EnrichedPlayer[] — cast elements as EnrichedPlayer
    // (the model only uses fields present on Player, so this is safe)
    const pointsPredictions =
      predictPoints(
        bootstrap.elements as Parameters<typeof predictPoints>[0],
        fixtures,
        gameweek,
      ) ?? [];
    const pointsMap = new Map(pointsPredictions.map((p) => [p.player.id, p]));

    // Rough affordability pre-filter: max individual cost ≤ budget / 11
    const maxIndividualCost = Math.floor(budget / 11);

    const CANDIDATES_PER_POSITION: Record<string, number> = {
      GK: 15,
      DEF: 25,
      MID: 25,
      FWD: 20,
    };

    const candidatesByPos: Record<string, ChipPlanCandidate[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };

    for (const element of bootstrap.elements) {
      if (element.now_cost > maxIndividualCost) continue;
      const pos = POS_MAP[element.element_type];
      if (!pos) continue;
      const pts = pointsMap.get(element.id);
      candidatesByPos[pos].push({
        id: element.id,
        name: element.web_name,
        team: teamMap.get(element.team) ?? "???",
        position: pos,
        cost: Math.round((element.now_cost / 10) * 10) / 10,
        predictedNextGW: pts ? Math.round(pts.predictedPoints * 10) / 10 : 0,
        predicted4GW: pts ? Math.round(pts.predictedPoints * 4 * 10) / 10 : 0,
        form: element.form ?? "0.0",
        upcomingDifficulty: 3,
      });
    }

    // Sort each position by predicted score, cap at max
    const sortField =
      chipType === "wildcard" ? "predicted4GW" : "predictedNextGW";
    for (const pos of ["GK", "DEF", "MID", "FWD"] as const) {
      candidatesByPos[pos] = candidatesByPos[pos]
        .sort((a, b) => b[sortField] - a[sortField])
        .slice(0, CANDIDATES_PER_POSITION[pos]);
    }

    const chipReq: ChipPlanRequest = {
      chipType,
      gameweek,
      budget,
      currentSquad,
      candidates: {
        GK: candidatesByPos.GK,
        DEF: candidatesByPos.DEF,
        MID: candidatesByPos.MID,
        FWD: candidatesByPos.FWD,
      },
    };

    // Call Claude — NOTE: returns { thinking, result, processingTime }
    const { thinking, result } = await generateChipPlan(chipReq);

    // For Free Hit the squad reverts after one GW, so predicted4GW should reflect
    // a single-GW prediction. Wildcard squads persist, so use 4 GWs.
    const ptsMultiplier = chipType === "wildcard" ? 4 : 1;

    // Compute transfer pairs: current squad by position → new squad by position
    // Players retained (same ID in both) are no-ops and excluded
    const currentByPos: Record<string, number[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    for (const p of currentSquad) {
      currentByPos[p.position].push(p.id);
    }

    const newByPos: Record<string, number[]> = {
      GK: result.squad.GK.map((p) => p.id),
      DEF: result.squad.DEF.map((p) => p.id),
      MID: result.squad.MID.map((p) => p.id),
      FWD: result.squad.FWD.map((p) => p.id),
    };

    const allNewIds = new Set(Object.values(newByPos).flat());

    // Chip plan transfers are paired by position index — the pairing is arbitrary
    // since Claude chose the whole squad at once. These records document which
    // players were swapped in each position, not necessarily 1:1 exchanges.
    // The actual FPL submission sends all 15 players; these pairs are for display only.
    const transfers: GwPlanResult["transfers"] = [];
    for (const pos of ["GK", "DEF", "MID", "FWD"] as const) {
      const outs = currentByPos[pos].filter((id) => !allNewIds.has(id));
      const currentPosIds = new Set(currentByPos[pos]);
      const ins = newByPos[pos].filter((id) => !currentPosIds.has(id));
      const len = Math.min(outs.length, ins.length);
      for (let i = 0; i < len; i++) {
        const outElement = playerMap.get(outs[i]);
        const inElement = playerMap.get(ins[i]);
        const outPts = pointsMap.get(outs[i]);
        const inPts = pointsMap.get(ins[i]);
        transfers.push({
          playerOut: {
            id: outs[i],
            name: outElement?.web_name ?? `Player ${outs[i]}`,
            predicted4GW: outPts
              ? Math.round(outPts.predictedPoints * ptsMultiplier * 10) / 10
              : 0,
          },
          playerIn: {
            id: ins[i],
            name: inElement?.web_name ?? `Player ${ins[i]}`,
            predicted4GW: inPts
              ? Math.round(inPts.predictedPoints * ptsMultiplier * 10) / 10
              : 0,
          },
          pointsGain: 0,
          hitCost: 0,
          reasoning: `${pos} swap for ${chipType === "wildcard" ? "Wildcard" : "Free Hit"}`,
        });
      }
    }

    const gwPlanResult: GwPlanResult = {
      predictedTeamPoints: result.predictedTeamPoints,
      captain: {
        playerId: result.captain.playerId,
        name: result.captain.name,
        reasoning: result.captain.reasoning,
      },
      transfers,
      substitutions: [],
      notes: result.notes,
    };

    const saved = saveGwPlan(
      sessionId,
      gameweek,
      gwPlanResult,
      thinking,
      chipType,
    );

    return NextResponse.json(saved);
  } catch (error) {
    console.error("Chip plan generation error:", error);
    return createErrorFromUnknown(error, "generating chip plan");
  }
}
