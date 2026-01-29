import type { EnrichedPlayer } from "./utils";
import type { Pick } from "./types";

export interface PriceChangeCandidate {
  player: EnrichedPlayer;
  direction: "rise" | "fall";
  probability: number; // 0-1
  netTransfers: number;
  transferRatio: number;
  costChangeMomentum: number;
}

export interface SquadPriceAlerts {
  fallers: PriceChangeCandidate[];
  atRisk: number;
}

export interface TransferTimingAdvice {
  player: EnrichedPlayer;
  recommendation: "buy_now" | "wait" | "neutral";
  reasoning: string;
  priceRisk: number;
  expectedCost: number;
  urgencyScore: number;
}

/**
 * Predict players most likely to see a price change.
 *
 * Model:
 *   - Transfer balance (in - out) this GW as a ratio of total owners
 *   - Cost change momentum (recent cost_change_event direction)
 *   - Ownership threshold effects
 *
 * FPL uses a more complex model, but net transfer activity relative to
 * ownership is the strongest public signal.
 */
export function predictPriceChanges(players: EnrichedPlayer[]): {
  risers: PriceChangeCandidate[];
  fallers: PriceChangeCandidate[];
} {
  const candidates: PriceChangeCandidate[] = [];

  for (const player of players) {
    // Skip players with very low ownership (noise)
    const ownership = parseFloat(player.selected_by_percent) || 0;
    if (ownership < 0.1) continue;

    const netTransfers = player.transfers_in_event - player.transfers_out_event;
    const totalTransfers =
      player.transfers_in_event + player.transfers_out_event;
    if (totalTransfers === 0) continue;

    // Transfer ratio: net transfers relative to estimated total owners
    // Higher ratio = more likely to trigger price change
    const estimatedOwners = Math.max(ownership * 100000, 1); // rough approximation
    const transferRatio = netTransfers / estimatedOwners;

    // Cost change momentum: if price already moved this GW, more likely to continue
    const costChangeMomentum = player.cost_change_event;

    // Calculate probability heuristic
    const absRatio = Math.abs(transferRatio);
    let probability = Math.min(absRatio * 50, 0.95);

    // Momentum boost: if already changed this event, higher chance of another
    if (
      Math.sign(costChangeMomentum) === Math.sign(netTransfers) &&
      costChangeMomentum !== 0
    ) {
      probability = Math.min(probability * 1.3, 0.95);
    }

    // Only include if meaningful probability
    if (probability < 0.05) continue;

    const direction = netTransfers > 0 ? "rise" : "fall";

    candidates.push({
      player,
      direction,
      probability: Math.round(probability * 100) / 100,
      netTransfers,
      transferRatio: Math.round(transferRatio * 10000) / 10000,
      costChangeMomentum,
    });
  }

  const risers = candidates
    .filter((c) => c.direction === "rise")
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 20);

  const fallers = candidates
    .filter((c) => c.direction === "fall")
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 20);

  return { risers, fallers };
}

/**
 * Get price alerts for players in the manager's squad.
 * Returns players predicted to fall with probability > threshold.
 */
export function getSquadPriceAlerts(
  picks: Pick[],
  priceChanges: {
    risers: PriceChangeCandidate[];
    fallers: PriceChangeCandidate[];
  },
  threshold = 0.3,
): SquadPriceAlerts {
  const pickElementIds = new Set(picks.map((p) => p.element));

  const squadFallers = priceChanges.fallers.filter(
    (c) => pickElementIds.has(c.player.id) && c.probability >= threshold,
  );

  return {
    fallers: squadFallers,
    atRisk: squadFallers.length,
  };
}

/**
 * Calculate transfer timing advice for a price change candidate.
 * Helps decide whether to buy now or wait based on price change probability.
 */
export function calculateTransferTiming(
  candidate: PriceChangeCandidate,
): TransferTimingAdvice {
  const { player, direction, probability, netTransfers, costChangeMomentum } =
    candidate;
  const currentPrice = player.now_cost / 10;

  let recommendation: "buy_now" | "wait" | "neutral";
  let reasoning: string;
  let urgencyScore: number;
  let expectedCost = currentPrice;

  if (direction === "rise") {
    if (probability >= 0.5) {
      recommendation = "buy_now";
      reasoning = `High probability (${Math.round(probability * 100)}%) of price rise. Transfer in before price increases.`;
      urgencyScore = Math.min(Math.round(probability * 100), 95);
      expectedCost = currentPrice + 0.1;
    } else if (probability >= 0.3) {
      recommendation = "neutral";
      reasoning = `Moderate chance (${Math.round(probability * 100)}%) of price rise. Monitor closely.`;
      urgencyScore = Math.round(probability * 60);
    } else {
      recommendation = "wait";
      reasoning = `Low probability (${Math.round(probability * 100)}%) of immediate price change. Safe to wait.`;
      urgencyScore = Math.round(probability * 30);
    }
  } else {
    // Player is falling in price
    if (probability >= 0.5) {
      recommendation = "wait";
      reasoning = `High probability (${Math.round(probability * 100)}%) of price drop. Wait for cheaper price.`;
      urgencyScore = 0;
      expectedCost = currentPrice - 0.1;
    } else if (probability >= 0.3) {
      recommendation = "neutral";
      reasoning = `Moderate chance (${Math.round(probability * 100)}%) of price drop. Could wait for discount.`;
      urgencyScore = 20;
    } else {
      recommendation = "neutral";
      reasoning = `Low probability (${Math.round(probability * 100)}%) of price drop. Price likely stable.`;
      urgencyScore = 30;
    }
  }

  // Boost urgency if momentum already started
  if (
    costChangeMomentum !== 0 &&
    Math.sign(costChangeMomentum) === (direction === "rise" ? 1 : -1)
  ) {
    urgencyScore = Math.min(urgencyScore + 15, 95);
    reasoning += " Price already moved this GW.";
  }

  // Boost urgency for very high transfer volume
  if (Math.abs(netTransfers) > 100000) {
    urgencyScore = Math.min(urgencyScore + 10, 95);
  }

  return {
    player,
    recommendation,
    reasoning,
    priceRisk: probability,
    expectedCost,
    urgencyScore,
  };
}
