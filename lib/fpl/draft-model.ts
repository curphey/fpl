/**
 * FPL Draft Model
 * Core logic for ADP calculation, draft suggestions, and keeper analysis
 */

import type { EnrichedPlayer } from "./utils";
import type {
  DraftPlayer,
  DraftState,
  DraftSettings,
  DraftPickSuggestion,
  AuctionBidSuggestion,
  KeeperAnalysis,
  KeeperScoreFactors,
  ADPTier,
  PositionalNeed,
  KeeperRecommendation,
  DraftRosterSlot,
  DraftBoard,
  DraftBoardCell,
} from "./draft-types";
import { DEFAULT_ROSTER_REQUIREMENTS } from "./draft-types";

// =============================================================================
// Constants
// =============================================================================

/** Weights for ADP calculation (must sum to 1.0) */
export const ADP_WEIGHTS = {
  OWNERSHIP: 0.35, // High ownership = high demand
  TOTAL_POINTS: 0.25, // Proven production
  FORM: 0.2, // Recent performance
  XGI: 0.2, // Underlying stats
} as const;

/** Position adjustment factors for ADP (attackers drafted earlier) */
export const POSITION_ADP_ADJUSTMENT = {
  1: 0.15, // GK - drafted later (higher ADP)
  2: 0.05, // DEF - slightly later
  3: -0.05, // MID - slightly earlier
  4: -0.1, // FWD - drafted earlier (lower ADP)
} as const;

/** Position scarcity factors (higher = scarcer) */
export const POSITION_SCARCITY = {
  1: 0.3, // GK - many serviceable options
  2: 0.5, // DEF - moderate scarcity
  3: 0.6, // MID - higher scarcity at top end
  4: 0.8, // FWD - fewest options, most scarce
} as const;

/** ADP tier boundaries */
export const ADP_TIER_BOUNDARIES = {
  ELITE: 20, // 1-20
  PREMIUM: 60, // 21-60
  MID: 120, // 61-120
  VALUE: 180, // 121-180
  // 181+ = BENCH
} as const;

/** Keeper score weights */
export const KEEPER_WEIGHTS = {
  CONSISTENCY: 0.25,
  UPSIDE: 0.25,
  POSITION_VALUE: 0.25,
  TRAJECTORY: 0.25,
} as const;

/** Default auction budget */
export const DEFAULT_AUCTION_BUDGET = 200;

/** Total roster size for draft */
export const DRAFT_ROSTER_SIZE = 15;

// =============================================================================
// ADP Calculation
// =============================================================================

/**
 * Calculate normalized score (0-1) for a value within a dataset.
 * Uses min-max normalization.
 */
function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/**
 * Calculate estimated ADP for all players.
 * ADP (Average Draft Position) estimates when a player would be drafted
 * based on ownership, points, form, and xGI.
 */
export function calculateEstimatedADP(
  players: EnrichedPlayer[],
): DraftPlayer[] {
  if (players.length === 0) return [];

  // Filter to available players with meaningful minutes
  const eligiblePlayers = players.filter(
    (p) => p.status === "a" && p.minutes >= 90,
  );

  if (eligiblePlayers.length === 0) return [];

  // Calculate ranges for normalization
  const ownershipValues = eligiblePlayers.map((p) => p.ownership_value);
  const pointsValues = eligiblePlayers.map((p) => p.total_points);
  const formValues = eligiblePlayers.map((p) => p.form_value);
  const xgiValues = eligiblePlayers.map((p) => p.xgi_value);

  const ranges = {
    ownership: {
      min: Math.min(...ownershipValues),
      max: Math.max(...ownershipValues),
    },
    points: { min: Math.min(...pointsValues), max: Math.max(...pointsValues) },
    form: { min: Math.min(...formValues), max: Math.max(...formValues) },
    xgi: { min: Math.min(...xgiValues), max: Math.max(...xgiValues) },
  };

  // Calculate raw ADP scores
  const playersWithScores = eligiblePlayers.map((player) => {
    const ownershipNorm = normalizeValue(
      player.ownership_value,
      ranges.ownership.min,
      ranges.ownership.max,
    );
    const pointsNorm = normalizeValue(
      player.total_points,
      ranges.points.min,
      ranges.points.max,
    );
    const formNorm = normalizeValue(
      player.form_value,
      ranges.form.min,
      ranges.form.max,
    );
    const xgiNorm = normalizeValue(
      player.xgi_value,
      ranges.xgi.min,
      ranges.xgi.max,
    );

    // Weighted average (higher = better, so will have lower ADP)
    const rawScore =
      ownershipNorm * ADP_WEIGHTS.OWNERSHIP +
      pointsNorm * ADP_WEIGHTS.TOTAL_POINTS +
      formNorm * ADP_WEIGHTS.FORM +
      xgiNorm * ADP_WEIGHTS.XGI;

    // Apply position adjustment
    const positionAdj =
      POSITION_ADP_ADJUSTMENT[player.element_type as 1 | 2 | 3 | 4] ?? 0;
    const adjustedScore = rawScore * (1 - positionAdj);

    return { player, score: adjustedScore };
  });

  // Sort by score descending (best players first) and assign ADP
  playersWithScores.sort((a, b) => b.score - a.score);

  return playersWithScores.map((item, index) => {
    const adp = index + 1;
    const tier = getADPTier(adp);

    // Value vs ADP: compare actual rank to expected (based on ownership alone)
    const expectedRank = Math.round(
      eligiblePlayers.length * (1 - item.player.ownership_value / 100),
    );
    const valueVsADP = expectedRank - adp;

    return {
      id: item.player.id,
      name: item.player.web_name,
      fullName: `${item.player.first_name} ${item.player.second_name}`,
      team: item.player.team_name,
      teamShort: item.player.team_short_name,
      positionId: item.player.element_type,
      position: item.player.position_short,
      price: item.player.now_cost / 10,
      totalPoints: item.player.total_points,
      form: item.player.form_value,
      ownership: item.player.ownership_value,
      xgi: item.player.xgi_value,
      minutes: item.player.minutes,
      status: item.player.status,
      estimatedADP: adp,
      adpTier: tier,
      valueVsADP,
      positionScarcity:
        POSITION_SCARCITY[item.player.element_type as 1 | 2 | 3 | 4] ?? 0.5,
      keeperValue: calculateKeeperValue(item.player),
      suggestedBidPercent: calculateSuggestedBidPercent(
        adp,
        eligiblePlayers.length,
      ),
    };
  });
}

/**
 * Get ADP tier based on rank.
 */
function getADPTier(adp: number): ADPTier {
  if (adp <= ADP_TIER_BOUNDARIES.ELITE) return "elite";
  if (adp <= ADP_TIER_BOUNDARIES.PREMIUM) return "premium";
  if (adp <= ADP_TIER_BOUNDARIES.MID) return "mid";
  if (adp <= ADP_TIER_BOUNDARIES.VALUE) return "value";
  return "bench";
}

/**
 * Calculate keeper value for a player (0-100).
 */
function calculateKeeperValue(player: EnrichedPlayer): number {
  // Base on points per game consistency and underlying stats
  const ppgNorm = Math.min(player.ppg_value / 8, 1) * 40; // Max 40 points
  const xgiNorm = Math.min(player.xgi_value / 15, 1) * 30; // Max 30 points
  const formNorm = Math.min(player.form_value / 8, 1) * 20; // Max 20 points
  const minutesNorm = Math.min(player.minutes / 2500, 1) * 10; // Max 10 points

  return Math.round(ppgNorm + xgiNorm + formNorm + minutesNorm);
}

/**
 * Calculate suggested bid percentage for auction drafts.
 */
function calculateSuggestedBidPercent(
  adp: number,
  totalPlayers: number,
): number {
  // Elite players should command ~10-15% of budget
  // Premium: 5-10%
  // Mid: 2-5%
  // Value: 1-2%
  // Bench: 0.5-1%
  const percentile = 1 - adp / totalPlayers;

  if (percentile >= 0.95) return 15;
  if (percentile >= 0.9) return 12;
  if (percentile >= 0.8) return 8;
  if (percentile >= 0.6) return 5;
  if (percentile >= 0.4) return 3;
  if (percentile >= 0.2) return 1.5;
  return 1;
}

// =============================================================================
// Snake Draft Suggestions
// =============================================================================

/**
 * Get current positional needs based on roster state.
 */
function getPositionalNeeds(
  roster: DraftRosterSlot[],
): Record<string, PositionalNeed> {
  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const requirements = DEFAULT_ROSTER_REQUIREMENTS;

  for (const slot of roster) {
    if (slot.player) {
      counts[slot.position]++;
    }
  }

  const needs: Record<string, PositionalNeed> = {};

  for (const pos of ["GK", "DEF", "MID", "FWD"] as const) {
    const current = counts[pos];
    const required = requirements[pos].min;
    const remaining = required - current;

    if (remaining >= 2) {
      needs[pos] = "critical";
    } else if (remaining >= 1) {
      needs[pos] = "moderate";
    } else {
      needs[pos] = "low";
    }
  }

  return needs;
}

/**
 * Get snake draft pick suggestions.
 * Returns top players to consider based on value vs ADP and positional needs.
 */
export function getSnakeDraftSuggestions(
  availablePlayers: DraftPlayer[],
  state: DraftState,
  count: number = 5,
): DraftPickSuggestion[] {
  if (availablePlayers.length === 0) return [];

  const needs = getPositionalNeeds(state.userRoster);

  // Score each available player
  const scored = availablePlayers.map((player) => {
    const positionNeed = needs[player.position] ?? "low";

    // Base value from ADP (lower ADP = higher value)
    const adpValue =
      100 - (player.estimatedADP / availablePlayers.length) * 100;

    // Position need bonus
    const needBonus =
      positionNeed === "critical" ? 20 : positionNeed === "moderate" ? 10 : 0;

    // Scarcity bonus (premium positions get extra weight when needed)
    const scarcityBonus =
      positionNeed !== "low" ? player.positionScarcity * 15 : 0;

    // Value vs ADP bonus (positive = value pick)
    const valueBonus = Math.max(0, player.valueVsADP * 0.5);

    const totalScore = adpValue + needBonus + scarcityBonus + valueBonus;

    return {
      player,
      score: totalScore,
      positionalNeed: positionNeed,
    };
  });

  // Sort by score and take top N
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map((item, index) => ({
    player: item.player,
    rank: index + 1,
    reasoning: generatePickReasoning(item.player, item.positionalNeed, state),
    positionalNeed: item.positionalNeed,
    valueScore: Math.round(item.score),
    isValue: item.player.valueVsADP > 5,
    isReach: item.player.valueVsADP < -10,
  }));
}

/**
 * Generate reasoning text for a pick suggestion.
 */
function generatePickReasoning(
  player: DraftPlayer,
  need: PositionalNeed,
  state: DraftState,
): string {
  const parts: string[] = [];

  // ADP value
  if (player.valueVsADP > 10) {
    parts.push(`Great value at pick ${state.currentPick}`);
  } else if (player.valueVsADP > 0) {
    parts.push(`Good value pick`);
  }

  // Positional need
  if (need === "critical") {
    parts.push(`fills critical ${player.position} need`);
  } else if (need === "moderate") {
    parts.push(`addresses ${player.position} need`);
  }

  // Tier
  if (player.adpTier === "elite") {
    parts.push(`elite tier talent`);
  } else if (player.adpTier === "premium") {
    parts.push(`premium option`);
  }

  // Form
  if (player.form > 6) {
    parts.push(`in excellent form (${player.form.toFixed(1)})`);
  }

  return parts.length > 0
    ? parts.join(", ")
    : "Solid selection at this position";
}

// =============================================================================
// Auction Draft Suggestions
// =============================================================================

/**
 * Get auction bid suggestion for a nominated player.
 */
export function getAuctionBidSuggestion(
  player: DraftPlayer,
  state: DraftState,
  _availablePlayers: DraftPlayer[],
): AuctionBidSuggestion {
  const budget = state.budgetRemaining ?? DEFAULT_AUCTION_BUDGET;
  const needs = getPositionalNeeds(state.userRoster);
  const positionalNeed = needs[player.position] ?? "low";

  // Calculate roster slots remaining
  const filledSlots = state.userRoster.filter((s) => s.player !== null).length;
  const remainingSlots = DRAFT_ROSTER_SIZE - filledSlots;

  // Reserve minimum for remaining slots (1 each)
  const reservedBudget = Math.max(0, remainingSlots - 1);
  const availableBudget = budget - reservedBudget;

  // Base bid on suggested percentage
  const baseBid = Math.round(
    (player.suggestedBidPercent / 100) * DEFAULT_AUCTION_BUDGET,
  );

  // Adjust for positional need
  const needMultiplier =
    positionalNeed === "critical"
      ? 1.3
      : positionalNeed === "moderate"
        ? 1.15
        : 1.0;

  // Adjust for remaining budget
  const budgetMultiplier = availableBudget / DEFAULT_AUCTION_BUDGET;

  const recommendedBid = Math.round(
    baseBid * needMultiplier * budgetMultiplier,
  );
  const minBid = Math.max(1, Math.round(recommendedBid * 0.7));
  const maxBid = Math.min(availableBudget, Math.round(recommendedBid * 1.3));

  // Determine if user should pursue
  const shouldPursue =
    positionalNeed === "critical" ||
    (positionalNeed === "moderate" && player.adpTier !== "bench") ||
    player.valueVsADP > 10;

  return {
    player,
    minBid,
    recommendedBid,
    maxBid,
    reasoning: generateBidReasoning(
      player,
      positionalNeed,
      recommendedBid,
      budget,
    ),
    positionalNeed,
    shouldPursue,
  };
}

/**
 * Generate reasoning for auction bid.
 */
function generateBidReasoning(
  player: DraftPlayer,
  need: PositionalNeed,
  recommendedBid: number,
  remainingBudget: number,
): string {
  const parts: string[] = [];

  // Budget context
  const budgetPercent = Math.round((recommendedBid / remainingBudget) * 100);
  parts.push(`${budgetPercent}% of remaining budget`);

  // Need context
  if (need === "critical") {
    parts.push(`critical ${player.position} need`);
  } else if (need === "moderate") {
    parts.push(`moderate ${player.position} need`);
  }

  // Tier context
  if (player.adpTier === "elite") {
    parts.push(`elite tier - worth pursuing`);
  } else if (player.adpTier === "bench") {
    parts.push(`bench tier - avoid overpaying`);
  }

  return parts.join(", ");
}

/**
 * Get value targets for auction nomination strategy.
 * Returns players that are undervalued relative to their ADP.
 */
export function getAuctionValueTargets(
  availablePlayers: DraftPlayer[],
  state: DraftState,
  count: number = 5,
): DraftPlayer[] {
  const needs = getPositionalNeeds(state.userRoster);

  return availablePlayers
    .filter((p) => {
      const need = needs[p.position] ?? "low";
      return need !== "low" && p.valueVsADP > 0;
    })
    .sort((a, b) => b.valueVsADP - a.valueVsADP)
    .slice(0, count);
}

// =============================================================================
// Keeper Analysis
// =============================================================================

/**
 * Analyze a player's keeper league value.
 * Helps managers decide which players to keep between seasons.
 */
export function analyzeKeeperValue(player: DraftPlayer): KeeperAnalysis {
  const factors = calculateKeeperFactors(player);
  const totalScore = Math.round(
    factors.consistency +
      factors.upside +
      factors.positionValue +
      factors.trajectory,
  );

  const recommendation = getKeeperRecommendation(totalScore);
  const reasoning = generateKeeperReasoning(player, factors, recommendation);

  return {
    player,
    keeperScore: totalScore,
    recommendation,
    reasoning,
    factors,
  };
}

/**
 * Calculate individual keeper score factors.
 */
function calculateKeeperFactors(player: DraftPlayer): KeeperScoreFactors {
  // Consistency: based on total points and form stability
  const consistency = Math.min(25, (player.totalPoints / 200) * 25);

  // Upside: based on xGI and form ceiling
  const upside = Math.min(25, (player.xgi / 12) * 15 + (player.form / 8) * 10);

  // Position value: premium positions (FWD, premium MID) worth more
  const positionMultipliers: Record<string, number> = {
    FWD: 1.0,
    MID: 0.85,
    DEF: 0.7,
    GK: 0.5,
  };
  const positionValue = (positionMultipliers[player.position] ?? 0.7) * 25;

  // Trajectory: form vs season average suggests improvement/decline
  const ppg = player.totalPoints / Math.max(1, player.minutes / 90);
  const trajectory =
    player.form > ppg
      ? Math.min(25, 12.5 + (player.form - ppg) * 2.5)
      : Math.max(0, 12.5 - (ppg - player.form) * 2.5);

  return {
    consistency: Math.round(consistency * 10) / 10,
    upside: Math.round(upside * 10) / 10,
    positionValue: Math.round(positionValue * 10) / 10,
    trajectory: Math.round(trajectory * 10) / 10,
  };
}

/**
 * Get keeper recommendation based on score.
 */
function getKeeperRecommendation(score: number): KeeperRecommendation {
  if (score >= 75) return "must-keep";
  if (score >= 55) return "keep";
  if (score >= 35) return "consider";
  return "drop";
}

/**
 * Generate reasoning text for keeper analysis.
 */
function generateKeeperReasoning(
  player: DraftPlayer,
  factors: KeeperScoreFactors,
  recommendation: KeeperRecommendation,
): string {
  const parts: string[] = [];

  // Top factor
  const topFactor = Object.entries(factors).reduce(
    (max, [key, value]) => (value > max.value ? { key, value } : max),
    { key: "", value: 0 },
  );

  const factorLabels: Record<string, string> = {
    consistency: "consistent production",
    upside: "high ceiling",
    positionValue: "premium position value",
    trajectory: "improving trajectory",
  };

  parts.push(factorLabels[topFactor.key] ?? "solid overall value");

  // Recommendation context
  switch (recommendation) {
    case "must-keep":
      parts.push("cornerstone player for your roster");
      break;
    case "keep":
      parts.push("valuable asset to retain");
      break;
    case "consider":
      parts.push("weigh against available alternatives");
      break;
    case "drop":
      parts.push("better options likely available in draft");
      break;
  }

  // Add tier context
  if (player.adpTier === "elite" || player.adpTier === "premium") {
    parts.push(`${player.adpTier} tier talent`);
  }

  return parts.join("; ");
}

/**
 * Batch analyze multiple players for keeper decisions.
 */
export function analyzeKeeperOptions(players: DraftPlayer[]): KeeperAnalysis[] {
  return players
    .map(analyzeKeeperValue)
    .sort((a, b) => b.keeperScore - a.keeperScore);
}

// =============================================================================
// Draft Board Utilities
// =============================================================================

/**
 * Initialize an empty draft board.
 */
export function initializeDraftBoard(
  totalManagers: number,
  totalRounds: number = DRAFT_ROSTER_SIZE,
): DraftBoard {
  const cells: DraftBoardCell[][] = [];
  const snakeDirections: boolean[] = [];
  let pickNumber = 0;

  for (let round = 0; round < totalRounds; round++) {
    const isLeftToRight = round % 2 === 0;
    snakeDirections.push(isLeftToRight);

    const roundCells: DraftBoardCell[] = [];

    for (let mgr = 0; mgr < totalManagers; mgr++) {
      pickNumber++;
      const actualManager = isLeftToRight ? mgr + 1 : totalManagers - mgr;

      roundCells.push({
        round: round + 1,
        managerPosition: actualManager,
        pickNumber,
        player: null,
        isUserPick: false,
        isCurrentPick: pickNumber === 1,
      });
    }

    // Sort by manager position for consistent grid display
    roundCells.sort((a, b) => a.managerPosition - b.managerPosition);
    cells.push(roundCells);
  }

  return {
    totalRounds,
    totalManagers,
    cells,
    snakeDirections,
  };
}

/**
 * Update draft board with user position.
 */
export function markUserPicks(
  board: DraftBoard,
  userPosition: number,
): DraftBoard {
  const newCells = board.cells.map((round) =>
    round.map((cell) => ({
      ...cell,
      isUserPick: cell.managerPosition === userPosition,
    })),
  );

  return { ...board, cells: newCells };
}

/**
 * Calculate which pick number the user has in a given round (snake draft).
 */
export function getUserPickInRound(
  round: number,
  userPosition: number,
  totalManagers: number,
): number {
  const isLeftToRight = round % 2 === 1; // Round 1 is left to right
  const roundStartPick = (round - 1) * totalManagers;

  if (isLeftToRight) {
    return roundStartPick + userPosition;
  } else {
    return roundStartPick + (totalManagers - userPosition + 1);
  }
}

/**
 * Determine whose turn it is given the current pick number.
 */
export function getManagerForPick(
  pickNumber: number,
  totalManagers: number,
): { round: number; managerPosition: number } {
  const round = Math.ceil(pickNumber / totalManagers);
  const pickInRound = ((pickNumber - 1) % totalManagers) + 1;
  const isLeftToRight = round % 2 === 1;

  const managerPosition = isLeftToRight
    ? pickInRound
    : totalManagers - pickInRound + 1;

  return { round, managerPosition };
}

// =============================================================================
// Draft State Management
// =============================================================================

/**
 * Create initial draft state from settings.
 */
export function createInitialDraftState(settings: DraftSettings): DraftState {
  const roster: DraftRosterSlot[] = [];

  // Create empty roster slots
  const { GK, DEF, MID, FWD } = DEFAULT_ROSTER_REQUIREMENTS;

  for (let i = 0; i < GK.min; i++) {
    roster.push({ position: "GK", playerId: null, player: null });
  }
  for (let i = 0; i < DEF.min; i++) {
    roster.push({ position: "DEF", playerId: null, player: null });
  }
  for (let i = 0; i < MID.min; i++) {
    roster.push({ position: "MID", playerId: null, player: null });
  }
  for (let i = 0; i < FWD.min; i++) {
    roster.push({ position: "FWD", playerId: null, player: null });
  }

  return {
    mode: settings.mode,
    totalManagers: settings.leagueSize,
    userPosition: settings.userDraftPosition,
    currentRound: 1,
    currentPick: 1,
    draftedPlayers: new Set(),
    userRoster: roster,
    budgetRemaining:
      settings.mode === "auction"
        ? (settings.auctionBudget ?? DEFAULT_AUCTION_BUDGET)
        : undefined,
    initialBudget:
      settings.mode === "auction"
        ? (settings.auctionBudget ?? DEFAULT_AUCTION_BUDGET)
        : undefined,
    isComplete: false,
  };
}

/**
 * Check if it's the user's turn to pick.
 */
export function isUserTurn(state: DraftState): boolean {
  if (state.mode === "auction") {
    return true; // In auction, user can always bid
  }

  const { managerPosition } = getManagerForPick(
    state.currentPick,
    state.totalManagers,
  );
  return managerPosition === state.userPosition;
}

/**
 * Make a pick in the draft.
 */
export function makeDraftPick(
  state: DraftState,
  player: DraftPlayer,
  bidAmount?: number,
): DraftState {
  const newDraftedPlayers = new Set(state.draftedPlayers);
  newDraftedPlayers.add(player.id);

  // Find empty slot for this position
  const newRoster = [...state.userRoster];
  const emptySlotIndex = newRoster.findIndex(
    (slot) => slot.position === player.position && slot.player === null,
  );

  if (emptySlotIndex !== -1) {
    newRoster[emptySlotIndex] = {
      position: player.position as "GK" | "DEF" | "MID" | "FWD",
      playerId: player.id,
      player,
    };
  }

  // Update budget for auction
  let newBudget = state.budgetRemaining;
  if (
    state.mode === "auction" &&
    bidAmount !== undefined &&
    newBudget !== undefined
  ) {
    newBudget -= bidAmount;
  }

  // Update pick number and round
  const newPick = state.currentPick + 1;
  const totalPicks = state.totalManagers * DRAFT_ROSTER_SIZE;
  const newRound = Math.ceil(newPick / state.totalManagers);

  return {
    ...state,
    currentPick: newPick,
    currentRound: newRound,
    draftedPlayers: newDraftedPlayers,
    userRoster: newRoster,
    budgetRemaining: newBudget,
    isComplete: newPick > totalPicks,
  };
}

/**
 * Get available players (not yet drafted).
 */
export function getAvailablePlayers(
  allPlayers: DraftPlayer[],
  draftedIds: Set<number>,
): DraftPlayer[] {
  return allPlayers.filter((p) => !draftedIds.has(p.id));
}
