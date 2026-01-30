import type { Fixture } from "./types";
import type { EnrichedPlayer } from "./utils";
import { getPlayerForm, getPlayerValueScore, getPlayerXGI } from "./utils";

/**
 * Transfer model weight configuration.
 * Weights must sum to 1.0.
 */
export const TRANSFER_WEIGHTS = {
  /** Weight for recent form (points per match) */
  FORM: 0.3,
  /** Weight for fixture difficulty (easier = higher score) */
  FIXTURE: 0.25,
  /** Weight for value (points per million) */
  VALUE: 0.25,
  /** Weight for expected goals + assists */
  XGI: 0.2,
} as const;

/**
 * Transfer model configuration constants.
 */
export const TRANSFER_CONFIG = {
  /** Default number of gameweeks to look ahead for fixtures */
  DEFAULT_LOOK_AHEAD: 5,
  /** Neutral difficulty when no fixtures found (1-5 scale) */
  NEUTRAL_DIFFICULTY: 3,
  /** Maximum normalized score value */
  MAX_NORMALIZED_SCORE: 10,
  /** Difficulty range for normalization (5-1 = 4) */
  DIFFICULTY_RANGE: 4,
} as const;

export interface TransferRecommendation {
  player: EnrichedPlayer;
  score: number;
  formScore: number;
  fixtureScore: number;
  valueScore: number;
  xgiScore: number;
  upcomingDifficulty: number;
}

/**
 * Calculate average fixture difficulty for a player's team over the next N gameweeks.
 * Returns 1-5 scale (lower = easier).
 */
function getUpcomingFixtureDifficulty(
  teamId: number,
  fixtures: Fixture[],
  gwStart: number,
  gwCount: number,
): number {
  const gwEnd = gwStart + gwCount - 1;
  const relevant = fixtures.filter(
    (f) =>
      f.event !== null &&
      f.event >= gwStart &&
      f.event <= gwEnd &&
      (f.team_h === teamId || f.team_a === teamId),
  );

  if (relevant.length === 0) return TRANSFER_CONFIG.NEUTRAL_DIFFICULTY;

  const totalDifficulty = relevant.reduce((sum, f) => {
    if (f.team_h === teamId) return sum + f.team_h_difficulty;
    return sum + f.team_a_difficulty;
  }, 0);

  return totalDifficulty / relevant.length;
}

/**
 * Score all enriched players and return ranked transfer recommendations.
 * Higher score = better transfer target.
 *
 * Model weights:
 *   - Form (30%): recent points per match
 *   - Fixture difficulty (25%): easier upcoming fixtures = higher score
 *   - Value (25%): points per million
 *   - xGI (20%): expected goals + assists
 */
export function scoreTransferTargets(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  nextGwId: number,
  lookAhead: number = TRANSFER_CONFIG.DEFAULT_LOOK_AHEAD,
): TransferRecommendation[] {
  // Normalise ranges for consistent scoring
  const maxForm = Math.max(...players.map((p) => getPlayerForm(p)), 1);
  const maxValue = Math.max(...players.map((p) => getPlayerValueScore(p)), 1);
  const maxXGI = Math.max(...players.map((p) => getPlayerXGI(p)), 0.1);

  return players
    .filter((p) => p.minutes > 0) // must have played
    .map((player) => {
      const form = getPlayerForm(player);
      const value = getPlayerValueScore(player);
      const xgi = getPlayerXGI(player);
      const avgDifficulty = getUpcomingFixtureDifficulty(
        player.team,
        fixtures,
        nextGwId,
        lookAhead,
      );

      // Normalise 0-10
      const formScore = (form / maxForm) * TRANSFER_CONFIG.MAX_NORMALIZED_SCORE;
      // Invert difficulty: easy (1) = high score, hard (5) = low score
      const fixtureScore =
        ((5 - avgDifficulty) / TRANSFER_CONFIG.DIFFICULTY_RANGE) *
        TRANSFER_CONFIG.MAX_NORMALIZED_SCORE;
      const valueScore =
        (value / maxValue) * TRANSFER_CONFIG.MAX_NORMALIZED_SCORE;
      const xgiScore = (xgi / maxXGI) * TRANSFER_CONFIG.MAX_NORMALIZED_SCORE;

      const score =
        formScore * TRANSFER_WEIGHTS.FORM +
        fixtureScore * TRANSFER_WEIGHTS.FIXTURE +
        valueScore * TRANSFER_WEIGHTS.VALUE +
        xgiScore * TRANSFER_WEIGHTS.XGI;

      return {
        player,
        score,
        formScore,
        fixtureScore,
        valueScore,
        xgiScore,
        upcomingDifficulty: avgDifficulty,
      };
    })
    .sort((a, b) => b.score - a.score);
}
