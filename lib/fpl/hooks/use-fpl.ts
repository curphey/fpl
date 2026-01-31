"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type {
  BootstrapStatic,
  Fixture,
  ElementSummary,
  LiveGameweek,
  ManagerEntry,
  ManagerHistory,
  ManagerPicks,
  LeagueStandings,
} from "../types";
import { STALE_TIMES } from "@/lib/query";

// Query keys for cache management
export const queryKeys = {
  bootstrap: ["bootstrap-static"] as const,
  fixtures: (gameweek?: number) =>
    gameweek ? (["fixtures", gameweek] as const) : (["fixtures"] as const),
  playerSummary: (playerId: number) => ["player-summary", playerId] as const,
  liveGameweek: (gameweek: number) => ["live-gameweek", gameweek] as const,
  manager: (managerId: number) => ["manager", managerId] as const,
  managerHistory: (managerId: number) =>
    ["manager-history", managerId] as const,
  managerPicks: (managerId: number, gameweek: number) =>
    ["manager-picks", managerId, gameweek] as const,
  leagueStandings: (leagueId: number, page: number) =>
    ["league-standings", leagueId, page] as const,
} as const;

// Generic fetch function with error handling
async function fetchFplData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  return response.json();
}

// Legacy interface for backwards compatibility
interface UseFplDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Adapter to convert UseQueryResult to legacy format
function useQueryAdapter<T>(
  queryResult: UseQueryResult<T, Error>,
): UseFplDataResult<T> {
  return {
    data: queryResult.data ?? null,
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    refetch: queryResult.refetch,
  };
}

/**
 * Hook to fetch bootstrap static data (all players, teams, gameweeks)
 * Data is cached and deduplicated across components
 */
export function useBootstrapStatic(): UseFplDataResult<BootstrapStatic> {
  const query = useQuery({
    queryKey: queryKeys.bootstrap,
    queryFn: () => fetchFplData<BootstrapStatic>("/api/fpl/bootstrap-static"),
    staleTime: STALE_TIMES.bootstrap,
  });
  return useQueryAdapter(query);
}

/**
 * Hook to fetch all fixtures
 * Data is cached and deduplicated across components
 */
export function useFixtures(): UseFplDataResult<Fixture[]> {
  const query = useQuery({
    queryKey: queryKeys.fixtures(),
    queryFn: () => fetchFplData<Fixture[]>("/api/fpl/fixtures"),
    staleTime: STALE_TIMES.fixtures,
  });
  return useQueryAdapter(query);
}

/**
 * Hook to fetch fixtures for a specific gameweek
 */
export function useGameweekFixtures(
  gameweek: number,
): UseFplDataResult<Fixture[]> {
  const query = useQuery({
    queryKey: queryKeys.fixtures(gameweek),
    queryFn: () =>
      fetchFplData<Fixture[]>(`/api/fpl/fixtures?event=${gameweek}`),
    staleTime: STALE_TIMES.fixtures,
    enabled: gameweek > 0 && gameweek <= 38,
  });
  return useQueryAdapter(query);
}

/**
 * Hook to fetch player summary
 */
export function usePlayerSummary(
  playerId: number | null,
): UseFplDataResult<ElementSummary> {
  const query = useQuery({
    queryKey: queryKeys.playerSummary(playerId ?? 0),
    queryFn: () =>
      fetchFplData<ElementSummary>(`/api/fpl/element-summary/${playerId}`),
    staleTime: STALE_TIMES.playerSummary,
    enabled: playerId !== null && playerId > 0,
  });
  return useQueryAdapter(query);
}

/**
 * Hook to fetch live gameweek data
 * Uses shorter stale time for fresh data during live games
 */
export function useLiveGameweek(
  gameweek: number,
): UseFplDataResult<LiveGameweek> {
  const query = useQuery({
    queryKey: queryKeys.liveGameweek(gameweek),
    queryFn: () =>
      fetchFplData<LiveGameweek>(`/api/fpl/event/${gameweek}/live`),
    staleTime: STALE_TIMES.live,
    enabled: gameweek > 0 && gameweek <= 38,
    // Refetch more frequently for live data
    refetchInterval: 60 * 1000, // 1 minute when component is mounted
  });
  return useQueryAdapter(query);
}

/**
 * Hook to fetch manager entry info
 */
export function useManager(
  managerId: number | null,
): UseFplDataResult<ManagerEntry> {
  const query = useQuery({
    queryKey: queryKeys.manager(managerId ?? 0),
    queryFn: () => fetchFplData<ManagerEntry>(`/api/fpl/entry/${managerId}`),
    staleTime: STALE_TIMES.manager,
    enabled: managerId !== null && managerId > 0,
  });
  return useQueryAdapter(query);
}

/**
 * Hook to fetch manager history
 */
export function useManagerHistory(
  managerId: number | null,
): UseFplDataResult<ManagerHistory> {
  const query = useQuery({
    queryKey: queryKeys.managerHistory(managerId ?? 0),
    queryFn: () =>
      fetchFplData<ManagerHistory>(`/api/fpl/entry/${managerId}/history`),
    staleTime: STALE_TIMES.manager,
    enabled: managerId !== null && managerId > 0,
  });
  return useQueryAdapter(query);
}

/**
 * Hook to fetch manager picks for a gameweek
 */
export function useManagerPicks(
  managerId: number | null,
  gameweek: number,
): UseFplDataResult<ManagerPicks> {
  const query = useQuery({
    queryKey: queryKeys.managerPicks(managerId ?? 0, gameweek),
    queryFn: () =>
      fetchFplData<ManagerPicks>(
        `/api/fpl/entry/${managerId}/event/${gameweek}/picks`,
      ),
    staleTime: STALE_TIMES.manager,
    enabled:
      managerId !== null && managerId > 0 && gameweek > 0 && gameweek <= 38,
  });
  return useQueryAdapter(query);
}

/**
 * Hook to fetch league standings
 */
export function useLeagueStandings(
  leagueId: number | null,
  page: number = 1,
): UseFplDataResult<LeagueStandings> {
  const query = useQuery({
    queryKey: queryKeys.leagueStandings(leagueId ?? 0, page),
    queryFn: () =>
      fetchFplData<LeagueStandings>(
        `/api/fpl/leagues-classic/${leagueId}/standings?page=${page}`,
      ),
    staleTime: STALE_TIMES.league,
    enabled: leagueId !== null && leagueId > 0,
  });
  return useQueryAdapter(query);
}
