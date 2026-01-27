import type { EnrichedPlayer } from './utils';

export interface PriceChangeCandidate {
  player: EnrichedPlayer;
  direction: 'rise' | 'fall';
  probability: number; // 0-1
  netTransfers: number;
  transferRatio: number;
  costChangeMomentum: number;
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
export function predictPriceChanges(
  players: EnrichedPlayer[],
): { risers: PriceChangeCandidate[]; fallers: PriceChangeCandidate[] } {
  const candidates: PriceChangeCandidate[] = [];

  for (const player of players) {
    // Skip players with very low ownership (noise)
    const ownership = parseFloat(player.selected_by_percent) || 0;
    if (ownership < 0.1) continue;

    const netTransfers = player.transfers_in_event - player.transfers_out_event;
    const totalTransfers = player.transfers_in_event + player.transfers_out_event;
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
    if (Math.sign(costChangeMomentum) === Math.sign(netTransfers) && costChangeMomentum !== 0) {
      probability = Math.min(probability * 1.3, 0.95);
    }

    // Only include if meaningful probability
    if (probability < 0.05) continue;

    const direction = netTransfers > 0 ? 'rise' : 'fall';

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
    .filter((c) => c.direction === 'rise')
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 20);

  const fallers = candidates
    .filter((c) => c.direction === 'fall')
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 20);

  return { risers, fallers };
}
