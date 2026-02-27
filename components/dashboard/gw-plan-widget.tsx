"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { GwPlan, TransferPrediction } from "@/lib/db/gw-plan";
import { TransferTracker } from "./transfer-tracker";
import { SubmitPlanModal } from "./submit-plan-modal";

interface GwPlanWidgetProps {
  sessionId: string;
  gameweek: number;
  /** Called with the gameweek number when transfers are successfully submitted to FPL. */
  onTransferSuccess?: (gameweek: number) => void;
}

export function GwPlanWidget({
  sessionId,
  gameweek,
  onTransferSuccess,
}: GwPlanWidgetProps) {
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState<GwPlan | null>(null);
  const [predictions, setPredictions] = useState<TransferPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fplConnected, setFplConnected] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedTransfers, setSelectedTransfers] = useState<Set<number>>(
    new Set(),
  );
  const [selectedSubstitutions, setSelectedSubstitutions] = useState<
    Set<number>
  >(new Set());

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/gw-plan/predictions?sessionId=${encodeURIComponent(sessionId)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          predictions: TransferPrediction[];
        };
        setPredictions(data.predictions);
      }
    } catch {
      // predictions are non-critical; ignore errors
    }
  }, [sessionId]);

  // On mount: check FPL auth status
  useEffect(() => {
    void fetch(
      `/api/fpl-auth/status?sessionId=${encodeURIComponent(sessionId)}`,
    )
      .then((r) => r.json())
      .then((d) => setFplConnected((d as { connected: boolean }).connected))
      .catch(() => {});
  }, [sessionId]);

  // On mount: check for a cached plan
  useEffect(() => {
    const checkCachedPlan = async () => {
      try {
        const res = await fetch(
          `/api/gw-plan?sessionId=${encodeURIComponent(sessionId)}&gw=${gameweek}`,
        );
        if (res.ok) {
          const data = (await res.json()) as GwPlan;
          setPlan(data);
          setSelectedTransfers(new Set(data.plan.transfers.map((_, i) => i)));
          setSelectedSubstitutions(
            new Set((data.plan.substitutions ?? []).map((_, i) => i)),
          );
          await fetchPredictions();
        }
        // 404 or other error => no cached plan, show generate button
      } catch {
        // network error => show generate button
      } finally {
        setInitialChecking(false);
      }
    };

    void checkCachedPlan();
  }, [sessionId, gameweek, fetchPredictions]);

  const generate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/gw-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, gameweek }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to generate plan");
      }

      const data = (await res.json()) as GwPlan;
      setPlan(data);
      setSelectedTransfers(new Set(data.plan.transfers.map((_, i) => i)));
      setSelectedSubstitutions(
        new Set((data.plan.substitutions ?? []).map((_, i) => i)),
      );
      await fetchPredictions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  };

  const toggleTransfer = (idx: number) => {
    setSelectedTransfers((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleSubstitution = (idx: number) => {
    setSelectedSubstitutions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  function buildSubmitLabel(transferCount: number, subCount: number): string {
    if (transferCount > 0 && subCount > 0) {
      return `Submit ${transferCount} Transfer${transferCount === 1 ? "" : "s"} + ${subCount} Sub${subCount === 1 ? "" : "s"}`;
    }
    if (subCount > 0) {
      return `Submit ${subCount} Sub${subCount === 1 ? "" : "s"}`;
    }
    return transferCount === 1
      ? "Submit 1 Transfer"
      : `Submit ${transferCount} Transfers`;
  }

  // While doing the initial cached-plan check, render nothing (avoids flicker)
  if (initialChecking) {
    return null;
  }

  const selectedCount = selectedTransfers.size;
  const submitLabel = buildSubmitLabel(
    selectedCount,
    selectedSubstitutions.size,
  );

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          GW Plan &mdash; Gameweek {gameweek}
        </h2>
        {plan && !loading && (
          <button
            onClick={() => void generate()}
            className="rounded px-3 py-1 text-xs font-medium text-fpl-cyan hover:text-white transition-colors"
          >
            Regenerate &#8635;
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-fpl-muted">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-fpl-cyan border-t-transparent" />
          Generating...
        </div>
      )}

      {/* No plan yet */}
      {!plan && !loading && !error && (
        <div className="mt-4">
          <p className="mb-3 text-sm text-fpl-muted">
            Generate an AI-powered gameweek plan with captain recommendation and
            transfer advice.
          </p>
          <button
            onClick={() => void generate()}
            className="rounded-lg bg-fpl-purple px-4 py-2 text-sm font-semibold text-white hover:bg-fpl-purple/80 transition-colors"
          >
            Generate GW Plan
          </button>
        </div>
      )}

      {/* No plan but there's an error — show button again */}
      {!plan && !loading && error && (
        <div className="mt-3">
          <button
            onClick={() => void generate()}
            className="rounded-lg bg-fpl-purple px-4 py-2 text-sm font-semibold text-white hover:bg-fpl-purple/80 transition-colors"
          >
            Generate GW Plan
          </button>
        </div>
      )}

      {/* Plan display */}
      {plan && !loading && (
        <div className="mt-4 space-y-4">
          {/* Predicted team score */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-fpl-muted">Predicted Team Score</p>
              <p className="text-2xl font-bold text-fpl-green">
                {plan.plan.predictedTeamPoints}
              </p>
            </div>
          </div>

          {/* Captain recommendation */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fpl-muted">
              Captain Pick
            </p>
            <p className="font-semibold text-white">{plan.plan.captain.name}</p>
            <p className="mt-1 text-sm text-fpl-muted">
              {plan.plan.captain.reasoning}
            </p>
          </div>

          {/* Transfers */}
          {plan.plan.transfers.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fpl-muted">
                Transfers
              </p>
              <div className="space-y-2">
                {plan.plan.transfers.map((transfer, idx) => (
                  <label
                    key={idx}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTransfers.has(idx)}
                      onChange={() => toggleTransfer(idx)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-fpl-green"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-400">
                          {transfer.playerOut.name}
                        </span>
                        <span className="text-fpl-muted">&#8594;</span>
                        <span className="text-fpl-green">
                          {transfer.playerIn.name}
                        </span>
                        <span className="ml-auto flex items-center gap-1.5 text-xs">
                          {transfer.hitCost > 0 && (
                            <span className="text-orange-400">
                              -{transfer.hitCost} hit
                            </span>
                          )}
                          {transfer.pointsGain > 0 && (
                            <span className="text-fpl-green">
                              +{Math.round(transfer.pointsGain)} pts net
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-fpl-muted">
                        {transfer.reasoning}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* No transfers — explicit message */}
          {plan.plan.transfers.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-fpl-muted mb-1">
                Transfers
              </p>
              <p className="text-sm text-fpl-muted">
                No transfers recommended this gameweek.
              </p>
            </div>
          )}

          {/* Substitutions */}
          {(plan.plan.substitutions?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fpl-muted">
                Substitutions
              </p>
              <div className="space-y-2">
                {(plan.plan.substitutions ?? []).map((sub, idx) => (
                  <label
                    key={idx}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubstitutions.has(idx)}
                      onChange={() => toggleSubstitution(idx)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-fpl-green"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-400">
                          {sub.playerOut.name}
                        </span>
                        <span className="text-fpl-muted">&#8594;</span>
                        <span className="text-fpl-green">
                          {sub.playerIn.name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-fpl-muted">
                        {sub.reasoning}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {plan.plan.notes && (
            <p className="rounded bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
              {plan.plan.notes}
            </p>
          )}

          {/* Transfer tracker */}
          <TransferTracker predictions={predictions} />

          {/* Submit to FPL button — shown when transfers or substitutions are selected */}
          {fplConnected &&
            (selectedCount > 0 || selectedSubstitutions.size > 0) && (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="w-full rounded-lg border border-fpl-green/40 bg-fpl-green/20 px-4 py-2 text-sm font-semibold text-fpl-green transition-colors hover:bg-fpl-green/30"
              >
                {`${submitLabel} ▶`}
              </button>
            )}

          {showSubmitModal && plan && (
            <SubmitPlanModal
              open={showSubmitModal}
              onClose={() => setShowSubmitModal(false)}
              plan={plan}
              sessionId={sessionId}
              selectedTransferIndices={Array.from(selectedTransfers).sort(
                (a, b) => a - b,
              )}
              selectedSubstitutionIndices={Array.from(
                selectedSubstitutions,
              ).sort((a, b) => a - b)}
              onSuccess={() => {
                setShowSubmitModal(false);
                // Clear submitted selections so the button disappears naturally
                setSelectedTransfers(new Set());
                setSelectedSubstitutions(new Set());
                onTransferSuccess?.(gameweek);
                void queryClient.invalidateQueries({
                  queryKey: ["manager-picks"],
                });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
