/**
 * FPL API Client
 * Server-side client for fetching data from the official FPL API
 */

import type {
  BootstrapStatic,
  Fixture,
  ElementSummary,
  LiveGameweek,
  ManagerEntry,
  ManagerHistory,
  ManagerPicks,
  LeagueStandings,
} from './types';

const FPL_API_BASE = 'https://fantasy.premierleague.com/api';

// Default headers for FPL API requests
const DEFAULT_HEADERS: HeadersInit = {
  'User-Agent': 'Mozilla/5.0 (compatible; FPL-App/1.0)',
  'Accept': 'application/json',
};

export class FPLApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string
  ) {
    super(message);
    this.name = 'FPLApiError';
  }
}

async function fetchFPL<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${FPL_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...options?.headers,
    },
    // Cache for 5 minutes by default (can be overridden)
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new FPLApiError(
      `FPL API error: ${response.status} ${response.statusText}`,
      response.status,
      endpoint
    );
  }

  return response.json();
}

/**
 * FPL API Client
 */
export const fplClient = {
  /**
   * Get all static data (players, teams, gameweeks, settings)
   * This is the main endpoint for bootstrap data
   */
  async getBootstrapStatic(): Promise<BootstrapStatic> {
    return fetchFPL<BootstrapStatic>('/bootstrap-static/');
  },

  /**
   * Get all fixtures
   */
  async getFixtures(): Promise<Fixture[]> {
    return fetchFPL<Fixture[]>('/fixtures/');
  },

  /**
   * Get fixtures for a specific gameweek
   */
  async getFixturesByGameweek(gameweek: number): Promise<Fixture[]> {
    return fetchFPL<Fixture[]>(`/fixtures/?event=${gameweek}`);
  },

  /**
   * Get detailed player summary (history, fixtures, past seasons)
   */
  async getPlayerSummary(playerId: number): Promise<ElementSummary> {
    return fetchFPL<ElementSummary>(`/element-summary/${playerId}/`);
  },

  /**
   * Get live gameweek data (scores, bonus, etc.)
   */
  async getLiveGameweek(gameweek: number): Promise<LiveGameweek> {
    return fetchFPL<LiveGameweek>(`/event/${gameweek}/live/`);
  },

  /**
   * Get manager entry info
   */
  async getManager(managerId: number): Promise<ManagerEntry> {
    return fetchFPL<ManagerEntry>(`/entry/${managerId}/`);
  },

  /**
   * Get manager history (past seasons, current season GW-by-GW, chips used)
   */
  async getManagerHistory(managerId: number): Promise<ManagerHistory> {
    return fetchFPL<ManagerHistory>(`/entry/${managerId}/history/`);
  },

  /**
   * Get manager's picks for a specific gameweek
   */
  async getManagerPicks(managerId: number, gameweek: number): Promise<ManagerPicks> {
    return fetchFPL<ManagerPicks>(`/entry/${managerId}/event/${gameweek}/picks/`);
  },

  /**
   * Get classic league standings
   */
  async getLeagueStandings(leagueId: number, page: number = 1): Promise<LeagueStandings> {
    return fetchFPL<LeagueStandings>(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`);
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the current gameweek from bootstrap data
 */
export function getCurrentGameweek(data: BootstrapStatic): number {
  const current = data.events.find((e) => e.is_current);
  if (current) return current.id;

  // If no current GW, find the next one
  const next = data.events.find((e) => e.is_next);
  if (next) return next.id;

  // Fallback to the last finished gameweek
  const finished = data.events.filter((e) => e.finished);
  return finished.length > 0 ? finished[finished.length - 1].id : 1;
}

/**
 * Get team by ID
 */
export function getTeamById(data: BootstrapStatic, teamId: number) {
  return data.teams.find((t) => t.id === teamId);
}

/**
 * Get player by ID
 */
export function getPlayerById(data: BootstrapStatic, playerId: number) {
  return data.elements.find((p) => p.id === playerId);
}

/**
 * Get players by team
 */
export function getPlayersByTeam(data: BootstrapStatic, teamId: number) {
  return data.elements.filter((p) => p.team === teamId);
}

/**
 * Get players by position
 */
export function getPlayersByPosition(data: BootstrapStatic, position: 1 | 2 | 3 | 4) {
  return data.elements.filter((p) => p.element_type === position);
}

/**
 * Convert price from API format (e.g., 100 = £10.0m)
 */
export function formatPrice(price: number): string {
  return `£${(price / 10).toFixed(1)}m`;
}

/**
 * Parse price to API format (e.g., £10.0m = 100)
 */
export function parsePrice(price: number): number {
  return Math.round(price * 10);
}

/**
 * Get fixture difficulty rating label
 */
export function getDifficultyLabel(difficulty: number): string {
  const labels: Record<number, string> = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Very Hard',
  };
  return labels[difficulty] || 'Unknown';
}

/**
 * Get fixture difficulty color class
 */
export function getDifficultyColor(difficulty: number): string {
  const colors: Record<number, string> = {
    1: 'bg-green-600',
    2: 'bg-green-400',
    3: 'bg-gray-400',
    4: 'bg-red-400',
    5: 'bg-red-600',
  };
  return colors[difficulty] || 'bg-gray-300';
}

export default fplClient;
