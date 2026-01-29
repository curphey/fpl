import type { Fixture } from "./types";
import type { EnrichedPlayer } from "./utils";
import { getPlayerForm, getPlayerPointsPerGame } from "./utils";

export interface PointsPrediction {
  player: EnrichedPlayer;
  predictedPoints: number;
  confidence: "high" | "medium" | "low";
  breakdown: {
    base: number;
    formAdj: number;
    fixtureAdj: number;
    homeAdj: number;
    minutesProb: number;
  };
}

/**
 * Estimate a player's probability of playing based on minutes history.
 * Returns 0-1.
 */
function getMinutesProbability(player: EnrichedPlayer): number {
  if (player.status !== "a") return player.status === "d" ? 0.25 : 0;
  if (player.minutes === 0) return 0.1;
  const starts = player.starts;
  // finished GWs so far — approximate from total minutes
  const gamesAvailable = Math.max(
    Math.ceil(player.minutes / 90) + 2,
    starts + 3,
  );
  const startRate = Math.min(starts / Math.max(gamesAvailable, 1), 1);
  return Math.max(startRate, 0.1);
}

/**
 * Get the upcoming fixture difficulty for a player in a specific GW.
 * Returns { difficulty: 1-5, isHome: boolean } or null if blank.
 */
function getPlayerFixture(
  player: EnrichedPlayer,
  fixtures: Fixture[],
  gwId: number,
): { difficulty: number; isHome: boolean } | null {
  const match = fixtures.find(
    (f) =>
      f.event === gwId &&
      (f.team_h === player.team || f.team_a === player.team),
  );
  if (!match) return null;
  if (match.team_h === player.team) {
    return { difficulty: match.team_h_difficulty, isHome: true };
  }
  return { difficulty: match.team_a_difficulty, isHome: false };
}

/**
 * Predict expected points for all players in a given gameweek.
 *
 * Model:
 *   base        = PPG (historical average)
 *   formAdj     = (form - ppg) * 0.4  — recent form deviation
 *   fixtureAdj  = (3 - difficulty) * 0.5 — easier fixture = bonus
 *   homeAdj     = +0.3 if home
 *   final       = (base + formAdj + fixtureAdj + homeAdj) * minutesProb
 *
 * Confidence:
 *   high   = started 70%+ of matches, form > 3
 *   medium = started 40%+
 *   low    = everything else
 */
export function predictPoints(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  gwId: number,
): PointsPrediction[] {
  return players
    .map((player) => {
      const ppg = getPlayerPointsPerGame(player);
      const form = getPlayerForm(player);
      const minutesProb = getMinutesProbability(player);
      const fix = getPlayerFixture(player, fixtures, gwId);

      const base = ppg;
      const formAdj = (form - ppg) * 0.4;
      const fixtureAdj = fix ? (3 - fix.difficulty) * 0.5 : 0;
      const homeAdj = fix?.isHome ? 0.3 : 0;

      const raw = base + formAdj + fixtureAdj + homeAdj;
      const predictedPoints = Math.max(
        Math.round(raw * minutesProb * 10) / 10,
        0,
      );

      // Confidence based on sample size and form stability
      const startRate = player.starts / Math.max(player.minutes / 90, 1);
      let confidence: "high" | "medium" | "low" = "low";
      if (startRate > 0.7 && form > 3 && player.minutes > 270) {
        confidence = "high";
      } else if (startRate > 0.4 && player.minutes > 90) {
        confidence = "medium";
      }

      return {
        player,
        predictedPoints,
        confidence,
        breakdown: {
          base: Math.round(base * 10) / 10,
          formAdj: Math.round(formAdj * 10) / 10,
          fixtureAdj: Math.round(fixtureAdj * 10) / 10,
          homeAdj: Math.round(homeAdj * 10) / 10,
          minutesProb: Math.round(minutesProb * 100) / 100,
        },
      };
    })
    .sort((a, b) => b.predictedPoints - a.predictedPoints);
}
