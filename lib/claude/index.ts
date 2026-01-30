/**
 * Claude AI integration barrel exports
 */

// Types
export type {
  OptimizationType,
  TransferConstraints,
  ChipConstraints,
  WildcardConstraints,
  OptimizeRequest,
  TeamContext,
  LeagueContext,
  TransferRecommendation,
  ChipRecommendation,
  WildcardRecommendation,
  OptimizeResponse,
  OptimizeError,
} from "./types";

// News types
export type {
  NewsCategory,
  NewsItem,
  NewsSearchRequest,
  NewsSearchResponse,
  InjuryUpdate,
  TeamNewsUpdate,
  PressConferenceUpdate,
} from "./news-types";

// Client functions and configuration
export { runOptimization, CLAUDE_CONFIG } from "./client";

// News client functions
export {
  searchFPLNews,
  getInjuryUpdates,
  getTeamNews,
  clearNewsCaches,
  getDeduplicationStats,
} from "./news-client";

// Prompt builders
export {
  buildTransferPrompt,
  buildChipPrompt,
  buildWildcardPrompt,
  buildSystemPrompt,
} from "./prompts";

// Hooks
export { useNews, useInjuryUpdates, useTeamNews } from "./hooks";
