import type { EnrichedPlayer } from "./utils";

/**
 * Ownership momentum data for a player
 */
export interface OwnershipMomentum {
  player: EnrichedPlayer;
  /** Net transfers this gameweek (in - out) */
  netTransfers: number;
  /** Total transfers this gameweek (in + out) */
  totalTransfers: number;
  /** Momentum score: (in - out) / total, range -1 to 1 */
  momentumScore: number;
  /** Percentage ownership change estimate */
  ownershipChangePercent: number;
  /** Trend classification */
  trend: "rising" | "falling" | "stable";
  /** Whether this is a significant change (>5% threshold) */
  isSignificant: boolean;
  /** Whether this player is a potential differential (<10% owned) */
  isDifferential: boolean;
  /** Risk level for owned players */
  riskLevel: "high" | "medium" | "low" | "none";
}

/**
 * Categorized momentum results
 */
export interface MomentumAnalysis {
  /** Players with strong positive momentum */
  risingStars: OwnershipMomentum[];
  /** Players with strong negative momentum */
  fallingAssets: OwnershipMomentum[];
  /** Differentials gaining traction */
  emergingDifferentials: OwnershipMomentum[];
  /** High-owned players losing favor */
  templateExits: OwnershipMomentum[];
  /** Summary statistics */
  stats: {
    totalPlayersAnalyzed: number;
    averageMomentum: number;
    highestMomentum: OwnershipMomentum | null;
    lowestMomentum: OwnershipMomentum | null;
  };
}

/**
 * Thresholds for momentum classification
 */
const THRESHOLDS = {
  /** Minimum ownership to be considered (filter noise) */
  MIN_OWNERSHIP: 0.1,
  /** Minimum transfers to consider (filter inactive players) */
  MIN_TRANSFERS: 1000,
  /** Momentum score threshold for "significant" change */
  SIGNIFICANT_MOMENTUM: 0.3,
  /** Ownership threshold for "differential" status */
  DIFFERENTIAL_OWNERSHIP: 10,
  /** Ownership threshold for "template" player */
  TEMPLATE_OWNERSHIP: 25,
  /** High momentum threshold */
  HIGH_MOMENTUM: 0.5,
  /** Medium momentum threshold */
  MEDIUM_MOMENTUM: 0.2,
};

/**
 * Calculate ownership momentum for a single player
 */
export function calculatePlayerMomentum(
  player: EnrichedPlayer,
): OwnershipMomentum | null {
  const ownership = parseFloat(player.selected_by_percent) || 0;

  // Filter out very low ownership players (noise)
  if (ownership < THRESHOLDS.MIN_OWNERSHIP) {
    return null;
  }

  const transfersIn = player.transfers_in_event;
  const transfersOut = player.transfers_out_event;
  const netTransfers = transfersIn - transfersOut;
  const totalTransfers = transfersIn + transfersOut;

  // Filter out players with minimal transfer activity
  if (totalTransfers < THRESHOLDS.MIN_TRANSFERS) {
    return null;
  }

  // Calculate momentum score (-1 to 1)
  const momentumScore = totalTransfers > 0 ? netTransfers / totalTransfers : 0;

  // Estimate ownership change percentage
  // Rough estimate: assume ~10M active managers
  const estimatedManagers = 10_000_000;
  const ownershipChangePercent = (netTransfers / estimatedManagers) * 100;

  // Classify trend
  let trend: "rising" | "falling" | "stable" = "stable";
  if (momentumScore > THRESHOLDS.MEDIUM_MOMENTUM) {
    trend = "rising";
  } else if (momentumScore < -THRESHOLDS.MEDIUM_MOMENTUM) {
    trend = "falling";
  }

  // Check significance
  const isSignificant =
    Math.abs(momentumScore) >= THRESHOLDS.SIGNIFICANT_MOMENTUM;

  // Check differential status
  const isDifferential = ownership < THRESHOLDS.DIFFERENTIAL_OWNERSHIP;

  // Calculate risk level (for falling players)
  let riskLevel: "high" | "medium" | "low" | "none" = "none";
  if (momentumScore < 0) {
    if (momentumScore < -THRESHOLDS.HIGH_MOMENTUM) {
      riskLevel = "high";
    } else if (momentumScore < -THRESHOLDS.MEDIUM_MOMENTUM) {
      riskLevel = "medium";
    } else if (momentumScore < -0.1) {
      riskLevel = "low";
    }
  }

  return {
    player,
    netTransfers,
    totalTransfers,
    momentumScore,
    ownershipChangePercent,
    trend,
    isSignificant,
    isDifferential,
    riskLevel,
  };
}

/**
 * Analyze ownership momentum for all players
 */
export function analyzeOwnershipMomentum(
  players: EnrichedPlayer[],
): MomentumAnalysis {
  const momentumData: OwnershipMomentum[] = [];

  // Calculate momentum for all players
  for (const player of players) {
    const momentum = calculatePlayerMomentum(player);
    if (momentum) {
      momentumData.push(momentum);
    }
  }

  // Sort by momentum score
  const sortedByMomentum = [...momentumData].sort(
    (a, b) => b.momentumScore - a.momentumScore,
  );

  // Rising stars: top momentum, any ownership
  const risingStars = sortedByMomentum
    .filter((m) => m.trend === "rising")
    .slice(0, 10);

  // Falling assets: lowest momentum, any ownership
  const fallingAssets = sortedByMomentum
    .filter((m) => m.trend === "falling")
    .slice(-10)
    .reverse();

  // Emerging differentials: rising momentum + low ownership
  const emergingDifferentials = sortedByMomentum
    .filter((m) => m.trend === "rising" && m.isDifferential)
    .slice(0, 10);

  // Template exits: falling momentum + high ownership
  const templateExits = sortedByMomentum
    .filter(
      (m) =>
        m.trend === "falling" &&
        parseFloat(m.player.selected_by_percent) >=
          THRESHOLDS.TEMPLATE_OWNERSHIP,
    )
    .slice(-10)
    .reverse();

  // Calculate stats
  const totalMomentum = momentumData.reduce(
    (sum, m) => sum + m.momentumScore,
    0,
  );
  const averageMomentum =
    momentumData.length > 0 ? totalMomentum / momentumData.length : 0;

  return {
    risingStars,
    fallingAssets,
    emergingDifferentials,
    templateExits,
    stats: {
      totalPlayersAnalyzed: momentumData.length,
      averageMomentum,
      highestMomentum: sortedByMomentum[0] || null,
      lowestMomentum: sortedByMomentum[sortedByMomentum.length - 1] || null,
    },
  };
}

/**
 * Get momentum alerts for a user's squad
 */
export function getSquadMomentumAlerts(
  squad: EnrichedPlayer[],
  allPlayers: EnrichedPlayer[],
): {
  atRisk: OwnershipMomentum[];
  alternatives: OwnershipMomentum[];
} {
  const squadMomentum: OwnershipMomentum[] = [];
  const allMomentum = analyzeOwnershipMomentum(allPlayers);

  // Calculate momentum for squad players
  for (const player of squad) {
    const momentum = calculatePlayerMomentum(player);
    if (momentum) {
      squadMomentum.push(momentum);
    }
  }

  // Find at-risk players in squad (falling momentum)
  const atRisk = squadMomentum
    .filter((m) => m.riskLevel !== "none")
    .sort((a, b) => a.momentumScore - b.momentumScore);

  // Suggest alternatives from rising players in same position
  const alternatives: OwnershipMomentum[] = [];
  for (const risk of atRisk.slice(0, 3)) {
    const samePosition = allMomentum.risingStars.filter(
      (m) =>
        m.player.element_type === risk.player.element_type &&
        m.player.id !== risk.player.id,
    );
    alternatives.push(...samePosition.slice(0, 2));
  }

  return {
    atRisk,
    alternatives: alternatives.slice(0, 5),
  };
}

/**
 * Format momentum score as a percentage string
 */
export function formatMomentumPercent(score: number): string {
  const percent = Math.round(score * 100);
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent}%`;
}

/**
 * Get color class for momentum score
 */
export function getMomentumColorClass(score: number): string {
  if (score >= THRESHOLDS.HIGH_MOMENTUM) return "text-fpl-green";
  if (score >= THRESHOLDS.MEDIUM_MOMENTUM) return "text-green-400";
  if (score <= -THRESHOLDS.HIGH_MOMENTUM) return "text-fpl-danger";
  if (score <= -THRESHOLDS.MEDIUM_MOMENTUM) return "text-orange-400";
  return "text-fpl-muted";
}

/**
 * Get background color class for momentum badge
 */
export function getMomentumBgClass(score: number): string {
  if (score >= THRESHOLDS.HIGH_MOMENTUM) return "bg-fpl-green/20";
  if (score >= THRESHOLDS.MEDIUM_MOMENTUM) return "bg-green-400/20";
  if (score <= -THRESHOLDS.HIGH_MOMENTUM) return "bg-fpl-danger/20";
  if (score <= -THRESHOLDS.MEDIUM_MOMENTUM) return "bg-orange-400/20";
  return "bg-fpl-purple-light";
}
