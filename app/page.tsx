"use client";

import { useMemo } from "react";
import { useBootstrapStatic, useFixtures } from "@/lib/fpl/hooks/use-fpl";
import {
  getCurrentGameweek,
  getNextGameweek,
  enrichPlayers,
} from "@/lib/fpl/utils";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { GameweekBanner } from "@/components/dashboard/gameweek-banner";
import { KeyStatsOverview } from "@/components/dashboard/key-stats-overview";
import { TopPlayersTable } from "@/components/dashboard/top-players-table";
import { UpcomingFixtures } from "@/components/dashboard/upcoming-fixtures";
import { SeasonProgress } from "@/components/dashboard/season-progress";

export default function DashboardPage() {
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

  // Memoize expensive enrichPlayers computation (~700 players)
  // Must be called before early returns to satisfy React hooks rules
  const enriched = useMemo(
    () => (bootstrap ? enrichPlayers(bootstrap) : []),
    [bootstrap],
  );

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

  if (!bootstrap) {
    return <ErrorState message="No data available" />;
  }

  const currentGw = getCurrentGameweek(bootstrap.events);
  const nextGw = getNextGameweek(bootstrap.events);
  const displayGw = currentGw ?? nextGw;
  const fixtureGwId = nextGw?.id ?? currentGw?.id ?? 1;

  return (
    <div className="space-y-6">
      {displayGw && <GameweekBanner gameweek={displayGw} />}
      <KeyStatsOverview data={bootstrap} />
      <div className="grid gap-6 xl:grid-cols-2">
        <TopPlayersTable players={enriched} />
        {fixtures && (
          <UpcomingFixtures
            fixtures={fixtures}
            teams={bootstrap.teams}
            gameweekId={fixtureGwId}
          />
        )}
      </div>
      <SeasonProgress events={bootstrap.events} />
    </div>
  );
}
