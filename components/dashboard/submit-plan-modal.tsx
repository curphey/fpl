"use client";

import { useState, useEffect } from "react";
import type { GwPlan } from "@/lib/db/gw-plan";

export interface SubmitPlanModalProps {
  open: boolean;
  onClose: () => void;
  plan: GwPlan;
  sessionId: string;
  /** Indices into plan.plan.transfers to submit. If absent, all transfers are submitted. */
  selectedTransferIndices?: number[];
  onSuccess?: () => void;
}

interface ValidateResponse {
  valid: boolean;
  transfers: Array<{
    elementIn: number;
    elementOut: number;
    purchasePrice: number;
    sellingPrice: number;
  }>;
  transferCost: number;
  wildcardActive: boolean;
  error?: string;
}

type ModalState = "loading" | "confirm" | "submitting" | "success" | "error";

export function SubmitPlanModal({
  open,
  onClose,
  plan,
  sessionId,
  selectedTransferIndices,
  onSuccess,
}: SubmitPlanModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const validate = async () => {
      setState("loading");
      setValidation(null);
      setErrorMsg(null);

      try {
        const res = await fetch("/api/gw-plan/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            planId: plan.id,
            confirm: false,
            ...(selectedTransferIndices !== undefined && {
              transferIndices: selectedTransferIndices,
            }),
          }),
        });
        const json = (await res.json()) as ValidateResponse & {
          error?: string;
        };
        if (!res.ok) {
          setErrorMsg(json.error ?? "Validation failed");
          setState("error");
        } else {
          setValidation(json);
          setState("confirm");
        }
      } catch {
        setErrorMsg("Network error during validation");
        setState("error");
      }
    };

    void validate();
  }, [open, plan.id, sessionId]);

  async function handleConfirm() {
    setState("submitting");
    try {
      const res = await fetch("/api/gw-plan/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          planId: plan.id,
          confirm: true,
          ...(selectedTransferIndices !== undefined && {
            transferIndices: selectedTransferIndices,
          }),
        }),
      });
      const json = (await res.json()) as {
        submitted?: boolean;
        error?: string;
      };
      if (!res.ok || !json.submitted) {
        setErrorMsg(json.error ?? "Submission failed");
        setState("error");
      } else {
        setState("success");
      }
    } catch {
      setErrorMsg("Network error during submission");
      setState("error");
    }
  }

  if (!open) return null;

  // Build player name lookup from plan
  const outNames = new Map(
    plan.plan.transfers.map((t) => [t.playerOut.id, t.playerOut.name]),
  );
  const inNames = new Map(
    plan.plan.transfers.map((t) => [t.playerIn.id, t.playerIn.name]),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-fpl-border bg-fpl-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">Confirm Transfers</h2>

        {state === "loading" && (
          <div className="flex items-center gap-2 text-sm text-fpl-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-fpl-cyan border-t-transparent" />
            Validating with FPL...
          </div>
        )}

        {state === "confirm" && validation && (
          <>
            <div className="mb-4 space-y-2">
              {validation.transfers.map((t) => (
                <div
                  key={`${t.elementOut}-${t.elementIn}`}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-fpl-danger">
                    {outNames.get(t.elementOut) ?? `#${t.elementOut}`}
                  </span>
                  <span className="text-fpl-muted">→</span>
                  <span className="text-fpl-green">
                    {inNames.get(t.elementIn) ?? `#${t.elementIn}`}
                  </span>
                  <span className="ml-auto text-xs text-fpl-muted">
                    £{(t.sellingPrice / 10).toFixed(1)}m → £
                    {(t.purchasePrice / 10).toFixed(1)}m
                  </span>
                </div>
              ))}
            </div>

            <div className="mb-3 text-sm text-fpl-muted">
              Captain:{" "}
              <span className="font-semibold text-white">
                {plan.plan.captain.name} (C)
              </span>
            </div>

            {validation.transferCost > 0 && (
              <p className="mb-3 text-sm text-orange-400">
                Hit cost: -{validation.transferCost} pts
              </p>
            )}

            <p className="mb-6 rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
              ⚠ This will change your FPL team. It cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConfirm()}
                className="flex-1 rounded-lg bg-fpl-purple px-4 py-2 text-sm font-semibold transition-colors hover:bg-fpl-purple/80"
              >
                Confirm &amp; Submit ▶
              </button>
            </div>
          </>
        )}

        {state === "submitting" && (
          <div className="flex items-center gap-2 text-sm text-fpl-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-fpl-cyan border-t-transparent" />
            Submitting transfers...
          </div>
        )}

        {state === "success" && (
          <>
            <p className="mb-6 text-center text-fpl-green">
              Transfers submitted ✓
            </p>
            <button
              onClick={() => {
                onSuccess?.();
                onClose();
              }}
              className="w-full rounded-lg bg-fpl-purple px-4 py-2 text-sm font-semibold transition-colors hover:bg-fpl-purple/80"
            >
              Close
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <p className="mb-4 text-sm text-fpl-danger">{errorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
