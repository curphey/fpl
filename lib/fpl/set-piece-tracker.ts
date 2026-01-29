import type { EnrichedPlayer } from "./utils";

export type SetPieceType = "penalties" | "corners" | "direct_freekicks";

export interface SetPieceTaker {
  player: EnrichedPlayer;
  dutyType: SetPieceType;
  order: number; // 1 = first choice, 2 = second choice, etc.
  text: string;
}

export interface TeamSetPieces {
  teamId: number;
  teamName: string;
  teamShort: string;
  penalties: SetPieceTaker[];
  corners: SetPieceTaker[];
  directFreekicks: SetPieceTaker[];
}

export interface SetPieceAsset {
  player: EnrichedPlayer;
  duties: {
    penalties: number | null;
    corners: number | null;
    directFreekicks: number | null;
  };
  dutyCount: number; // How many set-piece types they're on
  isPrimaryPenalty: boolean;
  isPrimaryCorner: boolean;
  isPrimaryFreekick: boolean;
  estimatedSetPiecePoints: number;
  setPieceValue: number; // 0-100 score
}

/**
 * Get all set-piece takers organized by team.
 */
export function getSetPieceTakersByTeam(
  players: EnrichedPlayer[],
): TeamSetPieces[] {
  const teamMap = new Map<number, TeamSetPieces>();

  // Initialize teams
  for (const player of players) {
    if (!teamMap.has(player.team)) {
      teamMap.set(player.team, {
        teamId: player.team,
        teamName: player.team_name,
        teamShort: player.team_short_name,
        penalties: [],
        corners: [],
        directFreekicks: [],
      });
    }

    const team = teamMap.get(player.team)!;

    // Penalties
    if (player.penalties_order !== null && player.penalties_order > 0) {
      team.penalties.push({
        player,
        dutyType: "penalties",
        order: player.penalties_order,
        text: player.penalties_text || "",
      });
    }

    // Corners and indirect free kicks
    if (
      player.corners_and_indirect_freekicks_order !== null &&
      player.corners_and_indirect_freekicks_order > 0
    ) {
      team.corners.push({
        player,
        dutyType: "corners",
        order: player.corners_and_indirect_freekicks_order,
        text: player.corners_and_indirect_freekicks_text || "",
      });
    }

    // Direct free kicks
    if (
      player.direct_freekicks_order !== null &&
      player.direct_freekicks_order > 0
    ) {
      team.directFreekicks.push({
        player,
        dutyType: "direct_freekicks",
        order: player.direct_freekicks_order,
        text: player.direct_freekicks_text || "",
      });
    }
  }

  // Sort each team's set-piece takers by order
  for (const team of teamMap.values()) {
    team.penalties.sort((a, b) => a.order - b.order);
    team.corners.sort((a, b) => a.order - b.order);
    team.directFreekicks.sort((a, b) => a.order - b.order);
  }

  return Array.from(teamMap.values()).sort((a, b) =>
    a.teamName.localeCompare(b.teamName),
  );
}

/**
 * Calculate set-piece value for each player.
 * Higher scores indicate players with more set-piece involvement.
 */
export function analyzeSetPieceAssets(
  players: EnrichedPlayer[],
): SetPieceAsset[] {
  const assets: SetPieceAsset[] = [];

  for (const player of players) {
    const penOrder = player.penalties_order;
    const cornerOrder = player.corners_and_indirect_freekicks_order;
    const fkOrder = player.direct_freekicks_order;

    // Skip players with no set-piece duties
    if (!penOrder && !cornerOrder && !fkOrder) continue;

    const isPrimaryPenalty = penOrder === 1;
    const isPrimaryCorner = cornerOrder === 1;
    const isPrimaryFreekick = fkOrder === 1;

    // Count how many set-piece types they're on
    let dutyCount = 0;
    if (penOrder) dutyCount++;
    if (cornerOrder) dutyCount++;
    if (fkOrder) dutyCount++;

    // Estimate set-piece contribution to points
    // Penalties: ~5-6 points per penalty scored (goal + bonus typically)
    // Corners: indirect (assists), typically ~3-4 points per assist
    // Direct FKs: can score directly, ~5 points
    let estimatedSetPiecePoints = 0;

    // Base estimates on player's actual assists and goals
    const totalGoals = player.goals_scored;
    const totalAssists = player.assists;

    // Rough estimation: primary penalty takers get ~20% of goals from pens
    // Primary corner takers get ~30% of assists from corners
    // Primary FK takers get ~10% of goals from FKs
    if (isPrimaryPenalty && totalGoals > 0) {
      estimatedSetPiecePoints += Math.round(totalGoals * 0.2 * 5);
    }
    if (isPrimaryCorner && totalAssists > 0) {
      estimatedSetPiecePoints += Math.round(totalAssists * 0.3 * 3);
    }
    if (isPrimaryFreekick && totalGoals > 0) {
      estimatedSetPiecePoints += Math.round(totalGoals * 0.1 * 5);
    }

    // Calculate set-piece value score (0-100)
    let setPieceValue = 0;

    // Primary penalty taker is most valuable
    if (isPrimaryPenalty) setPieceValue += 40;
    else if (penOrder === 2) setPieceValue += 15;

    // Primary corner/FK taker adds value
    if (isPrimaryCorner) setPieceValue += 25;
    else if (cornerOrder === 2) setPieceValue += 10;

    if (isPrimaryFreekick) setPieceValue += 20;
    else if (fkOrder === 2) setPieceValue += 8;

    // Bonus for multiple duties
    if (dutyCount >= 3) setPieceValue += 15;
    else if (dutyCount === 2) setPieceValue += 8;

    // Bonus for being available
    if (player.status === "a") setPieceValue += 5;

    // Bonus for good form (active players more likely to take set pieces)
    const form = parseFloat(player.form) || 0;
    if (form > 5) setPieceValue += 5;

    assets.push({
      player,
      duties: {
        penalties: penOrder,
        corners: cornerOrder,
        directFreekicks: fkOrder,
      },
      dutyCount,
      isPrimaryPenalty,
      isPrimaryCorner,
      isPrimaryFreekick,
      estimatedSetPiecePoints,
      setPieceValue: Math.min(setPieceValue, 100),
    });
  }

  return assets.sort((a, b) => b.setPieceValue - a.setPieceValue);
}

/**
 * Get top set-piece assets across all teams.
 */
export function getTopSetPieceAssets(
  players: EnrichedPlayer[],
  limit = 20,
): SetPieceAsset[] {
  return analyzeSetPieceAssets(players).slice(0, limit);
}

/**
 * Get players who are primary penalty takers.
 */
export function getPrimaryPenaltyTakers(
  players: EnrichedPlayer[],
): EnrichedPlayer[] {
  return players
    .filter((p) => p.penalties_order === 1 && p.status === "a")
    .sort((a, b) => b.total_points - a.total_points);
}

/**
 * Format set-piece duties as a readable string.
 */
export function formatSetPieceDuties(asset: SetPieceAsset): string {
  const duties: string[] = [];

  if (asset.isPrimaryPenalty) {
    duties.push("Pens (1st)");
  } else if (asset.duties.penalties === 2) {
    duties.push("Pens (2nd)");
  }

  if (asset.isPrimaryCorner) {
    duties.push("Corners (1st)");
  } else if (asset.duties.corners === 2) {
    duties.push("Corners (2nd)");
  }

  if (asset.isPrimaryFreekick) {
    duties.push("FKs (1st)");
  } else if (asset.duties.directFreekicks === 2) {
    duties.push("FKs (2nd)");
  }

  return duties.join(", ");
}
