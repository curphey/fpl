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

  // Build a mutable position map: element id → position
  const positionMap = new Map(myTeam.picks.map((p) => [p.element, p.position]));

  // Apply each substitution: swap positions between playerOut and playerIn
  for (const sub of selectedSubs) {
    const outPos = positionMap.get(sub.playerOut.id);
    const inPos = positionMap.get(sub.playerIn.id);
    if (outPos === undefined || inPos === undefined) {
      return createErrorResponse(
        `Player ${sub.playerOut.name} or ${sub.playerIn.name} not found in current squad`,
        "VALIDATION_ERROR",
      );
    }
    positionMap.set(sub.playerOut.id, inPos);
    positionMap.set(sub.playerIn.id, outPos);
  }

  // Build updated picks array
  const updatedPicks = myTeam.picks.map((p) => ({
    element: p.element,
    position: positionMap.get(p.element) ?? p.position,
    is_captain: p.is_captain,
    is_vice_captain: p.is_vice_captain,
  }));

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
