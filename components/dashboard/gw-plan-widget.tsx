"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { GwPlan, TransferPrediction } from "@/lib/db/gw-plan";
import { TransferTracker } from "./transfer-tracker";
import { SubmitPlanModal } from "./submit-plan-modal";
import { PlanPitchView } from "./plan-pitch-view";

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
  const [managerId, setManagerId] = useState<number | null>(null);
  const [availableChips, setAvailableChips] = useState<{
    wildcard: boolean;
    freehit: boolean;
  }>({ wildcard: false, freehit: false });
  const [chipType, setChipType] = useState<"wildcard" | "freehit" | null>(null);
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

  // On mount: check FPL auth status and chip availability
  useEffect(() => {
    // Note: initialChecking is owned by the checkCachedPlan effect below.
    // Auth fetch errors are intentionally swallowed — the component falls back
    // to the disconnected state, and initialChecking will be set false by
    // checkCachedPlan regardless.
    void fetch(
      `/api/fpl-auth/status?sessionId=${encodeURIComponent(sessionId)}`,
    )
      .then((r) => r.json())
      .then(async (d) => {
        const data = d as {
          connected: boolean;
          managerId?: number | null;
        };
        setFplConnected(data.connected);
        const mid = data.managerId ?? null;
        setManagerId(mid);
        if (data.connected && mid !== null) {
          try {
            const histRes = await fetch(`/api/fpl/entry/${mid}/history`);
            if (histRes.ok) {
              const hist = (await histRes.json()) as {
                chips: Array<{ name: string; event: number }>;
              };
              const chips = hist.chips ?? [];
              const isFirstHalf = gameweek <= 19;
              const wildcardUsed = chips.some(
                (c) =>
                  c.name === "wildcard" &&
                  (isFirstHalf ? c.event <= 19 : c.event > 19),
              );
              const freehitUsed = chips.some((c) => c.name === "freehit");
              setAvailableChips({
                wildcard: !wildcardUsed,
                freehit: !freehitUsed,
              });
            }
          } catch {
            // chip availability is non-critical; ignore errors
          }
        }
      })
      .catch(() => {
        /* auth errors are non-fatal */
      });
  }, [sessionId, gameweek]);

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
          if (data.chipType) setChipType(data.chipType);
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
    setChipType(null);

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

  const generateChip = async (type: "wildcard" | "freehit") => {
    setLoading(true);
    setError(null);
    setChipType(null);

    try {
      const res = await fetch("/api/gw-plan/chip-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, gameweek, chipType: type }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Failed to generate ${type} plan`);
      }

      const data = (await res.json()) as GwPlan;
      setPlan(data);
      setChipType(type);
      // Pre-select all transfers (chip plans are all-or-nothing)
      setSelectedTransfers(new Set(data.plan.transfers.map((_, i) => i)));
      setSelectedSubstitutions(
        new Set((data.plan.substitutions ?? []).map((_, i) => i)),
      );
      await fetchPredictions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to generate ${type} plan`,
      );
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

  const chipButtons =
    fplConnected && (availableChips.wildcard || availableChips.freehit) ? (
      <div className="mt-2 flex gap-2">
        {availableChips.wildcard && (
          <button
            onClick={() => void generateChip("wildcard")}
            disabled={loading}
            className="rounded-lg border border-fpl-green/40 bg-fpl-green/10 px-4 py-2 text-sm font-semibold text-fpl-green hover:bg-fpl-green/20 transition-colors"
          >
            Wildcard
          </button>
        )}
        {availableChips.freehit && (
          <button
            onClick={() => void generateChip("freehit")}
            disabled={loading}
            className="rounded-lg border border-fpl-cyan/40 bg-fpl-cyan/10 px-4 py-2 text-sm font-semibold text-fpl-cyan hover:bg-fpl-cyan/20 transition-colors"
          >
            Free Hit
          </button>
        )}
      </div>
    ) : null;

  const selectedCount = selectedTransfers.size;
  const submitLabel = chipType
    ? chipType === "wildcard"
      ? `Submit Wildcard (${selectedCount} transfers)`
      : `Submit Free Hit (${selectedCount} transfers)`
    : buildSubmitLabel(selectedCount, selectedSubstitutions.size);

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-foreground sm:text-lg">
          GW Plan &mdash; Gameweek {gameweek}
        </h2>
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
          {chipButtons}
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
          {chipButtons}
        </div>
      )}

      {/* Plan display */}
      {plan && !loading && (
        <div className="mt-4 space-y-4">
          {/* Chip badge */}
          {chipType && (
            <span className="inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide bg-fpl-green/20 text-fpl-green border border-fpl-green/30">
              {chipType === "wildcard" ? "Wildcard Plan" : "Free Hit Plan"}
            </span>
          )}

          {/* Predicted team score */}
          <div className="flex items-center gap-3">
            <div>
              {chipType && plan.plan.currentSquadPredictedPoints != null ? (
                <>
                  {/* Single-GW score for wildcards (immediate gameweek) */}
                  {chipType === "wildcard" &&
                    plan.plan.predictedNextGwPoints != null && (
                      <div className="mb-3">
                        <p className="text-xs text-fpl-muted">
                          GW{gameweek} Predicted Score
                        </p>
                        <p className="text-2xl font-bold text-fpl-green">
                          {plan.plan.predictedNextGwPoints}
                        </p>
                      </div>
                    )}
                  <p className="text-xs text-fpl-muted">
                    {chipType === "wildcard"
                      ? "4-Gameweek Comparison"
                      : "Predicted Team Score"}{" "}
                    <span className="opacity-60">
                      (
                      {chipType === "wildcard"
                        ? "over 4 gameweeks"
                        : "this gameweek"}
                      )
                    </span>
                  </p>
                  <div className="mt-1 flex items-baseline gap-4">
                    <div>
                      <p className="text-xs text-fpl-muted">Current squad:</p>
                      <p className="text-lg font-semibold text-fpl-muted">
                        {Math.round(plan.plan.currentSquadPredictedPoints)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-fpl-muted">
                        {chipType === "wildcard" ? "Wildcard" : "Free Hit"}{" "}
                        squad:
                      </p>
                      <p className="text-2xl font-bold text-fpl-green">
                        {Math.round(plan.plan.predictedTeamPoints)}
                      </p>
                    </div>
                    {(() => {
                      const delta = Math.round(
                        plan.plan.predictedTeamPoints -
                          plan.plan.currentSquadPredictedPoints,
                      );
                      return (
                        <div>
                          <p className="text-xs text-fpl-muted">Improvement:</p>
                          <p
                            className={`text-lg font-bold ${delta >= 0 ? "text-fpl-green" : "text-red-400"}`}
                          >
                            {delta >= 0 ? "+" : ""}
                            {delta} pts
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-fpl-muted">Predicted Team Score</p>
                  <p className="text-2xl font-bold text-fpl-green">
                    {Math.round(plan.plan.predictedTeamPoints)}
                  </p>
                </>
              )}
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

          {/* Formation */}
          {plan.plan.formation && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fpl-muted">
                Formation
              </p>
              <p className="text-lg font-bold text-white">
                {plan.plan.formation}
              </p>
              {plan.plan.formationReasoning && (
                <p className="mt-1 text-sm text-fpl-muted">
                  {plan.plan.formationReasoning}
                </p>
              )}
            </div>
          )}

          {/* Transfers (non-chip plans only) */}
          {!plan.plan.chipSquad && (
            <>
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
            </>
          )}

          {/* Substitutions (non-chip plans only) */}
          {!plan.plan.chipSquad &&
            (plan.plan.substitutions?.length ?? 0) > 0 && (
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

          {/* Pitch view — shown for both chip and regular plans when lineup data is enriched */}
          {plan.plan.lineupPlan &&
            plan.plan.lineupPlan.startingXI.length > 0 &&
            plan.plan.lineupPlan.startingXI[0].teamCode != null && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fpl-muted">
                  Recommended Lineup
                </p>
                <PlanPitchView
                  startingXI={plan.plan.lineupPlan.startingXI}
                  benchOrder={plan.plan.lineupPlan.benchOrder}
                  captainId={plan.plan.captain.playerId}
                />
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

          {/* Plan actions: regenerate + chip options */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => void generate()}
              disabled={loading}
              className="rounded-lg border border-fpl-purple/40 bg-fpl-purple/10 px-4 py-2 text-sm font-semibold text-fpl-purple hover:bg-fpl-purple/20 transition-colors"
            >
              Regenerate Plan
            </button>
            {fplConnected && availableChips.wildcard && (
              <button
                onClick={() => void generateChip("wildcard")}
                disabled={loading}
                className="rounded-lg border border-fpl-green/40 bg-fpl-green/10 px-4 py-2 text-sm font-semibold text-fpl-green hover:bg-fpl-green/20 transition-colors"
              >
                Wildcard
              </button>
            )}
            {fplConnected && availableChips.freehit && (
              <button
                onClick={() => void generateChip("freehit")}
                disabled={loading}
                className="rounded-lg border border-fpl-cyan/40 bg-fpl-cyan/10 px-4 py-2 text-sm font-semibold text-fpl-cyan hover:bg-fpl-cyan/20 transition-colors"
              >
                Free Hit
              </button>
            )}
          </div>

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
              chipType={chipType ?? undefined}
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
