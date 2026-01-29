"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  NewsItem,
  NewsSearchResponse,
  NewsCategory,
  InjuryUpdate,
  TeamNewsUpdate,
} from "./news-types";

interface UseNewsOptions {
  query?: string;
  players?: string[];
  teams?: string[];
  categories?: NewsCategory[];
  limit?: number;
  enabled?: boolean;
}

interface UseNewsResult {
  news: NewsItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  cached: boolean;
}

export function useNews(options: UseNewsOptions = {}): UseNewsResult {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cached, setCached] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  const enabled = options.enabled !== false;

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function fetchNews() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();

        if (options.query) params.set("q", options.query);
        if (options.players?.length)
          params.set("players", options.players.join(","));
        if (options.teams?.length) params.set("teams", options.teams.join(","));
        if (options.categories?.length)
          params.set("categories", options.categories.join(","));
        if (options.limit) params.set("limit", String(options.limit));

        const response = await fetch(`/api/news?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to fetch news");
        }

        const data: NewsSearchResponse = await response.json();

        if (!cancelled) {
          setNews(data.items);
          setCached(data.cached);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchNews();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    options.query,
    options.players?.join(","),
    options.teams?.join(","),
    options.categories?.join(","),
    options.limit,
    fetchKey,
  ]);

  return { news, isLoading, error, refetch, cached };
}

interface UseInjuryUpdatesResult {
  injuries: InjuryUpdate[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useInjuryUpdates(players?: string[]): UseInjuryUpdatesResult {
  const [injuries, setInjuries] = useState<InjuryUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchInjuries() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (players?.length) params.set("players", players.join(","));

        const response = await fetch(`/api/news/injuries?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Failed to fetch injuries");
        }

        const data = await response.json();

        if (!cancelled) {
          setInjuries(data.injuries || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchInjuries();

    return () => {
      cancelled = true;
    };
  }, [players?.join(","), fetchKey]);

  return { injuries, isLoading, error, refetch };
}

interface UseTeamNewsResult {
  teamNews: TeamNewsUpdate | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useTeamNews(
  team: string | undefined,
  gameweek: number | undefined,
): UseTeamNewsResult {
  const [teamNews, setTeamNews] = useState<TeamNewsUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!team || !gameweek) return;

    let cancelled = false;

    async function fetchTeamNews() {
      setIsLoading(true);
      setError(null);

      try {
        const encodedTeam = encodeURIComponent(team!);
        const response = await fetch(
          `/api/news/team/${encodedTeam}?gw=${gameweek}`,
        );

        if (!response.ok) {
          if (response.status === 404) {
            setTeamNews(null);
            return;
          }
          throw new Error("Failed to fetch team news");
        }

        const data = await response.json();

        if (!cancelled) {
          setTeamNews(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchTeamNews();

    return () => {
      cancelled = true;
    };
  }, [team, gameweek, fetchKey]);

  return { teamNews, isLoading, error, refetch };
}
