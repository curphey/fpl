"use client";

import { useMemo } from "react";
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
  type LeagueAnalysis,
  type RivalChipAnalysis,
  type RivalTeam,
} from "@/lib/fpl/league-analyzer";
import type { Player, Team, Pick } from "@/lib/fpl/types";

export type RivalCount = 5 | 10 | 20;

export interface LeagueAnalysisData {
  result: LeagueAnalysis;
  playerMap: Map<number, Player>;
  teamMap: Map<number, Team>;
  rivals: RivalTeam[];
  userPicks: Pick[];
  userTotal: number;
}

export interface UseLeagueAnalysis {
  /** Bootstrap data loading state */
  isBootstrapLoading: boolean;
  /** Standings data loading state */
  isStandingsLoading: boolean;
  /** User picks loading state */
  isUserPicksLoading: boolean;
  /** Rival picks loading state */
  isRivalPicksLoading: boolean;
  /** Rival chip histories loading state */
  isChipsLoading: boolean;
  /** Combined initial loading state */
  isInitialLoading: boolean;
  /** Any error from data fetching */
  error: Error | null;
  /** Refetch all data */
  refetch: () => void;
  /** Progress of rival picks fetch */
  rivalPicksProgress: { loaded: number; total: number };
  /** Whether user is connected */
  isConnected: boolean;
  /** Current gameweek ID */
  currentGw: number | null;
  /** League name */
  leagueName: string | null;
  /** League analysis result */
  analysis: LeagueAnalysisData | null;
  /** Chip analysis result */
  chipAnalysis: RivalChipAnalysis | null;
}

/**
 * Hook for analyzing a mini-league.
 * Encapsulates all data fetching and analysis logic for the league analyzer page.
 */
export function useLeagueAnalysis(
  leagueId: number | null,
  rivalCount: RivalCount,
): UseLeagueAnalysis {
  const { managerId } = useManagerContext();

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
  const analysis = useMemo((): LeagueAnalysisData | null => {
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
  const chipAnalysis = useMemo((): RivalChipAnalysis | null => {
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

  const refetch = () => {
    bsRefetch();
    stRefetch();
    upRefetch();
    rpRefetch();
  };

  const error = bsError || stError || upError || rpError;
  const isInitialLoading =
    bsLoading || stLoading || (upLoading && !userPicksData);

  return {
    isBootstrapLoading: bsLoading,
    isStandingsLoading: stLoading,
    isUserPicksLoading: upLoading,
    isRivalPicksLoading: rpLoading,
    isChipsLoading: rhLoading,
    isInitialLoading,
    error,
    refetch,
    rivalPicksProgress: rpProgress,
    isConnected: !!managerId,
    currentGw,
    leagueName: standings?.league.name ?? null,
    analysis,
    chipAnalysis,
  };
}
