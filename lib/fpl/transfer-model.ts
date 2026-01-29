import type { Fixture } from "./types";
import type { EnrichedPlayer } from "./utils";
import { getPlayerForm, getPlayerValueScore, getPlayerXGI } from "./utils";

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

  if (relevant.length === 0) return 3; // neutral fallback

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
  lookAhead: number = 5,
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
      const formScore = (form / maxForm) * 10;
      const fixtureScore = ((5 - avgDifficulty) / 4) * 10; // invert: easy=high
      const valueScore = (value / maxValue) * 10;
      const xgiScore = (xgi / maxXGI) * 10;

      const score =
        formScore * 0.3 +
        fixtureScore * 0.25 +
        valueScore * 0.25 +
        xgiScore * 0.2;

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
