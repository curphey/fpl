import type { ManagerHistory, Fixture, Gameweek, Team } from "./types";
import type { EnrichedPlayer } from "./utils";

/**
 * Bench boost timing recommendation
 */
export interface BenchBoostRecommendation {
  /** Recommended gameweek */
  gameweek: number;
  /** Score (higher = better opportunity) */
  score: number;
  /** Reasoning for recommendation */
  reasons: string[];
  /** Fixture difficulty rating for bench players */
  avgBenchFDR: number;
  /** Is this a double gameweek? */
  isDGW: boolean;
  /** Confidence level */
  confidence: "high" | "medium" | "low";
}

/**
 * Historical bench performance analysis
 */
export interface BenchPerformanceHistory {
  /** Gameweek number */
  gameweek: number;
  /** Points scored on bench */
  pointsOnBench: number;
  /** Was bench boost used this week? */
  benchBoostUsed: boolean;
  /** Opportunity cost if bench boost wasn't used */
  missedOpportunity: boolean;
}

/**
 * Bench boost analysis result
 */
export interface BenchBoostAnalysis {
  /** Historical performance data */
  history: BenchPerformanceHistory[];
  /** Total points left on bench this season */
  totalBenchPoints: number;
  /** Average bench points per gameweek */
  avgBenchPoints: number;
  /** Best gameweek for bench boost (historically) */
  bestHistoricalGW: BenchPerformanceHistory | null;
  /** Has bench boost been used? */
  benchBoostUsed: boolean;
  /** Gameweek when bench boost was used */
  benchBoostGW: number | null;
  /** Points gained from bench boost (if used) */
  benchBoostReturn: number | null;
  /** Missed opportunity score */
  missedOpportunityScore: number;
  /** Recommendations for future use */
  recommendations: BenchBoostRecommendation[];
}

/**
 * Analyze manager's bench performance history
 */
export function analyzeBenchHistory(
  managerHistory: ManagerHistory,
): Omit<BenchBoostAnalysis, "recommendations"> {
  const history: BenchPerformanceHistory[] = [];
  let totalBenchPoints = 0;
  let benchBoostGW: number | null = null;
  let benchBoostReturn: number | null = null;

  // Check if bench boost was used
  const benchBoostChip = managerHistory.chips.find(
    (c) => c.name === "bboost" || c.name === "bench_boost",
  );
  const benchBoostUsed = !!benchBoostChip;
  if (benchBoostChip) {
    benchBoostGW = benchBoostChip.event;
  }

  // Analyze each gameweek
  for (const gw of managerHistory.current) {
    const isBenchBoostGW = gw.event === benchBoostGW;
    const pointsOnBench = isBenchBoostGW ? 0 : gw.points_on_bench;

    history.push({
      gameweek: gw.event,
      pointsOnBench,
      benchBoostUsed: isBenchBoostGW,
      missedOpportunity: false, // Will be calculated after sorting
    });

    if (isBenchBoostGW) {
      // For bench boost week, the points_on_bench would be 0 in API
      // We'd need to estimate the return from total points difference
      // For now, we mark it as used
      benchBoostReturn = gw.points_on_bench; // This is actually 0 when BB is active
    } else {
      totalBenchPoints += pointsOnBench;
    }
  }

  // Find best historical gameweek
  const sortedByBench = [...history]
    .filter((h) => !h.benchBoostUsed)
    .sort((a, b) => b.pointsOnBench - a.pointsOnBench);

  const bestHistoricalGW = sortedByBench[0] || null;

  // Calculate missed opportunity score
  // If bench boost was used, compare to what the best week would have been
  let missedOpportunityScore = 0;
  if (benchBoostUsed && benchBoostGW && bestHistoricalGW) {
    const bbWeek = history.find((h) => h.gameweek === benchBoostGW);
    // If there was a better week, calculate the difference
    if (bbWeek && bestHistoricalGW.pointsOnBench > 0) {
      // Mark top 3 weeks as missed opportunities if BB wasn't used on them
      sortedByBench.slice(0, 3).forEach((h) => {
        if (!h.benchBoostUsed) {
          h.missedOpportunity = true;
          missedOpportunityScore += h.pointsOnBench;
        }
      });
    }
  }

  const avgBenchPoints =
    history.length > 0
      ? totalBenchPoints / history.filter((h) => !h.benchBoostUsed).length
      : 0;

  return {
    history,
    totalBenchPoints,
    avgBenchPoints: Math.round(avgBenchPoints * 10) / 10,
    bestHistoricalGW,
    benchBoostUsed,
    benchBoostGW,
    benchBoostReturn,
    missedOpportunityScore,
  };
}

/**
 * Get bench boost recommendations for upcoming gameweeks
 */
export function getBenchBoostRecommendations(
  fixtures: Fixture[],
  events: Gameweek[],
  teams: Team[],
  benchPlayers: EnrichedPlayer[],
  currentGW: number,
): BenchBoostRecommendation[] {
  const recommendations: BenchBoostRecommendation[] = [];
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Look ahead 6 gameweeks
  const lookAhead = 6;
  const endGW = Math.min(currentGW + lookAhead, 38);

  for (let gw = currentGW; gw <= endGW; gw++) {
    const event = events.find((e) => e.id === gw);
    if (!event) continue;

    const gwFixtures = fixtures.filter((f) => f.event === gw);

    // Check for double gameweek
    const isDGW = gwFixtures.length > 10; // More than 10 fixtures = DGW

    // Calculate average FDR for bench players
    let totalFDR = 0;
    let fixtureCount = 0;
    const reasons: string[] = [];

    for (const player of benchPlayers) {
      const teamFixtures = gwFixtures.filter(
        (f) => f.team_h === player.team || f.team_a === player.team,
      );

      for (const fixture of teamFixtures) {
        const isHome = fixture.team_h === player.team;
        const fdr = isHome
          ? fixture.team_h_difficulty
          : fixture.team_a_difficulty;
        totalFDR += fdr;
        fixtureCount++;

        // Check for favorable fixtures (FDR <= 2)
        if (fdr <= 2) {
          const opponent = isHome
            ? teamMap.get(fixture.team_a)?.short_name
            : teamMap.get(fixture.team_h)?.short_name;
          reasons.push(`${player.web_name} vs ${opponent} (FDR ${fdr})`);
        }
      }
    }

    const avgBenchFDR = fixtureCount > 0 ? totalFDR / fixtureCount : 3;

    // Calculate score
    let score = 0;

    // DGW bonus
    if (isDGW) {
      score += 30;
      reasons.unshift("Double Gameweek - extra fixtures!");
    }

    // FDR bonus (lower is better)
    score += Math.max(0, (3 - avgBenchFDR) * 10);

    // Number of favorable fixtures
    const favorableCount = reasons.filter((r) => r.includes("FDR")).length;
    score += favorableCount * 5;

    // Determine confidence
    let confidence: "high" | "medium" | "low" = "low";
    if (score >= 40 || (isDGW && avgBenchFDR <= 2.5)) {
      confidence = "high";
    } else if (score >= 25 || avgBenchFDR <= 2) {
      confidence = "medium";
    }

    recommendations.push({
      gameweek: gw,
      score,
      reasons: reasons.slice(0, 4),
      avgBenchFDR: Math.round(avgBenchFDR * 10) / 10,
      isDGW,
      confidence,
    });
  }

  // Sort by score descending
  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * Full bench boost analysis including recommendations
 */
export function analyzeBenchBoost(
  managerHistory: ManagerHistory | null,
  fixtures: Fixture[],
  events: Gameweek[],
  teams: Team[],
  benchPlayers: EnrichedPlayer[],
  currentGW: number,
): BenchBoostAnalysis {
  const historyAnalysis = managerHistory
    ? analyzeBenchHistory(managerHistory)
    : {
        history: [],
        totalBenchPoints: 0,
        avgBenchPoints: 0,
        bestHistoricalGW: null,
        benchBoostUsed: false,
        benchBoostGW: null,
        benchBoostReturn: null,
        missedOpportunityScore: 0,
      };

  const recommendations = getBenchBoostRecommendations(
    fixtures,
    events,
    teams,
    benchPlayers,
    currentGW,
  );

  return {
    ...historyAnalysis,
    recommendations,
  };
}

/**
 * Format FDR as a color class
 */
export function getFDRColorClass(fdr: number): string {
  if (fdr <= 2) return "text-fpl-green";
  if (fdr === 3) return "text-fpl-muted";
  if (fdr === 4) return "text-orange-400";
  return "text-fpl-danger";
}

/**
 * Format FDR as a background class
 */
export function getFDRBgClass(fdr: number): string {
  if (fdr <= 2) return "bg-fpl-green/20";
  if (fdr === 3) return "bg-fpl-purple-light";
  if (fdr === 4) return "bg-orange-400/20";
  return "bg-fpl-danger/20";
}
