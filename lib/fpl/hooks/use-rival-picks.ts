'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ManagerPicks } from '../types';

interface UseRivalPicksResult {
  data: Map<number, ManagerPicks>;
  isLoading: boolean;
  progress: { loaded: number; total: number };
  error: Error | null;
  refetch: () => void;
}

const DELAY_MS = 200;

/**
 * Sequentially fetch picks for multiple managers with delays to respect rate limits.
 */
export function useRivalPicks(
  managerIds: number[],
  gameweek: number,
): UseRivalPicksResult {
  const [data, setData] = useState<Map<number, ManagerPicks>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const enabled = managerIds.length > 0 && gameweek > 0 && gameweek <= 38;

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Abort any in-flight fetch sequence
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const total = managerIds.length;
    setIsLoading(true);
    setError(null);
    setProgress({ loaded: 0, total });
    setData(new Map());

    async function fetchAll() {
      const results = new Map<number, ManagerPicks>();

      for (let i = 0; i < managerIds.length; i++) {
        if (controller.signal.aborted) return;

        const id = managerIds[i];
        try {
          const res = await fetch(
            `/api/fpl/entry/${id}/event/${gameweek}/picks`,
            { signal: controller.signal },
          );
          if (!res.ok) throw new Error(`Failed to fetch picks for manager ${id}`);
          const picks: ManagerPicks = await res.json();
          results.set(id, picks);

          if (!controller.signal.aborted) {
            setData(new Map(results));
            setProgress({ loaded: i + 1, total });
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          // Skip individual failures, continue with others
          console.warn(`Failed to load picks for manager ${id}:`, err);
        }

        // Rate-limit delay between requests
        if (i < managerIds.length - 1 && !controller.signal.aborted) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      }

      if (!controller.signal.aborted) {
        setIsLoading(false);
        if (results.size === 0 && managerIds.length > 0) {
          setError(new Error('Failed to load any rival picks'));
        }
      }
    }

    fetchAll();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameweek, managerIds.join(','), fetchKey]);

  return { data, isLoading, progress, error, refetch };
}
