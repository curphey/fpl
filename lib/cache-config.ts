/**
 * Unified Cache Configuration
 *
 * This file provides a single source of truth for cache TTLs used across
 * both the server-side LRU cache and the client-side TanStack Query cache.
 *
 * Cache Strategy:
 * - Server-side cache: Reduces calls to the external FPL API
 * - Client-side cache (TanStack Query): Reduces calls to our API routes
 *
 * Total maximum staleness = serverTTL + clientStaleTime
 * We set clientStaleTime <= serverTTL so that when client refetches,
 * the server cache is likely to have fresh data or be about to expire.
 */

export const CACHE_TTL = {
  /**
   * Bootstrap data (players, teams, gameweeks)
   * Changes rarely during a gameweek - can be cached longer
   */
  bootstrap: {
    server: 5 * 60 * 1000, // 5 minutes
    client: 5 * 60 * 1000, // 5 minutes
  },

  /**
   * Fixtures data
   * Very stable, changes only when fixtures are rescheduled
   */
  fixtures: {
    server: 10 * 60 * 1000, // 10 minutes
    client: 10 * 60 * 1000, // 10 minutes
  },

  /**
   * Live gameweek data (scores, bonus points)
   * Needs to be fresh during matches
   * Server cache is short but not too short to avoid rate limiting
   */
  live: {
    server: 30 * 1000, // 30 seconds
    client: 30 * 1000, // 30 seconds
  },

  /**
   * Manager data (entry info, history, picks)
   * Changes after each gameweek or when manager makes changes
   */
  manager: {
    server: 2 * 60 * 1000, // 2 minutes
    client: 2 * 60 * 1000, // 2 minutes
  },

  /**
   * League standings
   * Updates after gameweeks complete
   */
  league: {
    server: 5 * 60 * 1000, // 5 minutes
    client: 5 * 60 * 1000, // 5 minutes
  },

  /**
   * Player summary (history, fixtures)
   * Relatively stable data
   */
  playerSummary: {
    server: 5 * 60 * 1000, // 5 minutes
    client: 5 * 60 * 1000, // 5 minutes
  },
} as const;

/**
 * Extract server-side TTLs for the FPL client
 */
export const SERVER_CACHE_TTL = {
  default: CACHE_TTL.bootstrap.server,
  live: CACHE_TTL.live.server,
  manager: CACHE_TTL.manager.server,
  fixtures: CACHE_TTL.fixtures.server,
  playerSummary: CACHE_TTL.playerSummary.server,
  league: CACHE_TTL.league.server,
} as const;

/**
 * Extract client-side stale times for TanStack Query
 */
export const STALE_TIMES = {
  bootstrap: CACHE_TTL.bootstrap.client,
  fixtures: CACHE_TTL.fixtures.client,
  live: CACHE_TTL.live.client,
  manager: CACHE_TTL.manager.client,
  league: CACHE_TTL.league.client,
  playerSummary: CACHE_TTL.playerSummary.client,
} as const;
