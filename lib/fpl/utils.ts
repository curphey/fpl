/**
 * FPL Utility Functions
 * Data transformation and helper utilities
 */

import type {
  BootstrapStatic,
  Player,
  Team,
  Fixture,
  Gameweek,
  PlayerPosition,
  PlayerStatus,
} from './types';

// =============================================================================
// Player Utilities
// =============================================================================

/**
 * Get player's full name
 */
export function getPlayerFullName(player: Player): string {
  return `${player.first_name} ${player.second_name}`;
}

/**
 * Get player's display name (web_name is typically used)
 */
export function getPlayerDisplayName(player: Player): string {
  return player.web_name;
}

/**
 * Get player's price as a formatted string
 */
export function getPlayerPrice(player: Player): string {
  return `£${(player.now_cost / 10).toFixed(1)}m`;
}

/**
 * Get player's price as a number (in millions)
 */
export function getPlayerPriceValue(player: Player): number {
  return player.now_cost / 10;
}

/**
 * Get player's position name
 */
export function getPositionName(position: PlayerPosition): string {
  const names: Record<PlayerPosition, string> = {
    1: 'Goalkeeper',
    2: 'Defender',
    3: 'Midfielder',
    4: 'Forward',
  };
  return names[position];
}

/**
 * Get player's position short name
 */
export function getPositionShortName(position: PlayerPosition): string {
  const names: Record<PlayerPosition, string> = {
    1: 'GK',
    2: 'DEF',
    3: 'MID',
    4: 'FWD',
  };
  return names[position];
}

/**
 * Get player's availability status info
 */
export function getPlayerStatusInfo(status: PlayerStatus): { label: string; severity: 'available' | 'warning' | 'danger' | 'unknown' } {
  const statusMap: Record<PlayerStatus, { label: string; severity: 'available' | 'warning' | 'danger' | 'unknown' }> = {
    a: { label: 'Available', severity: 'available' },
    d: { label: 'Doubtful', severity: 'warning' },
    i: { label: 'Injured', severity: 'danger' },
    s: { label: 'Suspended', severity: 'danger' },
    u: { label: 'Unavailable', severity: 'danger' },
    n: { label: 'Not in squad', severity: 'unknown' },
  };
  return statusMap[status] || { label: 'Unknown', severity: 'unknown' };
}

/**
 * Get player's form as a number
 */
export function getPlayerForm(player: Player): number {
  return parseFloat(player.form) || 0;
}

/**
 * Get player's points per game as a number
 */
export function getPlayerPointsPerGame(player: Player): number {
  return parseFloat(player.points_per_game) || 0;
}

/**
 * Calculate player's value score (points per million)
 */
export function getPlayerValueScore(player: Player): number {
  const price = player.now_cost / 10;
  if (price === 0) return 0;
  return player.total_points / price;
}

/**
 * Get player's expected goals as a number
 */
export function getPlayerXG(player: Player): number {
  return parseFloat(player.expected_goals) || 0;
}

/**
 * Get player's expected assists as a number
 */
export function getPlayerXA(player: Player): number {
  return parseFloat(player.expected_assists) || 0;
}

/**
 * Get player's expected goal involvement (xG + xA)
 */
export function getPlayerXGI(player: Player): number {
  return getPlayerXG(player) + getPlayerXA(player);
}

/**
 * Get player's ICT index as a number
 */
export function getPlayerICT(player: Player): number {
  return parseFloat(player.ict_index) || 0;
}

/**
 * Get player's ownership percentage as a number
 */
export function getPlayerOwnership(player: Player): number {
  return parseFloat(player.selected_by_percent) || 0;
}

// =============================================================================
// Team Utilities
// =============================================================================

/**
 * Get team's short name (e.g., "ARS" for Arsenal)
 */
export function getTeamShortName(team: Team): string {
  return team.short_name;
}

/**
 * Build a team lookup map for quick access
 */
export function buildTeamMap(teams: Team[]): Map<number, Team> {
  return new Map(teams.map((team) => [team.id, team]));
}

/**
 * Build a player lookup map for quick access
 */
export function buildPlayerMap(players: Player[]): Map<number, Player> {
  return new Map(players.map((player) => [player.id, player]));
}

// =============================================================================
// Fixture Utilities
// =============================================================================

/**
 * Get fixture difficulty color class (Tailwind)
 */
export function getFixtureDifficultyClass(difficulty: number): string {
  const classes: Record<number, string> = {
    1: 'bg-green-500 text-white',
    2: 'bg-green-300 text-gray-900',
    3: 'bg-gray-300 text-gray-900',
    4: 'bg-red-300 text-gray-900',
    5: 'bg-red-500 text-white',
  };
  return classes[difficulty] || 'bg-gray-200 text-gray-900';
}

/**
 * Format fixture kickoff time
 */
export function formatKickoffTime(kickoffTime: string | null): string {
  if (!kickoffTime) return 'TBD';

  const date = new Date(kickoffTime);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format fixture kickoff date only
 */
export function formatKickoffDate(kickoffTime: string | null): string {
  if (!kickoffTime) return 'TBD';

  const date = new Date(kickoffTime);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Get fixture result string
 */
export function getFixtureResult(fixture: Fixture): string {
  if (!fixture.finished || fixture.team_h_score === null || fixture.team_a_score === null) {
    return '';
  }
  return `${fixture.team_h_score} - ${fixture.team_a_score}`;
}

/**
 * Check if fixture is a blank (no fixture scheduled)
 */
export function isBlankFixture(fixture: Fixture | null): boolean {
  return fixture === null || fixture.event === null;
}

// =============================================================================
// Gameweek Utilities
// =============================================================================

/**
 * Get current gameweek
 */
export function getCurrentGameweek(events: Gameweek[]): Gameweek | undefined {
  return events.find((e) => e.is_current);
}

/**
 * Get next gameweek
 */
export function getNextGameweek(events: Gameweek[]): Gameweek | undefined {
  return events.find((e) => e.is_next);
}

/**
 * Get gameweek by ID
 */
export function getGameweekById(events: Gameweek[], id: number): Gameweek | undefined {
  return events.find((e) => e.id === id);
}

/**
 * Format gameweek deadline
 */
export function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get time until deadline
 */
export function getTimeUntilDeadline(deadline: string): { days: number; hours: number; minutes: number; isPast: boolean } {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, isPast: false };
}

/**
 * Format time until deadline as string
 */
export function formatTimeUntilDeadline(deadline: string): string {
  const { days, hours, minutes, isPast } = getTimeUntilDeadline(deadline);

  if (isPast) {
    return 'Deadline passed';
  }

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

// =============================================================================
// Sorting and Filtering
// =============================================================================

/**
 * Sort players by total points (descending)
 */
export function sortPlayersByPoints(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.total_points - a.total_points);
}

/**
 * Sort players by form (descending)
 */
export function sortPlayersByForm(players: Player[]): Player[] {
  return [...players].sort((a, b) => getPlayerForm(b) - getPlayerForm(a));
}

/**
 * Sort players by price (descending)
 */
export function sortPlayersByPrice(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.now_cost - a.now_cost);
}

/**
 * Sort players by value (points per million, descending)
 */
export function sortPlayersByValue(players: Player[]): Player[] {
  return [...players].sort((a, b) => getPlayerValueScore(b) - getPlayerValueScore(a));
}

/**
 * Sort players by ownership (descending)
 */
export function sortPlayersByOwnership(players: Player[]): Player[] {
  return [...players].sort((a, b) => getPlayerOwnership(b) - getPlayerOwnership(a));
}

/**
 * Filter players by position
 */
export function filterPlayersByPosition(players: Player[], position: PlayerPosition): Player[] {
  return players.filter((p) => p.element_type === position);
}

/**
 * Filter players by team
 */
export function filterPlayersByTeam(players: Player[], teamId: number): Player[] {
  return players.filter((p) => p.team === teamId);
}

/**
 * Filter players by price range
 */
export function filterPlayersByPriceRange(players: Player[], minPrice: number, maxPrice: number): Player[] {
  const minCost = minPrice * 10;
  const maxCost = maxPrice * 10;
  return players.filter((p) => p.now_cost >= minCost && p.now_cost <= maxCost);
}

/**
 * Filter available players only
 */
export function filterAvailablePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.status === 'a');
}

/**
 * Search players by name
 */
export function searchPlayers(players: Player[], query: string): Player[] {
  const lowerQuery = query.toLowerCase();
  return players.filter((p) =>
    p.web_name.toLowerCase().includes(lowerQuery) ||
    p.first_name.toLowerCase().includes(lowerQuery) ||
    p.second_name.toLowerCase().includes(lowerQuery)
  );
}

// =============================================================================
// Data Enrichment
// =============================================================================

export interface EnrichedPlayer extends Player {
  team_name: string;
  team_short_name: string;
  position_name: string;
  position_short: string;
  price_formatted: string;
  form_value: number;
  ppg_value: number;
  value_score: number;
  xg_value: number;
  xa_value: number;
  xgi_value: number;
  ict_value: number;
  ownership_value: number;
}

/**
 * Enrich player with computed values and team info
 */
export function enrichPlayer(player: Player, teamMap: Map<number, Team>): EnrichedPlayer {
  const team = teamMap.get(player.team);

  return {
    ...player,
    team_name: team?.name || 'Unknown',
    team_short_name: team?.short_name || '???',
    position_name: getPositionName(player.element_type),
    position_short: getPositionShortName(player.element_type),
    price_formatted: getPlayerPrice(player),
    form_value: getPlayerForm(player),
    ppg_value: getPlayerPointsPerGame(player),
    value_score: getPlayerValueScore(player),
    xg_value: getPlayerXG(player),
    xa_value: getPlayerXA(player),
    xgi_value: getPlayerXGI(player),
    ict_value: getPlayerICT(player),
    ownership_value: getPlayerOwnership(player),
  };
}

/**
 * Enrich all players with computed values and team info
 */
export function enrichPlayers(data: BootstrapStatic): EnrichedPlayer[] {
  const teamMap = buildTeamMap(data.teams);
  return data.elements.map((player) => enrichPlayer(player, teamMap));
}
