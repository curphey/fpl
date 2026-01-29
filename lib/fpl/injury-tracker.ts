import type { EnrichedPlayer } from "./utils";
import type { Fixture } from "./types";

export interface ReturningPlayer {
  player: EnrichedPlayer;
  status: "available" | "returning_soon";
  chanceOfPlaying: number | null;
  ownershipPercent: number;
  priceChange: number; // Price change from season start
  preInjuryForm: number; // Estimated form before injury
  upcomingFdr: number; // Average FDR of next 3 fixtures
  valueRating: number; // 0-100 composite score
  reasoning: string[];
}

/**
 * Find players who are returning from injury or are close to returning.
 * These players may be undervalued due to ownership drops during absence.
 */
export function findReturningPlayers(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  currentGwId: number,
): ReturningPlayer[] {
  const returning: ReturningPlayer[] = [];

  for (const player of players) {
    // Skip players with no significant ownership history
    const ownership = parseFloat(player.selected_by_percent) || 0;

    // Look for players who:
    // 1. Were injured but are now available
    // 2. Are doubtful but have high chance of playing
    // 3. Have news indicating return
    const isAvailable = player.status === "a";
    const isReturning =
      player.status === "d" &&
      player.chance_of_playing_next_round !== null &&
      player.chance_of_playing_next_round >= 50;

    // Check for injury-related news
    const hasReturnNews =
      player.news &&
      (player.news.toLowerCase().includes("return") ||
        player.news.toLowerCase().includes("back in training") ||
        player.news.toLowerCase().includes("resumed") ||
        player.news.toLowerCase().includes("available"));

    // Price drop from start indicates they've been out
    const priceChange = player.cost_change_start / 10;
    const hasPriceDrop = priceChange < -0.1;

    // Low recent form but good historical stats suggests injury absence
    const currentForm = parseFloat(player.form) || 0;
    const ppg = parseFloat(player.points_per_game) || 0;
    const wasGoodPlayer = ppg > 4 || player.total_points > 50;
    const lowCurrentForm = currentForm < 3;

    // Estimate pre-injury form based on PPG and total points
    const gamesPlayed =
      player.minutes > 0 ? Math.floor(player.minutes / 90) : 0;
    const estimatedPreInjuryForm =
      gamesPlayed > 0 ? player.total_points / Math.max(gamesPlayed, 1) : ppg;

    // Calculate upcoming FDR
    const playerFixtures = fixtures
      .filter(
        (f) =>
          f.event !== null &&
          f.event >= currentGwId &&
          f.event <= currentGwId + 3 &&
          (f.team_h === player.team || f.team_a === player.team),
      )
      .slice(0, 3);

    const upcomingFdr =
      playerFixtures.length > 0
        ? playerFixtures.reduce((sum, f) => {
            const isHome = f.team_h === player.team;
            return sum + (isHome ? f.team_h_difficulty : f.team_a_difficulty);
          }, 0) / playerFixtures.length
        : 3;

    // Determine if this is a returning player worth highlighting
    const isReturningPlayer =
      (isAvailable || isReturning) &&
      wasGoodPlayer &&
      (hasPriceDrop || hasReturnNews || (lowCurrentForm && ppg > 5));

    if (!isReturningPlayer) continue;

    // Calculate value rating
    const reasoning: string[] = [];
    let valueRating = 30; // Base score

    // Ownership opportunity
    if (ownership < 10 && ppg > 5) {
      valueRating += 20;
      reasoning.push(
        `Low ownership (${ownership.toFixed(1)}%) for quality player`,
      );
    } else if (ownership < 20 && ppg > 4) {
      valueRating += 10;
      reasoning.push(`Moderate ownership (${ownership.toFixed(1)}%)`);
    }

    // Price value
    if (priceChange < -0.3) {
      valueRating += 15;
      reasoning.push(
        `Price dropped £${Math.abs(priceChange).toFixed(1)}m during absence`,
      );
    } else if (priceChange < -0.1) {
      valueRating += 8;
      reasoning.push(`Price down £${Math.abs(priceChange).toFixed(1)}m`);
    }

    // Pre-injury form
    if (estimatedPreInjuryForm > 6) {
      valueRating += 15;
      reasoning.push(
        `Strong pre-injury form (${estimatedPreInjuryForm.toFixed(1)} pts/game)`,
      );
    } else if (estimatedPreInjuryForm > 4.5) {
      valueRating += 8;
      reasoning.push(
        `Decent pre-injury form (${estimatedPreInjuryForm.toFixed(1)} pts/game)`,
      );
    }

    // Upcoming fixtures
    if (upcomingFdr <= 2.5) {
      valueRating += 15;
      reasoning.push(`Easy upcoming fixtures (FDR ${upcomingFdr.toFixed(1)})`);
    } else if (upcomingFdr <= 3) {
      valueRating += 8;
      reasoning.push(`Favorable fixtures (FDR ${upcomingFdr.toFixed(1)})`);
    }

    // Premium player bonus
    if (player.now_cost >= 100) {
      valueRating += 5;
      reasoning.push("Premium asset");
    }

    // Return status
    if (isAvailable) {
      valueRating += 10;
      reasoning.push("Available to play");
    } else if (isReturning) {
      reasoning.push(
        `${player.chance_of_playing_next_round}% chance of playing`,
      );
    }

    if (hasReturnNews && player.news) {
      reasoning.push(`News: "${player.news.slice(0, 60)}..."`);
    }

    returning.push({
      player,
      status: isAvailable ? "available" : "returning_soon",
      chanceOfPlaying: player.chance_of_playing_next_round,
      ownershipPercent: ownership,
      priceChange,
      preInjuryForm: estimatedPreInjuryForm,
      upcomingFdr,
      valueRating: Math.min(valueRating, 100),
      reasoning,
    });
  }

  return returning.sort((a, b) => b.valueRating - a.valueRating).slice(0, 15);
}

/**
 * Get players currently injured who are worth monitoring.
 * These are high-value players to watch for return.
 */
export function getInjuryWatchlist(
  players: EnrichedPlayer[],
): EnrichedPlayer[] {
  return players
    .filter((p) => {
      const isInjured =
        p.status === "i" || p.status === "s" || p.status === "u";
      const isHighValue = p.now_cost >= 70 || parseFloat(p.points_per_game) > 4;
      return isInjured && isHighValue;
    })
    .sort((a, b) => b.now_cost - a.now_cost)
    .slice(0, 10);
}
