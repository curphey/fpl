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

  // Swap positions between each playerOut (starter→bench) and playerIn (bench→starter).
  // We preserve every bench player's original slot so FPL's bench-GK position
  // constraint is respected without us needing to know which slot the GK occupies.
  const positionMap = new Map(myTeam.picks.map((p) => [p.element, p.position]));
  for (const sub of selectedSubs) {
    const outPos = positionMap.get(sub.playerOut.id)!;
    const inPos = positionMap.get(sub.playerIn.id)!;
    positionMap.set(sub.playerOut.id, inPos);
    positionMap.set(sub.playerIn.id, outPos);
  }

  // Sort starting XI by element_type (GK=1, DEF=2, MID=3, FWD=4) so FPL
  // accepts the ordering. Within the same type keep original squad order.
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

  // Bench: keep exact positions from the swap above so the GK bench slot is
  // never disturbed (FPL enforces which positions allow which element types).
  const bench = myTeam.picks
    .filter((p) => (positionMap.get(p.element) ?? 99) > 11)
    .sort(
      (a, b) =>
        (positionMap.get(a.element) ?? 99) - (positionMap.get(b.element) ?? 99),
    );

  // Assign positions: starters get 1–11 (re-sorted by element_type),
  // bench players keep the positions they hold after the swap.
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
