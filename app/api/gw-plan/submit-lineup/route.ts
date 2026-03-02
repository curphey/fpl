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
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { sessionId, planId, confirm, substitutionIndices } = parsed.data;

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

  const allSubs = gwPlan.plan.substitutions ?? [];
  const selectedSubs =
    substitutionIndices !== undefined
      ? allSubs.filter((_, i) => substitutionIndices.includes(i))
      : allSubs;

  if (selectedSubs.length === 0) {
    return createErrorResponse("No substitutions selected", "BAD_REQUEST");
  }

  const managerId = session.fpl_manager_id;

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

  // Build the new starting XI and bench by moving players between groups.
  const starterIds = new Set(
    myTeam.picks.filter((p) => p.position <= 11).map((p) => p.element),
  );
  for (const sub of selectedSubs) {
    starterIds.delete(sub.playerOut.id); // moved to bench
    starterIds.add(sub.playerIn.id); // moved to start
  }

  // Sort starting XI by element_type (GK=1, DEF=2, MID=3, FWD=4) so FPL
  // accepts the ordering. Within the same type keep original squad order.
  const originalOrder = new Map(
    myTeam.picks.map((p) => [p.element, p.position]),
  );
  const starters = myTeam.picks
    .filter((p) => starterIds.has(p.element))
    .sort((a, b) => {
      const typeA = elementTypeMap.get(a.element) ?? 0;
      const typeB = elementTypeMap.get(b.element) ?? 0;
      if (typeA !== typeB) return typeA - typeB;
      return (
        (originalOrder.get(a.element) ?? 0) -
        (originalOrder.get(b.element) ?? 0)
      );
    });

  // Bench: players NOT in the starting XI, ordered by their original bench slot
  // (preserve auto-sub priority). The newly benched player takes the slot of the
  // player that moved to start.
  const bench = myTeam.picks
    .filter((p) => !starterIds.has(p.element))
    .sort((a, b) => {
      const origA = originalOrder.get(a.element) ?? 99;
      const origB = originalOrder.get(b.element) ?? 99;
      return origA - origB;
    });

  // Assign positions: starters get 1–11, bench gets 12–15.
  const updatedPicks = [
    ...starters.map((p, i) => ({
      element: p.element,
      position: i + 1,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
      multiplier: p.is_captain ? 2 : 1,
    })),
    ...bench.map((p, i) => ({
      element: p.element,
      position: 12 + i,
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
