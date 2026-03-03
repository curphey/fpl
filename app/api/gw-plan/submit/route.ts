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

const bodySchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  planId: z.string().uuid("Invalid plan ID"),
  confirm: z.boolean(),
  /** Optional subset of transfer indices to submit. If absent, all transfers are submitted. */
  transferIndices: z.array(z.number().int().min(0)).optional(),
  chipType: z.enum(["wildcard", "freehit"]).optional(),
});

const FPL_TRANSFERS_URL = "https://fantasy.premierleague.com/api/transfers/";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { sessionId, planId, confirm, transferIndices, chipType } = parsed.data;

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

  // Filter to selected transfer indices if provided, otherwise use all
  const selectedTransfers =
    transferIndices !== undefined
      ? gwPlan.plan.transfers.filter((_, i) => transferIndices.includes(i))
      : gwPlan.plan.transfers;

  if (selectedTransfers.length === 0) {
    return createErrorResponse("No transfers in this plan", "BAD_REQUEST");
  }

  const managerId = session.fpl_manager_id;
  const gameweek = gwPlan.gameweek;

  // Fetch bootstrap for purchase prices
  const bootstrap = await fplClient.getBootstrapStatic();
  const priceMap = new Map(bootstrap.elements.map((e) => [e.id, e.now_cost]));

  // Fetch selling prices from /api/my-team/{id}/ — the only FPL endpoint that
  // returns the manager's current squad with per-player selling_price regardless
  // of deadline status. Historical picks endpoints omit selling_price entirely.
  const sellingPriceMap = new Map<number, number>();
  try {
    const myTeamResp = await authenticatedFetch(
      `https://fantasy.premierleague.com/api/my-team/${managerId}/`,
    );
    console.log(`[submit] my-team status=${myTeamResp.status}`);
    if (myTeamResp.ok) {
      const myTeam = (await myTeamResp.json()) as {
        picks: ManagerPicks["picks"];
      };
      console.log(
        `[submit] my-team selling_prices:`,
        JSON.stringify(
          myTeam.picks.map((p) => ({
            element: p.element,
            selling_price: p.selling_price,
          })),
        ),
      );
      for (const pick of myTeam.picks) {
        if (pick.selling_price)
          sellingPriceMap.set(pick.element, pick.selling_price);
      }
    }
  } catch {
    // non-critical — fall back to now_cost
  }

  // Build transfer array for FPL API
  const transfers = selectedTransfers.map((t) => ({
    element_in: t.playerIn.id,
    element_out: t.playerOut.id,
    purchase_price: priceMap.get(t.playerIn.id) ?? 0,
    selling_price:
      sellingPriceMap.get(t.playerOut.id) ?? priceMap.get(t.playerOut.id) ?? 0,
  }));

  console.log("[submit] transfers:", JSON.stringify(transfers));

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
        wildcard: chipType === "wildcard",
        freehit: chipType === "freehit",
      }),
    });

    if (!fplResp.ok) {
      const errBody = (await fplResp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      console.error(
        "FPL transfer API error",
        fplResp.status,
        JSON.stringify(errBody),
      );
      if (fplResp.status === 400) {
        // FPL returns errors in two shapes:
        // 1. { non_form_errors: ["deadline passed", ...] }
        // 2. { transfers: [{ element_out: [{message, code}], element_in: [{message, code}] }] }
        const nonFormErrors = errBody.non_form_errors;
        const firstNonForm =
          Array.isArray(nonFormErrors) && nonFormErrors.length > 0
            ? String(nonFormErrors[0])
            : "";

        if (
          firstNonForm.toLowerCase().includes("deadline") ||
          firstNonForm.toLowerCase().includes("game is being updated")
        ) {
          return createErrorResponse(
            "Transfer deadline has passed",
            "DEADLINE_PASSED",
          );
        }

        if (!firstNonForm) {
          // Try per-transfer error shapes:
          // Shape A: { transfers: [{ element_out: [{message}], element_in: [{message}] }] }
          // Shape B: { transfers: [{ non_field_errors: [{message, code}] }] }
          const transferErrors = errBody.transfers;
          if (Array.isArray(transferErrors) && transferErrors.length > 0) {
            // Detect "already applied": every transfer has both element_out_not_pick AND element_in_is_pick
            const isAlreadyApplied = (
              transferErrors as Record<string, unknown>[]
            ).every((t) => {
              const outErrs = Array.isArray(t.element_out)
                ? (t.element_out as Record<string, unknown>[])
                : [];
              const inErrs = Array.isArray(t.element_in)
                ? (t.element_in as Record<string, unknown>[])
                : [];
              return (
                outErrs.some(
                  (e) => e.code === "transfer_element_out_not_pick",
                ) &&
                inErrs.some((e) => e.code === "transfer_element_in_is_pick")
              );
            });
            if (isAlreadyApplied) {
              return NextResponse.json({
                submitted: true,
                alreadyApplied: true,
                transfersMade: 0,
              });
            }

            const first = transferErrors[0] as Record<string, unknown>;
            // Shape B: non_field_errors
            if (
              Array.isArray(first.non_field_errors) &&
              first.non_field_errors.length > 0
            ) {
              const msg = String(
                (first.non_field_errors[0] as Record<string, unknown>)
                  .message ?? "",
              );
              if (msg) return createErrorResponse(msg, "VALIDATION_ERROR");
            }
            // Shape A: element_out / element_in field errors
            const errArr = Array.isArray(first.element_out)
              ? (first.element_out as Record<string, unknown>[])
              : Array.isArray(first.element_in)
                ? (first.element_in as Record<string, unknown>[])
                : [];
            const msg =
              errArr.length > 0 ? String(errArr[0].message ?? "") : "";
            if (msg) return createErrorResponse(msg, "VALIDATION_ERROR");
          }
        }

        const msg = firstNonForm || "Transfer validation failed";
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
        transferCost: selectedTransfers.reduce(
          (sum, t) => sum + (t.hitCost ?? 0),
          0,
        ),
        wildcardActive: chipType === "wildcard",
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
