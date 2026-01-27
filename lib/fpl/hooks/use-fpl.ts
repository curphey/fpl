'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  BootstrapStatic,
  Fixture,
  ElementSummary,
  LiveGameweek,
  ManagerEntry,
  ManagerHistory,
  ManagerPicks,
  LeagueStandings,
} from '../types';

interface UseFplDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useFplData<T>(url: string, options?: { enabled?: boolean }): UseFplDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const enabled = options?.enabled ?? true;

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        const result = await response.json();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [url, enabled, fetchKey]);

  return { data, isLoading, error, refetch };
}

/**
 * Hook to fetch bootstrap static data (all players, teams, gameweeks)
 */
export function useBootstrapStatic(): UseFplDataResult<BootstrapStatic> {
  return useFplData<BootstrapStatic>('/api/fpl/bootstrap-static');
}

/**
 * Hook to fetch all fixtures
 */
export function useFixtures(): UseFplDataResult<Fixture[]> {
  return useFplData<Fixture[]>('/api/fpl/fixtures');
}

/**
 * Hook to fetch fixtures for a specific gameweek
 */
export function useGameweekFixtures(gameweek: number): UseFplDataResult<Fixture[]> {
  return useFplData<Fixture[]>(`/api/fpl/fixtures?event=${gameweek}`, {
    enabled: gameweek > 0 && gameweek <= 38,
  });
}

/**
 * Hook to fetch player summary
 */
export function usePlayerSummary(playerId: number | null): UseFplDataResult<ElementSummary> {
  return useFplData<ElementSummary>(`/api/fpl/element-summary/${playerId}`, {
    enabled: playerId !== null && playerId > 0,
  });
}

/**
 * Hook to fetch live gameweek data
 */
export function useLiveGameweek(gameweek: number): UseFplDataResult<LiveGameweek> {
  return useFplData<LiveGameweek>(`/api/fpl/event/${gameweek}/live`, {
    enabled: gameweek > 0 && gameweek <= 38,
  });
}

/**
 * Hook to fetch manager entry info
 */
export function useManager(managerId: number | null): UseFplDataResult<ManagerEntry> {
  return useFplData<ManagerEntry>(`/api/fpl/entry/${managerId}`, {
    enabled: managerId !== null && managerId > 0,
  });
}

/**
 * Hook to fetch manager history
 */
export function useManagerHistory(managerId: number | null): UseFplDataResult<ManagerHistory> {
  return useFplData<ManagerHistory>(`/api/fpl/entry/${managerId}/history`, {
    enabled: managerId !== null && managerId > 0,
  });
}

/**
 * Hook to fetch manager picks for a gameweek
 */
export function useManagerPicks(
  managerId: number | null,
  gameweek: number
): UseFplDataResult<ManagerPicks> {
  return useFplData<ManagerPicks>(`/api/fpl/entry/${managerId}/event/${gameweek}/picks`, {
    enabled: managerId !== null && managerId > 0 && gameweek > 0 && gameweek <= 38,
  });
}

/**
 * Hook to fetch league standings
 */
export function useLeagueStandings(
  leagueId: number | null,
  page: number = 1
): UseFplDataResult<LeagueStandings> {
  return useFplData<LeagueStandings>(`/api/fpl/leagues-classic/${leagueId}/standings?page=${page}`, {
    enabled: leagueId !== null && leagueId > 0,
  });
}
