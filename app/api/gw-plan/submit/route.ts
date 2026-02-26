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

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  planId: z.string().uuid("Invalid plan ID"),
  confirm: z.boolean(),
});

const FPL_TRANSFERS_URL = "https://fantasy.premierleague.com/api/transfers/";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { sessionId, planId, confirm } = parsed.data;

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

  if (gwPlan.plan.transfers.length === 0) {
    return createErrorResponse("No transfers in this plan", "BAD_REQUEST");
  }

  const managerId = session.fpl_manager_id;
  const gameweek = gwPlan.gameweek;

  // Fetch bootstrap for purchase prices
  const bootstrap = await fplClient.getBootstrapStatic();
  const priceMap = new Map(bootstrap.elements.map((e) => [e.id, e.now_cost]));

  // Fetch authenticated picks for selling prices (non-critical)
  const sellingPriceMap = new Map<number, number>();
  try {
    const picks = await fplClient.getManagerPicks(managerId, gameweek);
    for (const pick of picks.picks) {
      if (pick.selling_price)
        sellingPriceMap.set(pick.element, pick.selling_price);
    }
  } catch {
    // 404 expected before deadline; now_cost is used as fallback
  }

  // Build transfer array for FPL API
  const transfers = gwPlan.plan.transfers.map((t) => ({
    element_in: t.playerIn.id,
    element_out: t.playerOut.id,
    purchase_price: priceMap.get(t.playerIn.id) ?? 0,
    selling_price:
      sellingPriceMap.get(t.playerOut.id) ?? priceMap.get(t.playerOut.id) ?? 0,
  }));

  try {
    const fplResp = await authenticatedFetch(FPL_TRANSFERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // FPL treats confirmed: false as a dry-run validation call —
      // the API returns 200 without making transfers.
      body: JSON.stringify({
        confirmed: confirm,
        entry: managerId,
        event: gameweek,
        transfers,
        wildcard: false,
        freehit: false,
      }),
    });

    if (!fplResp.ok) {
      const errBody = (await fplResp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (fplResp.status === 400) {
        const errors = errBody.non_form_errors;
        const firstError =
          Array.isArray(errors) && errors.length > 0
            ? String(errors[0]).toLowerCase()
            : "";
        if (
          firstError.includes("deadline") ||
          firstError.includes("game is being updated")
        ) {
          return createErrorResponse(
            "Transfer deadline has passed",
            "DEADLINE_PASSED",
          );
        }
        const msg = firstError || "Transfer validation failed";
        return createErrorResponse(msg, "VALIDATION_ERROR");
      }
      if (fplResp.status === 401 || fplResp.status === 403) {
        return createErrorResponse("FPL session expired", "UNAUTHORIZED");
      }
      return createErrorResponse(
        "FPL transfer request failed",
        "FPL_API_ERROR",
      );
    }

    if (!confirm) {
      return NextResponse.json({
        valid: true,
        transfers: transfers.map((t) => ({
          elementIn: t.element_in,
          elementOut: t.element_out,
          purchasePrice: t.purchase_price,
          sellingPrice: t.selling_price,
        })),
        transferCost: gwPlan.plan.transfers.reduce(
          (sum, t) => sum + (t.hitCost ?? 0),
          0,
        ),
        wildcardActive: false,
      });
    }

    return NextResponse.json({
      submitted: true,
      transfersMade: transfers.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FPL_SESSION_EXPIRED") {
      return createErrorResponse(
        "FPL session expired. Please reconnect in Settings.",
        "UNAUTHORIZED",
      );
    }
    console.error("Transfer submission error:", error);
    return createErrorResponse("Transfer submission failed", "INTERNAL_ERROR");
  }
}
