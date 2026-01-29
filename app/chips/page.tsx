"use client";

import { useState, useMemo } from "react";
import {
  useBootstrapStatic,
  useFixtures,
  useManagerHistory,
  useManagerPicks,
} from "@/lib/fpl/hooks/use-fpl";
import {
  getNextGameweek,
  getCurrentGameweek,
  enrichPlayers,
} from "@/lib/fpl/utils";
import {
  analyzeChipStrategies,
  analyzeChipTiming,
  type ChipRecommendation,
} from "@/lib/fpl/chip-model";
import { CHIPS, getAvailableChips } from "@/lib/fpl/rules-engine";
import { useManagerContext } from "@/lib/fpl/manager-context";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChipTimingGrid } from "@/components/chips/chip-timing";

type Tab = "overview" | "timing";

const chipIcons: Record<string, string> = {
  wildcard: "WC",
  freehit: "FH",
  "3xc": "TC",
  bboost: "BB",
};

function scoreColor(score: number): string {
  if (score >= 60) return "text-fpl-green";
  if (score >= 35) return "text-yellow-400";
  return "text-fpl-muted";
}

function scoreBg(score: number): string {
  if (score >= 60) return "bg-fpl-green";
  if (score >= 35) return "bg-yellow-400";
  return "bg-fpl-muted";
}

function ChipCard({ rec }: { rec: ChipRecommendation }) {
  const chipInfo = CHIPS.find((c) => c.name === rec.chip);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-fpl-purple-light text-sm font-bold text-fpl-green">
              {chipIcons[rec.chip] ?? "?"}
            </span>
            <div>
              <CardTitle>{rec.label}</CardTitle>
              {chipInfo && (
                <p className="mt-0.5 text-xs text-fpl-muted">
                  {chipInfo.description}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${scoreColor(rec.score)}`}>
              {rec.score}
            </div>
            <div className="text-xs text-fpl-muted">/ 100</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Score bar */}
        <div className="mb-4 h-2 w-full rounded-full bg-fpl-border">
          <div
            className={`h-2 rounded-full transition-all ${scoreBg(rec.score)}`}
            style={{ width: `${rec.score}%` }}
          />
        </div>

        {/* Reasoning */}
        <ul className="space-y-1.5">
          {rec.reasoning.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-fpl-muted" />
              <span className="text-foreground/80">{reason}</span>
            </li>
          ))}
        </ul>

        {/* Suggested GW */}
        {rec.suggestedGw && (
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="green">Suggested: GW{rec.suggestedGw}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ChipsPage() {
  const {
    data: bootstrap,
    isLoading: bsLoading,
    error: bsError,
    refetch: bsRefetch,
  } = useBootstrapStatic();
  const {
    data: fixtures,
    isLoading: fxLoading,
    error: fxError,
    refetch: fxRefetch,
  } = useFixtures();
  const { managerId, manager } = useManagerContext();
  const { data: history, isLoading: histLoading } =
    useManagerHistory(managerId);

  const [tab, setTab] = useState<Tab>("overview");

  const nextGw = bootstrap ? getNextGameweek(bootstrap.events) : undefined;
  const currentGw = bootstrap
    ? getCurrentGameweek(bootstrap.events)
    : undefined;
  const targetGw = nextGw ?? currentGw;

  // Fetch manager picks for squad-aware analysis
  const { data: managerPicks } = useManagerPicks(managerId, currentGw?.id ?? 1);

  const usedChips = useMemo(() => history?.chips ?? [], [history?.chips]);

  const availableChips = useMemo(() => {
    if (!targetGw) return [];
    return getAvailableChips(usedChips, targetGw.id).map((c) => c.name);
  }, [usedChips, targetGw]);

  const recommendations = useMemo(() => {
    if (!bootstrap || !fixtures || !targetGw || availableChips.length === 0)
      return [];

    const enriched = enrichPlayers(bootstrap);

    return analyzeChipStrategies(
      enriched,
      fixtures,
      bootstrap.events,
      targetGw.id,
      availableChips,
    );
  }, [bootstrap, fixtures, targetGw, availableChips]);

  const timingAnalyses = useMemo(() => {
    if (!bootstrap || !fixtures || !targetGw || availableChips.length === 0)
      return [];

    const enriched = enrichPlayers(bootstrap);

    return analyzeChipTiming(
      enriched,
      fixtures,
      bootstrap.events,
      targetGw.id,
      availableChips,
      managerPicks?.picks,
    );
  }, [bootstrap, fixtures, targetGw, availableChips, managerPicks]);

  const isLoading =
    bsLoading || fxLoading || (managerId !== null && histLoading);
  const error = bsError || fxError;

  if (isLoading && !bootstrap) return <DashboardSkeleton />;
  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          bsRefetch();
          fxRefetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Chip Strategy Advisor</h1>
        <p className="text-sm text-fpl-muted">
          {targetGw
            ? `Analysis based on GW${targetGw.id}+ fixtures and form`
            : "When to play your chips for maximum impact"}
        </p>
      </div>

      {/* Info banner for unconnected users */}
      {!managerId && (
        <div className="rounded-lg border border-fpl-border bg-fpl-purple-light px-4 py-3">
          <p className="text-sm text-fpl-muted">
            <span className="font-medium text-foreground">
              Connect your FPL account
            </span>{" "}
            to see personalized chip recommendations based on your remaining
            chips and squad.
          </p>
        </div>
      )}

      {/* Used chips display for connected users */}
      {managerId && manager && usedChips.length > 0 && (
        <div className="rounded-lg border border-fpl-border bg-fpl-purple-light px-4 py-3">
          <p className="text-sm">
            <span className="text-fpl-muted">Used chips: </span>
            {usedChips.map((chip, i) => (
              <span key={chip.name + chip.event}>
                {i > 0 && ", "}
                <span className="text-foreground">
                  {CHIPS.find((c) => c.name === chip.name)?.label ?? chip.name}
                </span>
                <span className="text-fpl-muted"> (GW{chip.event})</span>
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-fpl-border">
        {[
          { key: "overview" as Tab, label: "Overview" },
          { key: "timing" as Tab, label: "Timing Optimizer" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-fpl-green text-fpl-green"
                : "border-transparent text-fpl-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {recommendations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {recommendations.map((rec) => (
                <ChipCard key={rec.chip} rec={rec} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <p className="py-4 text-center text-sm text-fpl-muted">
                  {managerId && usedChips.length === 4
                    ? "All chips have been used this season."
                    : "Unable to generate chip recommendations."}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "timing" && (
        <Card>
          <CardHeader>
            <CardTitle>Chip Timing Analysis</CardTitle>
            <p className="text-xs text-fpl-muted">
              Score each gameweek for optimal chip usage. Higher scores indicate
              better opportunities.
              {managerPicks?.picks && (
                <span className="text-fpl-green">
                  {" "}
                  Using your squad data for personalized analysis.
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent>
            <ChipTimingGrid analyses={timingAnalyses} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
