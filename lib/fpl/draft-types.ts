/**
 * FPL Draft Mode Type Definitions
 * Types for snake/auction draft simulators, ADP rankings, and keeper league analysis
 */

import type { PlayerPosition } from "./types";

// =============================================================================
// Core Draft Types
// =============================================================================

/** Draft mode type: snake (traditional) or auction (bid-based) */
export type DraftMode = "snake" | "auction";

/** ADP tier groupings based on estimated rank */
export type ADPTier = "elite" | "premium" | "mid" | "value" | "bench";

/** Positional need level for roster building */
export type PositionalNeed = "critical" | "moderate" | "low";

/** Keeper recommendation category */
export type KeeperRecommendation = "must-keep" | "keep" | "consider" | "drop";

// =============================================================================
// Draft Player Types
// =============================================================================

/**
 * Extended player data with draft-specific calculated fields.
 * Builds on base player data to add ADP estimates and draft value metrics.
 */
export interface DraftPlayer {
  /** Player ID from FPL API */
  id: number;
  /** Display name (web_name) */
  name: string;
  /** Full name */
  fullName: string;
  /** Team name */
  team: string;
  /** Team short name (3 letters) */
  teamShort: string;
  /** Position ID (1-4) */
  positionId: PlayerPosition;
  /** Position short name (GK/DEF/MID/FWD) */
  position: string;
  /** Current price in millions */
  price: number;
  /** Total points this season */
  totalPoints: number;
  /** Form (points per game recently) */
  form: number;
  /** Ownership percentage */
  ownership: number;
  /** Expected goal involvement (xG + xA) */
  xgi: number;
  /** Minutes played */
  minutes: number;
  /** Status (a=available, d=doubtful, etc.) */
  status: string;

  // Draft-specific calculated fields
  /** Estimated Average Draft Position (lower = drafted earlier) */
  estimatedADP: number;
  /** ADP tier grouping */
  adpTier: ADPTier;
  /** Value relative to ADP (positive = value pick, negative = reach) */
  valueVsADP: number;
  /** Position scarcity score (0-1, higher = scarcer position) */
  positionScarcity: number;
  /** Keeper league value score */
  keeperValue: number;
  /** Suggested bid percentage for auction (0-100) */
  suggestedBidPercent: number;
}

// =============================================================================
// Draft State Types
// =============================================================================

/** Position requirements for a valid FPL draft roster */
export interface DraftRosterRequirements {
  GK: { min: number; max: number };
  DEF: { min: number; max: number };
  MID: { min: number; max: number };
  FWD: { min: number; max: number };
}

/** Default roster requirements matching FPL draft rules */
export const DEFAULT_ROSTER_REQUIREMENTS: DraftRosterRequirements = {
  GK: { min: 2, max: 2 },
  DEF: { min: 5, max: 5 },
  MID: { min: 5, max: 5 },
  FWD: { min: 3, max: 3 },
};

/** A single slot in the user's draft roster */
export interface DraftRosterSlot {
  /** Position this slot is for */
  position: "GK" | "DEF" | "MID" | "FWD";
  /** Player ID if filled, null if empty */
  playerId: number | null;
  /** Player data if filled */
  player: DraftPlayer | null;
}

/**
 * Current state of a draft simulation.
 * Tracks all picks made and current turn.
 */
export interface DraftState {
  /** Draft mode (snake or auction) */
  mode: DraftMode;
  /** Total number of managers in the draft */
  totalManagers: number;
  /** User's draft position (1-indexed) */
  userPosition: number;
  /** Current round number (1-indexed) */
  currentRound: number;
  /** Current overall pick number */
  currentPick: number;
  /** Set of player IDs that have been drafted */
  draftedPlayers: Set<number>;
  /** User's roster slots */
  userRoster: DraftRosterSlot[];
  /** Remaining budget for auction mode */
  budgetRemaining?: number;
  /** Initial budget for auction mode */
  initialBudget?: number;
  /** Whether the draft is complete */
  isComplete: boolean;
}

/**
 * Settings for configuring a draft simulation.
 */
export interface DraftSettings {
  /** Draft mode */
  mode: DraftMode;
  /** Number of managers in the league (4-16) */
  leagueSize: number;
  /** User's draft position (1 to leagueSize) */
  userDraftPosition: number;
  /** Starting budget for auction mode (default 200) */
  auctionBudget?: number;
}

// =============================================================================
// Draft Suggestion Types
// =============================================================================

/**
 * A recommended pick during a draft.
 * Includes player, ranking, and reasoning.
 */
export interface DraftPickSuggestion {
  /** The recommended player */
  player: DraftPlayer;
  /** Overall rank among available players */
  rank: number;
  /** Short explanation of why this pick is recommended */
  reasoning: string;
  /** How much the user needs this position */
  positionalNeed: PositionalNeed;
  /** Combined value score (0-100) */
  valueScore: number;
  /** Whether this is a value pick vs ADP */
  isValue: boolean;
  /** Whether this is a reach pick vs ADP */
  isReach: boolean;
}

/**
 * Auction bid recommendation for a nominated player.
 */
export interface AuctionBidSuggestion {
  /** The nominated player */
  player: DraftPlayer;
  /** Minimum bid to stay competitive */
  minBid: number;
  /** Recommended bid based on value */
  recommendedBid: number;
  /** Maximum bid before overpaying */
  maxBid: number;
  /** Reasoning for the bid amounts */
  reasoning: string;
  /** Current positional need for this player */
  positionalNeed: PositionalNeed;
  /** Should the user actively pursue this player */
  shouldPursue: boolean;
}

// =============================================================================
// Keeper Analysis Types
// =============================================================================

/**
 * Analysis of a player's keeper league value.
 * Used to help managers decide who to keep between seasons.
 */
export interface KeeperAnalysis {
  /** The player being analyzed */
  player: DraftPlayer;
  /** Overall keeper score (0-100) */
  keeperScore: number;
  /** Recommendation category */
  recommendation: KeeperRecommendation;
  /** Detailed reasoning */
  reasoning: string;
  /** Score breakdown by factor */
  factors: KeeperScoreFactors;
}

/**
 * Breakdown of factors contributing to keeper score.
 */
export interface KeeperScoreFactors {
  /** Production consistency (0-25) */
  consistency: number;
  /** Upside/ceiling potential (0-25) */
  upside: number;
  /** Position value (premium positions worth more) (0-25) */
  positionValue: number;
  /** Career trajectory (improving vs declining) (0-25) */
  trajectory: number;
}

// =============================================================================
// Draft Board Types
// =============================================================================

/** A single cell in the draft board grid */
export interface DraftBoardCell {
  /** Round number */
  round: number;
  /** Manager position (1-indexed) */
  managerPosition: number;
  /** Overall pick number */
  pickNumber: number;
  /** Player drafted (null if not yet picked) */
  player: DraftPlayer | null;
  /** Whether this is the user's pick */
  isUserPick: boolean;
  /** Whether this is the current pick */
  isCurrentPick: boolean;
}

/** Full draft board state */
export interface DraftBoard {
  /** Total rounds (15 for FPL) */
  totalRounds: number;
  /** Total managers */
  totalManagers: number;
  /** Grid of cells [round][manager] */
  cells: DraftBoardCell[][];
  /** Snake direction for each round (true = left to right) */
  snakeDirections: boolean[];
}

// =============================================================================
// Position Filter Types
// =============================================================================

/** Position filter options for rankings table */
export type PositionFilter = "ALL" | "GK" | "DEF" | "MID" | "FWD";

/** Map position filter to position ID */
export const POSITION_FILTER_TO_ID: Record<
  Exclude<PositionFilter, "ALL">,
  PlayerPosition
> = {
  GK: 1,
  DEF: 2,
  MID: 3,
  FWD: 4,
};
