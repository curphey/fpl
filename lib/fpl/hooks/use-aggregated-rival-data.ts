/**
 * Client-side hook for fetching aggregated rival data from the server.
 * Uses the /api/league-analysis endpoint to eliminate N+1 queries.
 *
 * This is a low-level hook for fetching raw rival data. For full league analysis,
 * use the useLeagueAnalysis hook instead.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LeagueAnalysisResponse,
  LeagueAnalysisRequest,
} from "@/app/api/league-analysis/route";
import type { ManagerPicks, ManagerChip } from "@/lib/fpl/types";

interface UseAggregatedRivalDataOptions {
  managerIds: number[];
  gameweek: number | null;
  includeChips?: boolean;
  enabled?: boolean;
}

interface UseAggregatedRivalDataResult {
  data: LeagueAnalysisResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  // Convenience accessors
  getPicksForManager: (managerId: number) => ManagerPicks | null;
  getChipsForManager: (managerId: number) => ManagerChip[];
  successfulPickCount: number;
  failedPickCount: number;
}

async function fetchAggregatedRivalData(
  request: LeagueAnalysisRequest,
): Promise<LeagueAnalysisResponse> {
  const response = await fetch("/api/league-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to fetch league analysis: ${response.status}`,
    );
  }

  return response.json();
}

/**
 * Hook for fetching aggregated rival picks and chips from the server.
 * Replaces N+1 queries with a single server-side aggregation.
 *
 * @example
 * ```tsx
 * const { data, getPicksForManager, isLoading } = useAggregatedRivalData({
 *   managerIds: [123, 456, 789],
 *   gameweek: 20,
 *   includeChips: true,
 * });
 *
 * // Get picks for a specific manager
 * const picks = getPicksForManager(123);
 * ```
 */
export function useAggregatedRivalData({
  managerIds,
  gameweek,
  includeChips = false,
  enabled = true,
}: UseAggregatedRivalDataOptions): UseAggregatedRivalDataResult {
  const query = useQuery({
    queryKey: [
      "aggregated-rival-data",
      managerIds.sort().join(","),
      gameweek,
      includeChips,
    ],
    queryFn: () =>
      fetchAggregatedRivalData({
        managerIds,
        gameweek: gameweek!,
        includeChips,
      }),
    enabled: enabled && gameweek !== null && managerIds.length > 0,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Build maps for quick access
  const picksMap = new Map<number, ManagerPicks | null>();
  const chipsMap = new Map<number, ManagerChip[]>();

  if (query.data) {
    for (const item of query.data.rivalPicks) {
      picksMap.set(item.managerId, item.picks);
    }
    if (query.data.rivalChips) {
      for (const item of query.data.rivalChips) {
        chipsMap.set(item.managerId, item.chips);
      }
    }
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
    getPicksForManager: (managerId: number) => picksMap.get(managerId) ?? null,
    getChipsForManager: (managerId: number) => chipsMap.get(managerId) ?? [],
    successfulPickCount: query.data?.stats.successfulPicks ?? 0,
    failedPickCount: query.data?.stats.failedPicks ?? 0,
  };
}

/**
 * Prefetch aggregated rival data for a set of managers.
 * Useful for warming the cache before navigation.
 */
export function usePrefetchAggregatedRivalData() {
  const queryClient = useQueryClient();

  return async (options: Omit<UseAggregatedRivalDataOptions, "enabled">) => {
    const { managerIds, gameweek, includeChips = false } = options;
    if (!gameweek || managerIds.length === 0) return;

    await queryClient.prefetchQuery({
      queryKey: [
        "aggregated-rival-data",
        managerIds.sort().join(","),
        gameweek,
        includeChips,
      ],
      queryFn: () =>
        fetchAggregatedRivalData({
          managerIds,
          gameweek,
          includeChips,
        }),
      staleTime: 60 * 1000,
    });
  };
}
