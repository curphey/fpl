import type { ManagerChip, ManagerHistoryCurrent, Gameweek } from "./types";

export interface ChipPerformance {
  chipName: string;
  chipLabel: string;
  gwPlayed: number;
  pointsScored: number;
  leagueAvgChipPoints: number | null; // Avg points for chip that GW (from GW chip_plays)
  pointsAboveAvg: number | null;
  benchPointsThatGw: number; // For bench boost comparison
  typicalGwPoints: number; // User's average GW points
  pointsGained: number; // Points above typical
  verdict: "excellent" | "good" | "average" | "poor";
  reasoning: string;
}

export interface MissedOpportunity {
  chipName: string;
  chipLabel: string;
  gwNumber: number;
  potentialPoints: number;
  description: string;
}

export interface ChipHistoryAnalysis {
  usedChips: ChipPerformance[];
  unusedChips: string[];
  totalChipROI: number; // Total points gained from chips above typical
  bestChip: ChipPerformance | null;
  worstChip: ChipPerformance | null;
  missedOpportunities: MissedOpportunity[];
  summary: string;
}

const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  "3xc": "Triple Captain",
  bboost: "Bench Boost",
};

const ALL_CHIPS = ["wildcard", "freehit", "3xc", "bboost"];

/**
 * Analyze how a user's chip plays performed.
 */
export function analyzeChipHistory(
  userChips: ManagerChip[],
  userHistory: ManagerHistoryCurrent[],
  events: Gameweek[],
): ChipHistoryAnalysis {
  const performances: ChipPerformance[] = [];

  // Calculate user's average GW points
  const totalHistoryPoints = userHistory.reduce((s, h) => s + h.points, 0);
  const avgGwPoints =
    userHistory.length > 0 ? totalHistoryPoints / userHistory.length : 50;

  for (const chip of userChips) {
    const gwHistory = userHistory.find((h) => h.event === chip.event);
    const gwEvent = events.find((e) => e.id === chip.event);

    if (!gwHistory) continue;

    const pointsScored = gwHistory.points;
    const benchPoints = gwHistory.points_on_bench;

    // Get league average for this chip that GW
    let leagueAvgChipPoints: number | null = null;
    let pointsAboveAvg: number | null = null;

    if (gwEvent?.chip_plays && gwEvent.average_entry_score) {
      // FPL doesn't give us avg points per chip, so we'll use the GW average as proxy
      // Estimate: chip users typically score ~20% above GW average for TC/BB
      const chipMultiplier =
        chip.name === "3xc" || chip.name === "bboost" ? 1.15 : 1.0;
      leagueAvgChipPoints = Math.round(
        gwEvent.average_entry_score * chipMultiplier,
      );
      pointsAboveAvg = pointsScored - leagueAvgChipPoints;
    }

    const pointsGained = pointsScored - avgGwPoints;

    // Determine verdict
    let verdict: ChipPerformance["verdict"] = "average";
    let reasoning = "";

    if (chip.name === "3xc") {
      // TC: captain points were tripled, so ~15+ points above avg is good
      if (pointsGained >= 25) {
        verdict = "excellent";
        reasoning = "Outstanding TC play with huge captain haul";
      } else if (pointsGained >= 10) {
        verdict = "good";
        reasoning = "Solid TC choice with above-average return";
      } else if (pointsGained >= 0) {
        verdict = "average";
        reasoning = "TC returned slightly above your average";
      } else {
        verdict = "poor";
        reasoning = "TC failed to deliver meaningful points boost";
      }
    } else if (chip.name === "bboost") {
      // BB: bench points added, so check bench contribution
      if (benchPoints >= 15) {
        verdict = "excellent";
        reasoning = `Bench contributed ${benchPoints} pts - excellent BB timing`;
      } else if (benchPoints >= 10) {
        verdict = "good";
        reasoning = `Bench contributed ${benchPoints} pts - good BB return`;
      } else if (benchPoints >= 5) {
        verdict = "average";
        reasoning = `Bench contributed ${benchPoints} pts - modest BB return`;
      } else {
        verdict = "poor";
        reasoning = `Bench only contributed ${benchPoints} pts - poor BB timing`;
      }
    } else if (chip.name === "freehit") {
      // FH: compare to average
      if (pointsGained >= 30) {
        verdict = "excellent";
        reasoning = "Free Hit significantly outperformed your average";
      } else if (pointsGained >= 15) {
        verdict = "good";
        reasoning = "Solid Free Hit with good squad selection";
      } else if (pointsGained >= 0) {
        verdict = "average";
        reasoning = "Free Hit performed around your average";
      } else {
        verdict = "poor";
        reasoning = "Free Hit underperformed your typical GW";
      }
    } else if (chip.name === "wildcard") {
      // WC: hard to judge individual GW, more about long-term
      verdict = "average";
      reasoning = "Wildcard impact is measured over following weeks";
    }

    performances.push({
      chipName: chip.name,
      chipLabel: CHIP_LABELS[chip.name] ?? chip.name,
      gwPlayed: chip.event,
      pointsScored,
      leagueAvgChipPoints,
      pointsAboveAvg,
      benchPointsThatGw: benchPoints,
      typicalGwPoints: Math.round(avgGwPoints),
      pointsGained: Math.round(pointsGained),
      verdict,
      reasoning,
    });
  }

  // Find unused chips
  const usedChipNames = new Set(userChips.map((c) => c.name));
  const unusedChips = ALL_CHIPS.filter((c) => !usedChipNames.has(c));

  // Calculate total ROI
  const totalChipROI = performances.reduce((s, p) => s + p.pointsGained, 0);

  // Find best and worst
  const scorableChips = performances.filter((p) => p.chipName !== "wildcard");
  const bestChip =
    scorableChips.length > 0
      ? scorableChips.reduce((best, curr) =>
          curr.pointsGained > best.pointsGained ? curr : best,
        )
      : null;
  const worstChip =
    scorableChips.length > 0
      ? scorableChips.reduce((worst, curr) =>
          curr.pointsGained < worst.pointsGained ? curr : worst,
        )
      : null;

  // Find missed opportunities (highest scoring GWs where unused chips could've helped)
  const missedOpportunities: MissedOpportunity[] = [];

  // Find best bench points GW if BB unused
  if (unusedChips.includes("bboost")) {
    const sortedByBench = [...userHistory].sort(
      (a, b) => b.points_on_bench - a.points_on_bench,
    );
    const bestBenchGw = sortedByBench[0];
    if (bestBenchGw && bestBenchGw.points_on_bench >= 12) {
      missedOpportunities.push({
        chipName: "bboost",
        chipLabel: "Bench Boost",
        gwNumber: bestBenchGw.event,
        potentialPoints: bestBenchGw.points_on_bench,
        description: `Bench scored ${bestBenchGw.points_on_bench} pts in GW${bestBenchGw.event}`,
      });
    }
  }

  // Find highest scoring GW if TC unused
  if (unusedChips.includes("3xc")) {
    const sortedByPoints = [...userHistory].sort((a, b) => b.points - a.points);
    const bestGw = sortedByPoints[0];
    if (bestGw && bestGw.points >= avgGwPoints + 20) {
      missedOpportunities.push({
        chipName: "3xc",
        chipLabel: "Triple Captain",
        gwNumber: bestGw.event,
        potentialPoints: Math.round(bestGw.points - avgGwPoints),
        description: `GW${bestGw.event} scored ${bestGw.points} pts (+${Math.round(bestGw.points - avgGwPoints)} above avg)`,
      });
    }
  }

  // Generate summary
  let summary = "";
  if (performances.length === 0) {
    summary = "No chips used yet this season";
  } else if (totalChipROI >= 40) {
    summary = `Excellent chip usage this season (+${totalChipROI} pts above average)`;
  } else if (totalChipROI >= 15) {
    summary = `Good chip timing with +${totalChipROI} pts gained`;
  } else if (totalChipROI >= 0) {
    summary = "Chips performed close to your average";
  } else {
    summary = `Chip timing could be improved (${totalChipROI} pts below average)`;
  }

  return {
    usedChips: performances,
    unusedChips,
    totalChipROI,
    bestChip,
    worstChip,
    missedOpportunities,
    summary,
  };
}
