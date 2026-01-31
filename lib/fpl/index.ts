/**
 * FPL Module - Main Entry Point
 */

// Types
export * from "./types";

// Server-side client
export { fplClient, FPLApiError } from "./client";
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
} from "./client";

// Utilities
export * from "./utils";

// League analyzer
export * from "./league-analyzer";

// Transfer model
export {
  scoreTransferTargets,
  TRANSFER_WEIGHTS,
  TRANSFER_CONFIG,
} from "./transfer-model";
export type { TransferRecommendation } from "./transfer-model";

// Captain model
export {
  scoreCaptainOptions,
  CAPTAIN_WEIGHTS,
  SET_PIECE_POINTS,
  MAX_SET_PIECE_SCORE,
  MIN_MINUTES_THRESHOLD,
  SAFE_OWNERSHIP_THRESHOLD,
} from "./captain-model";
export type { CaptainPick } from "./captain-model";

// Type guards for runtime validation
export {
  isBootstrapStatic,
  isFixture,
  isFixtureArray,
  isGameweek,
  isTeam,
  isPlayer,
  isManagerEntry,
  isManagerHistory,
  isManagerPicks,
  isLiveGameweek,
  isElementSummary,
  assertBootstrapStatic,
  assertFixtureArray,
  assertManagerEntry,
  assertManagerHistory,
  assertManagerPicks,
  assertLiveGameweek,
  assertElementSummary,
} from "./type-guards";

// Hooks (client-side only)
export {
  useBootstrapStatic,
  useEnrichedBootstrapStatic,
  useFixtures,
  useGameweekFixtures,
  usePlayerSummary,
  useLiveGameweek,
  useManager,
  useManagerHistory,
  useManagerPicks,
  useLeagueStandings,
  type EnrichedBootstrapStatic,
} from "./hooks/use-fpl";
export { useRivalPicks } from "./hooks/use-rival-picks";
export {
  useLeagueAnalysis,
  type RivalCount,
} from "./hooks/use-league-analysis";
export {
  useAggregatedRivalData,
  usePrefetchAggregatedRivalData,
} from "./hooks/use-aggregated-rival-data";
export { usePlayerComparison } from "./hooks/use-player-comparison";
