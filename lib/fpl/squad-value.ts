import type { Player, Pick, ManagerHistoryCurrent } from "./types";

export interface PlayerValue {
  playerId: number;
  name: string;
  teamShort: string;
  position: number;
  currentPrice: number;
  purchasePrice: number; // Estimated based on value changes
  sellingPrice: number;
  profit: number;
  lockedProfit: number; // Profit that can't be realized
}

export interface SquadValueSummary {
  totalValue: number;
  bank: number;
  totalSquadValue: number; // value - bank (just players)
  startValue: number;
  valueGained: number;
  totalLockedProfit: number;
  playerValues: PlayerValue[];
}

export interface ValueHistoryPoint {
  gw: number;
  value: number;
  bank: number;
  rank: number;
}

/**
 * Calculate squad value details for each player.
 * Note: FPL API doesn't provide exact purchase prices, so we estimate.
 */
export function calculateSquadValue(
  picks: Pick[],
  players: Player[],
  teams: { id: number; short_name: string }[],
  entryHistory: ManagerHistoryCurrent,
): SquadValueSummary {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const teamMap = new Map(teams.map((t) => [t.id, t.short_name]));

  const playerValues: PlayerValue[] = [];
  let totalSquadValue = 0;
  let totalLockedProfit = 0;

  for (const pick of picks) {
    const player = playerMap.get(pick.element);
    if (!player) continue;

    const currentPrice = player.now_cost / 10;

    // Selling price is calculated as: purchase_price + floor((current - purchase) / 2)
    // Since we don't have exact purchase price, estimate from season start price
    const startPrice = (player.now_cost - player.cost_change_start) / 10;

    // Estimate purchase price as the start price (simplified)
    // In reality, this would come from transfer history
    const purchasePrice = startPrice;

    const priceChange = currentPrice - purchasePrice;

    // Calculate selling price (you only get half the profit)
    let sellingPrice: number;
    if (priceChange > 0) {
      sellingPrice = purchasePrice + Math.floor(priceChange * 10) / 20;
    } else {
      sellingPrice = currentPrice; // Full loss on price drops
    }

    const profit = currentPrice - purchasePrice;
    const lockedProfit =
      priceChange > 0 ? profit - (sellingPrice - purchasePrice) : 0;

    playerValues.push({
      playerId: player.id,
      name: player.web_name,
      teamShort: teamMap.get(player.team) ?? "???",
      position: player.element_type,
      currentPrice,
      purchasePrice,
      sellingPrice,
      profit,
      lockedProfit,
    });

    totalSquadValue += currentPrice;
    totalLockedProfit += lockedProfit;
  }

  // Sort by profit descending
  playerValues.sort((a, b) => b.profit - a.profit);

  const bank = entryHistory.bank / 10;
  const totalValue = entryHistory.value / 10;
  const startValue = 100; // Standard starting value

  return {
    totalValue,
    bank,
    totalSquadValue,
    startValue,
    valueGained: totalValue - startValue,
    totalLockedProfit,
    playerValues,
  };
}

/**
 * Build value history from manager history data.
 */
export function buildValueHistory(
  historyData: ManagerHistoryCurrent[],
): ValueHistoryPoint[] {
  return historyData.map((h) => ({
    gw: h.event,
    value: h.value / 10,
    bank: h.bank / 10,
    rank: h.overall_rank,
  }));
}
