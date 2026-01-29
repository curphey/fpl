"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useManagerContext } from "@/lib/fpl/manager-context";
import {
  useBootstrapStatic,
  useManagerPicks,
  useLeagueStandings,
  useManagerHistory,
} from "@/lib/fpl/hooks/use-fpl";
import { useRivalPicks } from "@/lib/fpl/hooks/use-rival-picks";
import { useRivalHistories } from "@/lib/fpl/hooks/use-rival-histories";
import {
  getCurrentGameweek,
  buildPlayerMap,
  buildTeamMap,
} from "@/lib/fpl/utils";
import {
  selectRivals,
  buildRivalTeam,
  analyzeLeague,
  analyzeRivalChips,
} from "@/lib/fpl/league-analyzer";
import { ConnectPrompt } from "@/components/leagues/connect-prompt";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { AnalyzerHeader } from "@/components/league-analyzer/analyzer-header";
import { AnalyzerStats } from "@/components/league-analyzer/analyzer-stats";
import {
  AnalyzerTabs,
  type AnalyzerTab,
} from "@/components/league-analyzer/analyzer-tabs";
import { EffectiveOwnershipTable } from "@/components/league-analyzer/effective-ownership-table";
import { DifferentialsView } from "@/components/league-analyzer/differentials-view";
import { RivalComparisonView } from "@/components/league-analyzer/rival-comparison";
import { SwingScenariosTable } from "@/components/league-analyzer/swing-scenarios";
import { RivalChipsSection } from "@/components/leagues/rival-chips";

type RivalCount = 5 | 10 | 20;

export default function AnalyzePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const leagueId = Number(searchParams.get("league")) || null;

  const { managerId, manager } = useManagerContext();
  const {
    data: bootstrap,
    isLoading: bsLoading,
    error: bsError,
    refetch: bsRefetch,
  } = useBootstrapStatic();
  const {
    data: standings,
    isLoading: stLoading,
    error: stError,
    refetch: stRefetch,
  } = useLeagueStandings(leagueId);

  const [rivalCount, setRivalCount] = useState<RivalCount>(10);
  const [activeTab, setActiveTab] = useState<AnalyzerTab>("eo");

  // Derive current gameweek
  const currentGw = useMemo(() => {
    if (!bootstrap) return null;
    const gw = getCurrentGameweek(bootstrap.events);
    return gw?.id ?? null;
  }, [bootstrap]);

  // Fetch user's picks
  const {
    data: userPicksData,
    isLoading: upLoading,
    error: upError,
    refetch: upRefetch,
  } = useManagerPicks(managerId, currentGw ?? 0);

  // Select rivals from standings
  const rivalStandings = useMemo(() => {
    if (!standings || !managerId) return [];
    return selectRivals(standings.standings.results, managerId, rivalCount);
  }, [standings, managerId, rivalCount]);

  const rivalIds = useMemo(
    () => rivalStandings.map((r) => r.entry),
    [rivalStandings],
  );

  // Fetch rival picks
  const {
    data: rivalPicksMap,
    isLoading: rpLoading,
    progress: rpProgress,
    error: rpError,
    refetch: rpRefetch,
  } = useRivalPicks(rivalIds, currentGw ?? 0);

  // Fetch user's history for chip data
  const { data: userHistory } = useManagerHistory(managerId);

  // Fetch rival chip histories
  const { data: rivalChipHistories, isLoading: rhLoading } =
    useRivalHistories(rivalIds);

  // Build analysis
  const analysis = useMemo(() => {
    if (!bootstrap || !userPicksData || !standings || !managerId) return null;

    const playerMap = buildPlayerMap(bootstrap.elements);
    const teamMap = buildTeamMap(bootstrap.teams);

    const userStanding = standings.standings.results.find(
      (s) => s.entry === managerId,
    );
    if (!userStanding) return null;

    const leaderTotal = standings.standings.results[0]?.total ?? 0;

    // Build rival team objects from loaded picks
    const rivals = rivalStandings
      .filter((rs) => rivalPicksMap.has(rs.entry))
      .map((rs) =>
        buildRivalTeam(rs, rivalPicksMap.get(rs.entry)!, userStanding.total),
      );

    if (rivals.length === 0) return null;

    return {
      result: analyzeLeague(
        userPicksData.picks,
        userStanding,
        rivals,
        leaderTotal,
        playerMap,
        teamMap,
      ),
      playerMap,
      teamMap,
      rivals,
      userPicks: userPicksData.picks,
      userTotal: userStanding.total,
    };
  }, [
    bootstrap,
    userPicksData,
    standings,
    managerId,
    rivalStandings,
    rivalPicksMap,
  ]);

  // Build chip analysis
  const chipAnalysis = useMemo(() => {
    if (!analysis || rivalChipHistories.size === 0 || !currentGw) return null;

    const rivalsForChips = rivalStandings.map((rs) => ({
      entry: rs.entry,
      name: rs.entry_name,
      playerName: rs.player_name,
      rank: rs.rank,
      total: rs.total,
    }));

    return analyzeRivalChips(
      userHistory?.chips ?? [],
      rivalsForChips,
      rivalChipHistories,
      analysis.userTotal,
      currentGw,
    );
  }, [analysis, rivalChipHistories, rivalStandings, userHistory, currentGw]);

  // Guard: no manager connected
  if (!manager && !bsLoading) {
    return <ConnectPrompt />;
  }

  // Guard: no league specified
  if (!leagueId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold">No League Selected</h2>
          <p className="mt-1 text-sm text-fpl-muted">
            Go to the Leagues page and click &quot;Analyze&quot; on a league.
          </p>
        </div>
      </div>
    );
  }

  const isInitialLoading =
    bsLoading || stLoading || (upLoading && !userPicksData);
  const error = bsError || stError || upError || rpError;

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => {
          bsRefetch();
          stRefetch();
          upRefetch();
          rpRefetch();
        }}
      />
    );
  }

  const leagueName = standings?.league.name ?? "League";

  return (
    <div className="space-y-6">
      <AnalyzerHeader
        leagueName={leagueName}
        userRank={analysis?.result.userRank ?? null}
        rivalCount={rivalCount}
        onRivalCountChange={setRivalCount}
        isLoading={rpLoading}
        progress={rpProgress}
      />

      {analysis && (
        <>
          <AnalyzerStats
            userRank={analysis.result.userRank}
            uniquePlayers={analysis.result.uniquePlayerCount}
            eoCoverage={analysis.result.eoCoverage}
            gapToLeader={analysis.result.gapToLeader}
          />

          <AnalyzerTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === "eo" && (
            <EffectiveOwnershipTable
              data={analysis.result.effectiveOwnership}
            />
          )}

          {activeTab === "differentials" && (
            <DifferentialsView
              attack={analysis.result.yourDifferentials}
              cover={analysis.result.theirDifferentials}
            />
          )}

          {activeTab === "rival" && (
            <RivalComparisonView
              userPicks={analysis.userPicks}
              rivals={analysis.rivals}
              playerMap={analysis.playerMap}
              teamMap={analysis.teamMap}
            />
          )}

          {activeTab === "swing" && (
            <SwingScenariosTable data={analysis.result.swingScenarios} />
          )}

          {activeTab === "chips" && chipAnalysis && (
            <RivalChipsSection analysis={chipAnalysis} />
          )}

          {activeTab === "chips" && !chipAnalysis && !rhLoading && (
            <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center text-sm text-fpl-muted">
              Loading rival chip data...
            </div>
          )}
        </>
      )}

      {!analysis && !rpLoading && (
        <div className="rounded-lg border border-fpl-border bg-fpl-card p-8 text-center text-sm text-fpl-muted">
          Waiting for data to load...
        </div>
      )}
    </div>
  );
}
