/**
 * FPL Module - Main Entry Point
 */

// Types
export * from './types';

// Server-side client
export { fplClient, FPLApiError } from './client';
export {
  getCurrentGameweek,
  getTeamById,
  getPlayerById,
  getPlayersByTeam,
  getPlayersByPosition,
  formatPrice,
  parsePrice,
  getDifficultyLabel,
  getDifficultyColor,
} from './client';

// Utilities
export * from './utils';

// Hooks (client-side only)
export {
  useBootstrapStatic,
  useFixtures,
  useGameweekFixtures,
  usePlayerSummary,
  useLiveGameweek,
  useManager,
  useManagerHistory,
  useManagerPicks,
  useLeagueStandings,
} from './hooks/use-fpl';
