"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ManagerPicks } from "../types";

interface UseRivalPicksResult {
  data: Map<number, ManagerPicks>;
  isLoading: boolean;
  progress: { loaded: number; total: number };
  error: Error | null;
  refetch: () => void;
}

const BATCH_SIZE = 4; // Concurrent requests per batch
const DELAY_BETWEEN_BATCHES_MS = 150; // Delay between batches to respect rate limits

/**
 * Fetch picks for multiple managers using parallel batching.
 * Fetches BATCH_SIZE requests concurrently, then waits before the next batch.
 * This is faster than sequential fetching while still respecting rate limits.
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

    async function fetchOne(
      id: number,
    ): Promise<{ id: number; picks: ManagerPicks | null }> {
      try {
        const res = await fetch(
          `/api/fpl/entry/${id}/event/${gameweek}/picks`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Failed to fetch picks for manager ${id}`);
        const picks: ManagerPicks = await res.json();
        return { id, picks };
      } catch (err) {
        if (controller.signal.aborted) throw err;
        console.warn(`Failed to load picks for manager ${id}:`, err);
        return { id, picks: null };
      }
    }

    async function fetchAll() {
      const results = new Map<number, ManagerPicks>();
      let loaded = 0;

      // Process in batches
      for (let i = 0; i < managerIds.length; i += BATCH_SIZE) {
        if (controller.signal.aborted) return;

        const batch = managerIds.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(fetchOne));

        if (controller.signal.aborted) return;

        // Process batch results
        for (const result of batchResults) {
          if (result.picks) {
            results.set(result.id, result.picks);
          }
          loaded++;
        }

        // Update state after each batch
        setData(new Map(results));
        setProgress({ loaded, total });

        // Delay between batches (not after the last batch)
        if (i + BATCH_SIZE < managerIds.length && !controller.signal.aborted) {
          await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
        }
      }

      if (!controller.signal.aborted) {
        setIsLoading(false);
        if (results.size === 0 && managerIds.length > 0) {
          setError(new Error("Failed to load any rival picks"));
        }
      }
    }

    fetchAll();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameweek, managerIds.join(","), fetchKey]);

  return { data, isLoading, progress, error, refetch };
}
