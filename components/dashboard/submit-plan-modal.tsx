"use client";

import { useState } from "react";
import type { GwPlan } from "@/lib/db/gw-plan";

export interface SubmitPlanModalProps {
  open: boolean;
  onClose: () => void;
  plan: GwPlan;
  sessionId: string;
  /** Indices into plan.plan.transfers to submit. If absent, all transfers are submitted. */
  selectedTransferIndices?: number[];
  /** Indices into plan.plan.substitutions to submit. If absent, all substitutions are submitted. */
  selectedSubstitutionIndices?: number[];
  onSuccess?: () => void;
  chipType?: "wildcard" | "freehit";
}

type ModalState = "confirm" | "submitting" | "success" | "error";

export function SubmitPlanModal({
  open,
  onClose,
  plan,
  sessionId,
  selectedTransferIndices,
  selectedSubstitutionIndices,
  onSuccess,
  chipType,
}: SubmitPlanModalProps) {
  const [state, setState] = useState<ModalState>("confirm");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  // Track previous `open` value in state so we can detect the false→true
  // transition during render and reset internal state without a useEffect.
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setState("confirm");
      setErrorMsg(null);
      setAlreadyApplied(false);
    }
  }

  if (!open) return null;

  const selectedTransfers =
    selectedTransferIndices !== undefined
      ? plan.plan.transfers.filter((_, i) =>
          selectedTransferIndices.includes(i),
        )
      : plan.plan.transfers;

  const selectedSubstitutions =
    selectedSubstitutionIndices !== undefined
      ? (plan.plan.substitutions ?? []).filter((_, i) =>
          selectedSubstitutionIndices.includes(i),
        )
      : (plan.plan.substitutions ?? []);

  const totalHitCost = selectedTransfers.reduce(
    (sum, t) => sum + (t.hitCost ?? 0),
    0,
  );

  const hasTransfers = selectedTransfers.length > 0;
  const hasSubs = selectedSubstitutions.length > 0;

  const modalTitle =
    hasTransfers && hasSubs
      ? "Confirm Changes"
      : hasSubs
        ? "Confirm Lineup Changes"
        : "Confirm Transfers";

  async function handleConfirm() {
    setState("submitting");
    setErrorMsg(null);
    try {
      if (hasTransfers) {
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
            ...(chipType !== undefined && { chipType }),
          }),
        });
        const json = (await res.json()) as {
          submitted?: boolean;
          alreadyApplied?: boolean;
          error?: string;
        };
        if (!res.ok || !json.submitted) {
          setErrorMsg(json.error ?? "Submission failed");
          setState("error");
          return;
        }
        setAlreadyApplied(json.alreadyApplied ?? false);
      }

      if (hasSubs) {
        const res = await fetch("/api/gw-plan/submit-lineup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            planId: plan.id,
            confirm: true,
            substitutionIndices: selectedSubstitutionIndices,
          }),
        });
        const json = (await res.json()) as {
          submitted?: boolean;
          error?: string;
        };
        if (!res.ok || !json.submitted) {
          setErrorMsg(json.error ?? "Lineup submission failed");
          setState("error");
          return;
        }
      }

      setState("success");
    } catch {
      setErrorMsg("Network error during submission");
      setState("error");
    }
  }

  const submittingMessage =
    hasTransfers && hasSubs
      ? "Submitting changes..."
      : hasSubs
        ? "Submitting lineup..."
        : "Submitting transfers...";

  const successMessage =
    hasTransfers && hasSubs
      ? "Changes submitted ✓"
      : hasSubs
        ? "Lineup submitted ✓"
        : alreadyApplied
          ? "Transfers already applied to your FPL team ✓"
          : "Transfers submitted ✓";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-fpl-border bg-fpl-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold">{modalTitle}</h2>

        {state === "confirm" && (
          <>
            <div className="mb-4 space-y-2">
              {selectedTransfers.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-fpl-danger">{t.playerOut.name}</span>
                  <span className="text-fpl-muted">→</span>
                  <span className="text-fpl-green">{t.playerIn.name}</span>
                  {(t.hitCost ?? 0) > 0 && (
                    <span className="ml-auto text-xs text-orange-400">
                      -{t.hitCost} pts
                    </span>
                  )}
                </div>
              ))}
              {selectedSubstitutions.map((s, i) => (
                <div
                  key={`sub-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-fpl-danger">{s.playerOut.name}</span>
                  <span className="text-fpl-muted">→</span>
                  <span className="text-fpl-green">{s.playerIn.name}</span>
                  <span className="ml-auto text-xs text-fpl-muted">Lineup</span>
                </div>
              ))}
            </div>

            <div className="mb-3 text-sm text-fpl-muted">
              Captain:{" "}
              <span className="font-semibold text-white">
                {plan.plan.captain.name} (C)
              </span>
            </div>

            {totalHitCost > 0 && (
              <p className="mb-3 text-sm text-orange-400">
                Hit cost: -{totalHitCost} pts
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
                {chipType === "wildcard"
                  ? `Submit Wildcard (${selectedTransfers.length} transfers) ▶`
                  : chipType === "freehit"
                    ? `Submit Free Hit (${selectedTransfers.length} transfers) ▶`
                    : "Confirm & Submit ▶"}
              </button>
            </div>
          </>
        )}

        {state === "submitting" && (
          <div className="flex items-center gap-2 text-sm text-fpl-muted">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-fpl-cyan border-t-transparent" />
            {submittingMessage}
          </div>
        )}

        {state === "success" && (
          <>
            <p className="mb-6 text-center text-fpl-green">{successMessage}</p>
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
