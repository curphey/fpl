"use client";

import { useEffect, useMemo } from "react";
import {
  useBootstrapStatic,
  useGameweekFixtures,
  useLiveGameweek,
} from "@/lib/fpl/hooks/use-fpl";
import { buildTeamMap, buildPlayerMap } from "@/lib/fpl/utils";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { MatchScores } from "@/components/live/match-scores";
import { TopPerformers } from "@/components/live/top-performers";
import { BPSTracker } from "@/components/live/bps-tracker";

export default function LivePage() {
  const {
    data: bootstrap,
    isLoading: bsLoading,
    error: bsError,
    refetch: bsRefetch,
  } = useBootstrapStatic();

  const currentGw = bootstrap
    ? bootstrap.events.find((e) => e.is_current)
    : undefined;
  const gwId = currentGw?.id ?? 0;

  const {
    data: fixtures,
    isLoading: fxLoading,
    error: fxError,
    refetch: fxRefetch,
  } = useGameweekFixtures(gwId);

  const {
    data: liveData,
    isLoading: liveLoading,
    error: liveError,
    refetch: liveRefetch,
  } = useLiveGameweek(gwId);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (gwId === 0) return;
    const interval = setInterval(() => {
      fxRefetch();
      liveRefetch();
    }, 60_000);
    return () => clearInterval(interval);
  }, [gwId, fxRefetch, liveRefetch]);

  const teamMap = useMemo(
    () => (bootstrap ? buildTeamMap(bootstrap.teams) : new Map()),
    [bootstrap],
  );

  const playerMap = useMemo(
    () => (bootstrap ? buildPlayerMap(bootstrap.elements) : new Map()),
    [bootstrap],
  );

  const isLoading = bsLoading || fxLoading || liveLoading;
  const error = bsError || fxError || liveError;

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
          liveRefetch();
        }}
      />
    );
  }

  if (!currentGw) {
    return (
      <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center">
        <h1 className="text-xl font-bold">Live Tracker</h1>
        <p className="mt-2 text-sm text-fpl-muted">
          No active gameweek. Check back when matches are being played.
        </p>
      </div>
    );
  }

  const anyLive = fixtures?.some((f) => f.started && !f.finished);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Live Tracker</h1>
          <p className="text-sm text-fpl-muted">
            {currentGw.name}
            {anyLive && " — matches in progress"}
          </p>
        </div>
        <button
          onClick={() => {
            fxRefetch();
            liveRefetch();
          }}
          className="rounded-lg bg-fpl-card px-3 py-1.5 text-xs font-medium text-fpl-muted transition-colors hover:bg-fpl-card-hover hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {/* Match scores */}
      {fixtures && <MatchScores fixtures={fixtures} teamMap={teamMap} />}

      {/* Live data sections */}
      <div className="grid gap-6 xl:grid-cols-2">
        {liveData && (
          <TopPerformers elements={liveData.elements} playerMap={playerMap} />
        )}
        {fixtures && liveData && (
          <BPSTracker
            fixtures={fixtures}
            elements={liveData.elements}
            playerMap={playerMap}
            teamMap={teamMap}
          />
        )}
      </div>
    </div>
  );
}
