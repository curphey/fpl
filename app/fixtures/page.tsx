"use client";

import { useState, useMemo } from "react";
import { useBootstrapStatic, useFixtures } from "@/lib/fpl/hooks/use-fpl";
import { getCurrentGameweek, getNextGameweek } from "@/lib/fpl/utils";
import { buildFixtureGrid } from "@/lib/fpl/fixture-planner";
import { analyzeFixtureSwings } from "@/lib/fpl/fixture-swing";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { FixtureGrid } from "@/components/fixtures/fixture-grid";
import { BestTeamsRanking } from "@/components/fixtures/best-teams-ranking";
import { FixtureSwingAlerts } from "@/components/fixtures/fixture-swing-alerts";

type Tab = "grid" | "swings";

export default function FixturesPage() {
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

  const nextGw = bootstrap ? getNextGameweek(bootstrap.events) : undefined;
  const currentGw = bootstrap
    ? getCurrentGameweek(bootstrap.events)
    : undefined;
  const defaultStart = nextGw?.id ?? currentGw?.id ?? 1;

  const [tab, setTab] = useState<Tab>("grid");
  const [gwRange, setGwRange] = useState(6);
  const gwStart = defaultStart;
  const gwEnd = Math.min(gwStart + gwRange - 1, 38);

  const grid = useMemo(() => {
    if (!bootstrap || !fixtures) return null;
    return buildFixtureGrid(bootstrap.teams, fixtures, gwStart, gwEnd);
  }, [bootstrap, fixtures, gwStart, gwEnd]);

  const swingAnalysis = useMemo(() => {
    if (!bootstrap || !fixtures) return null;
    return analyzeFixtureSwings(bootstrap.teams, fixtures, defaultStart, 5);
  }, [bootstrap, fixtures, defaultStart]);

  const isLoading = bsLoading || fxLoading;
  const error = bsError || fxError;

  if (isLoading && !bootstrap) {
    return <DashboardSkeleton />;
  }

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

  if (!grid) {
    return <ErrorState message="No fixture data available" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Fixture Planner</h1>
          <p className="text-sm text-fpl-muted">
            GW{gwStart} &ndash; GW{gwEnd} fixture difficulty
          </p>
        </div>
        {tab === "grid" && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-fpl-muted">Show</label>
            {[4, 6, 8, 10].map((n) => (
              <button
                key={n}
                onClick={() => setGwRange(n)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  gwRange === n
                    ? "bg-fpl-green/20 text-fpl-green"
                    : "bg-fpl-card text-fpl-muted hover:text-foreground"
                }`}
              >
                {n} GWs
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-fpl-border">
        {[
          { key: "grid" as Tab, label: "Fixture Grid" },
          { key: "swings" as Tab, label: "Fixture Swings" },
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

      {tab === "grid" && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-fpl-muted">Difficulty:</span>
            {[
              { label: "1 (Easy)", cls: "bg-emerald-600" },
              { label: "2", cls: "bg-emerald-400/80" },
              { label: "3", cls: "bg-gray-400/80" },
              { label: "4", cls: "bg-orange-500/80" },
              { label: "5 (Hard)", cls: "bg-red-600" },
            ].map((d) => (
              <span key={d.label} className="flex items-center gap-1">
                <span className={`inline-block h-3 w-3 rounded ${d.cls}`} />
                {d.label}
              </span>
            ))}
          </div>

          {/* Grid */}
          <FixtureGrid rows={grid} gwStart={gwStart} gwEnd={gwEnd} />

          {/* Best teams ranking */}
          <BestTeamsRanking rows={grid} />
        </>
      )}

      {tab === "swings" && swingAnalysis && (
        <FixtureSwingAlerts analysis={swingAnalysis} />
      )}
    </div>
  );
}
