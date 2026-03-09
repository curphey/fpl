import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { getSession } from "@/lib/db/sessions";
import { getGwPlanById } from "@/lib/db/gw-plan";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";
import { fplClient } from "@/lib/fpl/client";
import type { ManagerPicks } from "@/lib/fpl/types";

export const runtime = "nodejs";

const FPL_MY_TEAM_BASE_URL = "https://fantasy.premierleague.com/api/my-team";

const bodySchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  planId: z.string().uuid("Invalid plan ID"),
  confirm: z.boolean(),
  /** Indices into plan.plan.substitutions to apply. If absent, all are applied. */
  substitutionIndices: z.array(z.number().int().min(0)).optional(),
  /** Full lineup mode: starting XI player IDs (ordered), bench player IDs (ordered), captain ID */
  startingXI: z.array(z.number().int().positive()).length(11).optional(),
  benchOrder: z.array(z.number().int().positive()).length(4).optional(),
  captainId: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const {
    sessionId,
    planId,
    confirm,
    substitutionIndices,
    startingXI,
    benchOrder,
    captainId,
  } = parsed.data;

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

  const gwPlan = getGwPlanById(planId, sessionId);
  if (!gwPlan) {
    return createErrorResponse("Plan not found", "NOT_FOUND");
  }

  const managerId = session.fpl_manager_id;

  // -----------------------------------------------------------------------
  // Full lineup mode: startingXI + benchOrder + captainId provided
  // -----------------------------------------------------------------------
  if (startingXI && benchOrder && captainId) {
    return handleFullLineup(
      managerId,
      startingXI,
      benchOrder,
      captainId,
      confirm,
    );
  }

  // -----------------------------------------------------------------------
  // Substitution mode (legacy): swap specific players between XI and bench
  // -----------------------------------------------------------------------
  const allSubs = gwPlan.plan.substitutions ?? [];
  const selectedSubs =
    substitutionIndices !== undefined
      ? allSubs.filter((_, i) => substitutionIndices.includes(i))
      : allSubs;

  if (selectedSubs.length === 0) {
    return createErrorResponse("No substitutions selected", "BAD_REQUEST");
  }

  return handleSubstitutions(managerId, selectedSubs, confirm);
}

// ---------------------------------------------------------------------------
// Full lineup submission: set starting XI, bench order, and captain
// ---------------------------------------------------------------------------
async function handleFullLineup(
  managerId: number,
  startingXI: number[],
  benchOrder: number[],
  captainId: number,
  confirm: boolean,
): Promise<NextResponse> {
  // Fetch current my-team picks
  const myTeamResp = await authenticatedFetch(
    `${FPL_MY_TEAM_BASE_URL}/${managerId}/`,
  );
  if (!myTeamResp.ok) {
    if (myTeamResp.status === 401 || myTeamResp.status === 403) {
      return createErrorResponse("FPL session expired", "UNAUTHORIZED");
    }
    return createErrorResponse(
      "Failed to fetch current squad",
      "FPL_API_ERROR",
    );
  }

  const myTeam = (await myTeamResp.json()) as { picks: ManagerPicks["picks"] };
  const currentIds = new Set(myTeam.picks.map((p) => p.element));
  const allRequestedIds = [...startingXI, ...benchOrder];

  // Verify all 15 players match current squad
  for (const id of allRequestedIds) {
    if (!currentIds.has(id)) {
      return createErrorResponse(
        `Player ${id} is not in your current squad`,
        "VALIDATION_ERROR",
      );
    }
  }

  // Fetch element types for position sorting
  const bootstrap = await fplClient.getBootstrapStatic();
  const elementTypeMap = new Map(
    bootstrap.elements.map((e) => [e.id, e.element_type]),
  );

  // Sort starting XI by element_type (GK=1→DEF=2→MID=3→FWD=4) as FPL requires
  const sortedStarters = [...startingXI].sort((a, b) => {
    const typeA = elementTypeMap.get(a) ?? 0;
    const typeB = elementTypeMap.get(b) ?? 0;
    return typeA - typeB;
  });

  // FPL requires position 12 = bench GK, positions 13-15 = outfield bench.
  // Ensure the GK is always first in the bench ordering.
  const benchGkIndex = benchOrder.findIndex(
    (id) => (elementTypeMap.get(id) ?? 0) === 1,
  );
  const sortedBench =
    benchGkIndex > 0
      ? [
          benchOrder[benchGkIndex],
          ...benchOrder.filter((_, i) => i !== benchGkIndex),
        ]
      : [...benchOrder];

  // Build picks array
  const updatedPicks = [
    ...sortedStarters.map((id, i) => ({
      element: id,
      position: i + 1,
      is_captain: id === captainId,
      is_vice_captain: false,
      multiplier: id === captainId ? 2 : 1,
    })),
    ...sortedBench.map((id, i) => ({
      element: id,
      position: 12 + i,
      is_captain: false,
      is_vice_captain: false,
      multiplier: 0,
    })),
  ];

  if (!confirm) {
    return NextResponse.json({ valid: true, picks: updatedPicks });
  }

  try {
    const fplResp = await authenticatedFetch(
      `${FPL_MY_TEAM_BASE_URL}/${managerId}/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: updatedPicks }),
      },
    );

    if (!fplResp.ok) {
      if (fplResp.status === 401 || fplResp.status === 403) {
        return createErrorResponse("FPL session expired", "UNAUTHORIZED");
      }
      const errBody = (await fplResp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      console.error(
        "FPL lineup API error",
        fplResp.status,
        JSON.stringify(errBody),
      );
      return createErrorResponse("FPL lineup request failed", "FPL_API_ERROR");
    }

    return NextResponse.json({ submitted: true, lineupSet: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FPL_SESSION_EXPIRED") {
      return createErrorResponse(
        "FPL session expired. Please reconnect in Settings.",
        "UNAUTHORIZED",
      );
    }
    console.error("Lineup submission error:", error);
    return createErrorResponse("Lineup submission failed", "INTERNAL_ERROR");
  }
}

// ---------------------------------------------------------------------------
// Substitution mode: swap specific players between starting XI and bench
// ---------------------------------------------------------------------------
async function handleSubstitutions(
  managerId: number,
  selectedSubs: Array<{
    playerOut: { id: number; name: string };
    playerIn: { id: number; name: string };
    reasoning: string;
  }>,
  confirm: boolean,
): Promise<NextResponse> {
  // Fetch current my-team picks (includes current positions 1-15)
  const myTeamResp = await authenticatedFetch(
    `${FPL_MY_TEAM_BASE_URL}/${managerId}/`,
  );
  if (!myTeamResp.ok) {
    if (myTeamResp.status === 401 || myTeamResp.status === 403) {
      return createErrorResponse("FPL session expired", "UNAUTHORIZED");
    }
    return createErrorResponse(
      "Failed to fetch current squad",
      "FPL_API_ERROR",
    );
  }

  const myTeam = (await myTeamResp.json()) as { picks: ManagerPicks["picks"] };

  // Fetch element types so we can re-sort the starting XI after the swap.
  // FPL requires picks in-play to be ordered by ascending element_type (GK→DEF→MID→FWD).
  const bootstrap = await fplClient.getBootstrapStatic();
  const elementTypeMap = new Map(
    bootstrap.elements.map((e) => [e.id, e.element_type]),
  );

  // Determine which elements are being swapped (starter ↔ bench).
  // Validate both players are in the current squad before mutating anything.
  for (const sub of selectedSubs) {
    const outPick = myTeam.picks.find((p) => p.element === sub.playerOut.id);
    const inPick = myTeam.picks.find((p) => p.element === sub.playerIn.id);
    if (!outPick || !inPick) {
      return createErrorResponse(
        `Player ${sub.playerOut.name} or ${sub.playerIn.name} not found in current squad`,
        "VALIDATION_ERROR",
      );
    }
  }

  // Swap positions between each playerOut (starter→bench) and playerIn (bench→starter).
  const positionMap = new Map(myTeam.picks.map((p) => [p.element, p.position]));
  for (const sub of selectedSubs) {
    const outPos = positionMap.get(sub.playerOut.id)!;
    const inPos = positionMap.get(sub.playerIn.id)!;
    positionMap.set(sub.playerOut.id, inPos);
    positionMap.set(sub.playerIn.id, outPos);
  }

  // Sort starting XI by element_type (GK=1, DEF=2, MID=3, FWD=4)
  const starters = myTeam.picks
    .filter((p) => (positionMap.get(p.element) ?? 99) <= 11)
    .sort((a, b) => {
      const typeA = elementTypeMap.get(a.element) ?? 0;
      const typeB = elementTypeMap.get(b.element) ?? 0;
      if (typeA !== typeB) return typeA - typeB;
      return (
        (positionMap.get(a.element) ?? 0) - (positionMap.get(b.element) ?? 0)
      );
    });

  const bench = myTeam.picks
    .filter((p) => (positionMap.get(p.element) ?? 99) > 11)
    .sort(
      (a, b) =>
        (positionMap.get(a.element) ?? 99) - (positionMap.get(b.element) ?? 99),
    );

  const updatedPicks = [
    ...starters.map((p, i) => ({
      element: p.element,
      position: i + 1,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
      multiplier: p.is_captain ? 2 : 1,
    })),
    ...bench.map((p) => ({
      element: p.element,
      position: positionMap.get(p.element)!,
      is_captain: false,
      is_vice_captain: p.is_vice_captain,
      multiplier: 0,
    })),
  ];

  if (!confirm) {
    return NextResponse.json({ valid: true, picks: updatedPicks });
  }

  try {
    const fplResp = await authenticatedFetch(
      `${FPL_MY_TEAM_BASE_URL}/${managerId}/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: updatedPicks }),
      },
    );

    if (!fplResp.ok) {
      if (fplResp.status === 401 || fplResp.status === 403) {
        return createErrorResponse("FPL session expired", "UNAUTHORIZED");
      }
      const errBody = (await fplResp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      console.error(
        "FPL lineup API error",
        fplResp.status,
        JSON.stringify(errBody),
      );
      console.error("Picks sent:", JSON.stringify(updatedPicks));
      return createErrorResponse("FPL lineup request failed", "FPL_API_ERROR");
    }

    return NextResponse.json({
      submitted: true,
      substitutionsMade: selectedSubs.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FPL_SESSION_EXPIRED") {
      return createErrorResponse(
        "FPL session expired. Please reconnect in Settings.",
        "UNAUTHORIZED",
      );
    }
    console.error("Lineup submission error:", error);
    return createErrorResponse("Lineup submission failed", "INTERNAL_ERROR");
  }
}
