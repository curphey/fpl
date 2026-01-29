import type { Fixture, Gameweek, Pick } from "./types";
import type { EnrichedPlayer } from "./utils";

export interface ChipRecommendation {
  chip: "wildcard" | "freehit" | "3xc" | "bboost";
  label: string;
  score: number; // 0-100 recommendation strength
  reasoning: string[];
  suggestedGw: number | null;
}

export interface ChipGwScore {
  gw: number;
  score: number;
  reasoning: string;
}

export interface ChipTimingAnalysis {
  chip: "wildcard" | "freehit" | "3xc" | "bboost";
  label: string;
  currentGwScore: number;
  bestGw: number | null;
  bestGwScore: number;
  gwScores: ChipGwScore[];
  recommendation: "play_now" | "wait" | "neutral";
  summary: string;
}

/**
 * Analyze upcoming fixtures and data to recommend chip usage.
 *
 * Strategies:
 *   - Wildcard: recommend when team value can be significantly improved
 *     (many in-form players not owned, or many owned players out of form)
 *   - Free Hit: recommend for blank/double GWs (unusual fixture counts)
 *   - Triple Captain: recommend when top captain pick has an easy home fixture + high form
 *   - Bench Boost: recommend when all bench players have good fixtures
 */
export function analyzeChipStrategies(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  events: Gameweek[],
  currentGwId: number,
  availableChips: string[],
): ChipRecommendation[] {
  const recommendations: ChipRecommendation[] = [];
  const upcomingGws = events.filter(
    (e) => e.id >= currentGwId && e.id <= currentGwId + 6,
  );

  if (availableChips.includes("wildcard")) {
    recommendations.push(analyzeWildcard(players, currentGwId));
  }

  if (availableChips.includes("freehit")) {
    recommendations.push(
      analyzeFreeHit(fixtures, events, currentGwId, upcomingGws),
    );
  }

  if (availableChips.includes("3xc")) {
    recommendations.push(
      analyzeTripleCaptain(players, fixtures, currentGwId, upcomingGws),
    );
  }

  if (availableChips.includes("bboost")) {
    recommendations.push(
      analyzeBenchBoost(fixtures, events, currentGwId, upcomingGws),
    );
  }

  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * Analyze chip timing across multiple gameweeks.
 * Returns detailed scores for each GW to help decide when to play chips.
 */
export function analyzeChipTiming(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  events: Gameweek[],
  currentGwId: number,
  availableChips: string[],
  squadPicks?: Pick[],
): ChipTimingAnalysis[] {
  const analyses: ChipTimingAnalysis[] = [];
  const lookAheadGws = 8;
  const upcomingGws = events.filter(
    (e) => e.id >= currentGwId && e.id <= currentGwId + lookAheadGws,
  );

  // Build squad player set for squad-aware analysis
  const squadPlayerIds = new Set(squadPicks?.map((p) => p.element) ?? []);
  const squadPlayers = players.filter((p) => squadPlayerIds.has(p.id));

  if (availableChips.includes("bboost")) {
    analyses.push(
      analyzeBenchBoostTiming(
        players,
        fixtures,
        upcomingGws,
        currentGwId,
        squadPlayers,
      ),
    );
  }

  if (availableChips.includes("3xc")) {
    analyses.push(
      analyzeTripleCaptainTiming(
        players,
        fixtures,
        upcomingGws,
        currentGwId,
        squadPlayers,
      ),
    );
  }

  if (availableChips.includes("freehit")) {
    analyses.push(analyzeFreeHitTiming(fixtures, upcomingGws, currentGwId));
  }

  if (availableChips.includes("wildcard")) {
    analyses.push(analyzeWildcardTiming(players, upcomingGws, currentGwId));
  }

  return analyses.sort((a, b) => b.bestGwScore - a.bestGwScore);
}

function analyzeBenchBoostTiming(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  upcomingGws: Gameweek[],
  currentGwId: number,
  squadPlayers: EnrichedPlayer[],
): ChipTimingAnalysis {
  const gwScores: ChipGwScore[] = [];

  for (const gw of upcomingGws) {
    const gwFixtures = fixtures.filter((f) => f.event === gw.id);
    let score = 20;
    const reasons: string[] = [];

    // Check for DGW
    const teamFixtureCounts = new Map<number, number>();
    for (const f of gwFixtures) {
      teamFixtureCounts.set(
        f.team_h,
        (teamFixtureCounts.get(f.team_h) || 0) + 1,
      );
      teamFixtureCounts.set(
        f.team_a,
        (teamFixtureCounts.get(f.team_a) || 0) + 1,
      );
    }

    // Count squad players with double fixtures
    let squadDgwCount = 0;
    if (squadPlayers.length > 0) {
      for (const player of squadPlayers) {
        const fixtureCount = teamFixtureCounts.get(player.team) || 0;
        if (fixtureCount >= 2) squadDgwCount++;
      }
      if (squadDgwCount >= 4) {
        score += 30 + squadDgwCount * 3;
        reasons.push(`${squadDgwCount} squad players with DGW`);
      }
    }

    // General DGW bonus
    if (gwFixtures.length > 10) {
      const extraFixtures = gwFixtures.length - 10;
      score += 15 + extraFixtures * 5;
      reasons.push(`${gwFixtures.length} fixtures (DGW)`);
    }

    // Average FDR bonus
    if (gwFixtures.length > 0) {
      const avgDifficulty =
        gwFixtures.reduce(
          (s, f) => s + f.team_h_difficulty + f.team_a_difficulty,
          0,
        ) /
        (gwFixtures.length * 2);
      if (avgDifficulty < 2.8) {
        score += Math.round((3 - avgDifficulty) * 10);
        reasons.push(`Low avg FDR (${avgDifficulty.toFixed(1)})`);
      }
    }

    gwScores.push({
      gw: gw.id,
      score: Math.min(score, 100),
      reasoning: reasons.join("; ") || "Standard GW",
    });
  }

  const currentGwScore = gwScores.find((s) => s.gw === currentGwId)?.score ?? 0;
  const bestGwEntry = gwScores.reduce(
    (best, curr) => (curr.score > best.score ? curr : best),
    gwScores[0],
  );

  let recommendation: "play_now" | "wait" | "neutral" = "neutral";
  let summary = "";

  if (bestGwEntry.gw === currentGwId && currentGwScore >= 50) {
    recommendation = "play_now";
    summary = `GW${currentGwId} is optimal for Bench Boost`;
  } else if (bestGwEntry.score >= currentGwScore + 20) {
    recommendation = "wait";
    summary = `Wait for GW${bestGwEntry.gw} (+${bestGwEntry.score - currentGwScore} pts potential)`;
  } else if (currentGwScore >= 45) {
    recommendation = "neutral";
    summary = "Current GW is decent but better opportunities may come";
  } else {
    recommendation = "wait";
    summary = "Save for a DGW when bench players have double fixtures";
  }

  return {
    chip: "bboost",
    label: "Bench Boost",
    currentGwScore,
    bestGw: bestGwEntry.gw,
    bestGwScore: bestGwEntry.score,
    gwScores,
    recommendation,
    summary,
  };
}

function analyzeTripleCaptainTiming(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  upcomingGws: Gameweek[],
  currentGwId: number,
  squadPlayers: EnrichedPlayer[],
): ChipTimingAnalysis {
  const gwScores: ChipGwScore[] = [];
  const premiums = players
    .filter((p) => p.now_cost >= 100 && p.status === "a")
    .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
    .slice(0, 15);

  // Find captain candidates from squad
  const squadPremiums = squadPlayers.filter((p) => p.now_cost >= 90);

  for (const gw of upcomingGws) {
    const gwFixtures = fixtures.filter((f) => f.event === gw.id);
    let score = 15;
    const reasons: string[] = [];

    // Team fixture counts for DGW detection
    const teamFixtureCounts = new Map<number, number>();
    for (const f of gwFixtures) {
      teamFixtureCounts.set(
        f.team_h,
        (teamFixtureCounts.get(f.team_h) || 0) + 1,
      );
      teamFixtureCounts.set(
        f.team_a,
        (teamFixtureCounts.get(f.team_a) || 0) + 1,
      );
    }

    // Check squad premiums first
    const targetPlayers = squadPremiums.length > 0 ? squadPremiums : premiums;
    let bestPlayerScore = 0;
    let bestPlayerName = "";

    for (const player of targetPlayers) {
      const fixtureCount = teamFixtureCounts.get(player.team) || 0;
      const form = parseFloat(player.form) || 0;

      if (fixtureCount >= 2) {
        const playerScore = 40 + fixtureCount * 10 + form * 2;
        if (playerScore > bestPlayerScore) {
          bestPlayerScore = playerScore;
          bestPlayerName = `${player.web_name} DGW`;
        }
      } else {
        // Check for easy home fixture
        const fix = gwFixtures.find(
          (f) => f.team_h === player.team || f.team_a === player.team,
        );
        if (fix) {
          const isHome = fix.team_h === player.team;
          const difficulty = isHome
            ? fix.team_h_difficulty
            : fix.team_a_difficulty;
          if (isHome && difficulty <= 2 && form > 6) {
            const playerScore = 25 + (3 - difficulty) * 8 + form * 2;
            if (playerScore > bestPlayerScore) {
              bestPlayerScore = playerScore;
              bestPlayerName = `${player.web_name} (H, FDR ${difficulty})`;
            }
          }
        }
      }
    }

    if (bestPlayerScore > 0) {
      score += bestPlayerScore;
      reasons.push(bestPlayerName);
    }

    gwScores.push({
      gw: gw.id,
      score: Math.min(score, 100),
      reasoning: reasons.join("; ") || "No standout option",
    });
  }

  const currentGwScore = gwScores.find((s) => s.gw === currentGwId)?.score ?? 0;
  const bestGwEntry = gwScores.reduce(
    (best, curr) => (curr.score > best.score ? curr : best),
    gwScores[0],
  );

  let recommendation: "play_now" | "wait" | "neutral" = "neutral";
  let summary = "";

  if (bestGwEntry.gw === currentGwId && currentGwScore >= 60) {
    recommendation = "play_now";
    summary = `GW${currentGwId} has excellent TC opportunity`;
  } else if (bestGwEntry.score >= currentGwScore + 25) {
    recommendation = "wait";
    summary = `Wait for GW${bestGwEntry.gw} - ${bestGwEntry.reasoning}`;
  } else if (currentGwScore >= 50) {
    recommendation = "neutral";
    summary = "Decent option now, but DGW would be better";
  } else {
    recommendation = "wait";
    summary = "Save for a DGW with premium captain option";
  }

  return {
    chip: "3xc",
    label: "Triple Captain",
    currentGwScore,
    bestGw: bestGwEntry.gw,
    bestGwScore: bestGwEntry.score,
    gwScores,
    recommendation,
    summary,
  };
}

function analyzeFreeHitTiming(
  fixtures: Fixture[],
  upcomingGws: Gameweek[],
  currentGwId: number,
): ChipTimingAnalysis {
  const gwScores: ChipGwScore[] = [];

  for (const gw of upcomingGws) {
    const gwFixtures = fixtures.filter((f) => f.event === gw.id);
    let score = 15;
    const reasons: string[] = [];

    const teamCount = new Set([
      ...gwFixtures.map((f) => f.team_h),
      ...gwFixtures.map((f) => f.team_a),
    ]).size;

    // Blank GW - major opportunity
    if (teamCount < 18) {
      const blankTeams = 20 - teamCount;
      score += 40 + blankTeams * 8;
      reasons.push(`${blankTeams} teams blanking`);
    }

    // DGW - good opportunity
    if (gwFixtures.length > 10) {
      const extraFixtures = gwFixtures.length - 10;
      score += 20 + extraFixtures * 6;
      reasons.push(`${gwFixtures.length} fixtures (DGW)`);
    }

    gwScores.push({
      gw: gw.id,
      score: Math.min(score, 100),
      reasoning: reasons.join("; ") || "Standard GW",
    });
  }

  const currentGwScore = gwScores.find((s) => s.gw === currentGwId)?.score ?? 0;
  const bestGwEntry = gwScores.reduce(
    (best, curr) => (curr.score > best.score ? curr : best),
    gwScores[0],
  );

  let recommendation: "play_now" | "wait" | "neutral" = "neutral";
  let summary = "";

  if (bestGwEntry.gw === currentGwId && currentGwScore >= 55) {
    recommendation = "play_now";
    summary = "Current GW is ideal for Free Hit";
  } else if (bestGwEntry.score >= 50) {
    recommendation = "wait";
    summary = `Save for GW${bestGwEntry.gw} - ${bestGwEntry.reasoning}`;
  } else {
    recommendation = "wait";
    summary = "No BGW/DGW detected - save for later";
  }

  return {
    chip: "freehit",
    label: "Free Hit",
    currentGwScore,
    bestGw: bestGwEntry.gw,
    bestGwScore: bestGwEntry.score,
    gwScores,
    recommendation,
    summary,
  };
}

function analyzeWildcardTiming(
  players: EnrichedPlayer[],
  upcomingGws: Gameweek[],
  currentGwId: number,
): ChipTimingAnalysis {
  const gwScores: ChipGwScore[] = [];

  // Wildcard value is more about squad state than specific GW
  const topForm = players
    .filter((p) => p.status === "a")
    .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
    .slice(0, 15);
  const avgTopForm =
    topForm.reduce((s, p) => s + parseFloat(p.form), 0) / topForm.length;

  for (const gw of upcomingGws) {
    let score = 25;
    const reasons: string[] = [];

    // Form-based opportunities
    if (avgTopForm > 6.5) {
      score += 15;
      reasons.push(`Strong form players available`);
    }

    // Mid-season inflection
    if (gw.id >= 18 && gw.id <= 22) {
      score += 20;
      reasons.push("Mid-season restructure window");
    }

    // Pre-DGW wildcard
    if (gw.id >= 30 && gw.id <= 34) {
      score += 15;
      reasons.push("Pre-DGW squad building");
    }

    gwScores.push({
      gw: gw.id,
      score: Math.min(score, 100),
      reasoning: reasons.join("; ") || "Flexible timing",
    });
  }

  const currentGwScore = gwScores.find((s) => s.gw === currentGwId)?.score ?? 0;
  const bestGwEntry = gwScores.reduce(
    (best, curr) => (curr.score > best.score ? curr : best),
    gwScores[0],
  );

  let recommendation: "play_now" | "wait" | "neutral" = "neutral";
  let summary = "";

  if (currentGwScore >= 50) {
    recommendation = "neutral";
    summary = "Good time to restructure if squad needs work";
  } else if (bestGwEntry.score > currentGwScore + 15) {
    recommendation = "wait";
    summary = `Better window at GW${bestGwEntry.gw}`;
  } else {
    recommendation = "neutral";
    summary = "Use when squad needs significant changes";
  }

  return {
    chip: "wildcard",
    label: "Wildcard",
    currentGwScore,
    bestGw: bestGwEntry.gw,
    bestGwScore: bestGwEntry.score,
    gwScores,
    recommendation,
    summary,
  };
}

function analyzeWildcard(
  players: EnrichedPlayer[],
  currentGwId: number,
): ChipRecommendation {
  const reasoning: string[] = [];
  let score = 30; // baseline — wildcards are always somewhat useful

  // Check how many top-form players exist that could reshape a squad
  const topForm = players
    .filter((p) => p.status === "a")
    .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
    .slice(0, 15);

  const avgTopForm =
    topForm.reduce((s, p) => s + parseFloat(p.form), 0) / topForm.length;

  if (avgTopForm > 6) {
    score += 20;
    reasoning.push(
      `Strong in-form players available (avg form ${avgTopForm.toFixed(1)})`,
    );
  }

  // Mid-season inflection points are good wildcard moments
  if (currentGwId >= 18 && currentGwId <= 22) {
    score += 15;
    reasoning.push("Mid-season window — good time for squad restructure");
  }

  if (reasoning.length === 0) {
    reasoning.push("No strong trigger — consider saving for a better window");
  }

  return {
    chip: "wildcard",
    label: "Wildcard",
    score: Math.min(score, 100),
    reasoning,
    suggestedGw: null,
  };
}

function analyzeFreeHit(
  fixtures: Fixture[],
  events: Gameweek[],
  currentGwId: number,
  upcomingGws: Gameweek[],
): ChipRecommendation {
  const reasoning: string[] = [];
  let score = 20;
  let bestGw: number | null = null;
  let bestScore = 0;

  // Look for blank or double gameweeks in upcoming fixtures
  for (const gw of upcomingGws) {
    const gwFixtures = fixtures.filter((f) => f.event === gw.id);
    const teamCount = new Set([
      ...gwFixtures.map((f) => f.team_h),
      ...gwFixtures.map((f) => f.team_a),
    ]).size;

    // Blank GW: fewer than 20 teams playing
    if (teamCount < 18) {
      const blankTeams = 20 - teamCount;
      const gwScore = 30 + blankTeams * 5;
      reasoning.push(
        `GW${gw.id}: ${blankTeams} teams with no fixture (blank GW)`,
      );
      if (gwScore > bestScore) {
        bestScore = gwScore;
        bestGw = gw.id;
      }
    }

    // Double GW: more than 10 fixtures
    if (gwFixtures.length > 10) {
      const extraFixtures = gwFixtures.length - 10;
      const gwScore = 25 + extraFixtures * 8;
      reasoning.push(`GW${gw.id}: ${gwFixtures.length} fixtures (double GW)`);
      if (gwScore > bestScore) {
        bestScore = gwScore;
        bestGw = gw.id;
      }
    }
  }

  score += bestScore;

  if (reasoning.length === 0) {
    reasoning.push(
      "No blank/double GWs detected in the next 6 gameweeks — save for later",
    );
  }

  return {
    chip: "freehit",
    label: "Free Hit",
    score: Math.min(score, 100),
    reasoning,
    suggestedGw: bestGw,
  };
}

function analyzeTripleCaptain(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  currentGwId: number,
  upcomingGws: Gameweek[],
): ChipRecommendation {
  const reasoning: string[] = [];
  let score = 15;
  let bestGw: number | null = null;
  let bestScore = 0;

  for (const gw of upcomingGws) {
    const gwFixtures = fixtures.filter((f) => f.event === gw.id);

    // Find premium players with easy home fixtures
    const premiums = players
      .filter(
        (p) => p.now_cost >= 100 && p.status === "a" && parseFloat(p.form) > 5,
      )
      .slice(0, 10);

    for (const player of premiums) {
      const fix = gwFixtures.find(
        (f) => f.team_h === player.team || f.team_a === player.team,
      );
      if (!fix) continue;

      const isHome = fix.team_h === player.team;
      const difficulty = isHome ? fix.team_h_difficulty : fix.team_a_difficulty;

      if (isHome && difficulty <= 2 && parseFloat(player.form) > 7) {
        const gwScore =
          40 + (10 - difficulty * 3) + parseFloat(player.form) * 2;
        reasoning.push(
          `GW${gw.id}: ${player.web_name} (form ${player.form}) has easy home fixture (FDR ${difficulty})`,
        );
        if (gwScore > bestScore) {
          bestScore = gwScore;
          bestGw = gw.id;
        }
      }
    }

    // Double GW is great for TC too
    const playerFixtureCount = new Map<number, number>();
    for (const f of gwFixtures) {
      playerFixtureCount.set(
        f.team_h,
        (playerFixtureCount.get(f.team_h) || 0) + 1,
      );
      playerFixtureCount.set(
        f.team_a,
        (playerFixtureCount.get(f.team_a) || 0) + 1,
      );
    }

    for (const player of premiums) {
      const count = playerFixtureCount.get(player.team) || 0;
      if (count >= 2) {
        const gwScore = 50 + parseFloat(player.form) * 3;
        reasoning.push(
          `GW${gw.id}: ${player.web_name} has ${count} fixtures (DGW) with form ${player.form}`,
        );
        if (gwScore > bestScore) {
          bestScore = gwScore;
          bestGw = gw.id;
        }
      }
    }
  }

  score += bestScore;

  if (reasoning.length === 0) {
    reasoning.push(
      "No standout TC opportunity in next 6 GWs — keep for a DGW or high-form captain pick",
    );
  }

  return {
    chip: "3xc",
    label: "Triple Captain",
    score: Math.min(score, 100),
    reasoning,
    suggestedGw: bestGw,
  };
}

function analyzeBenchBoost(
  fixtures: Fixture[],
  events: Gameweek[],
  currentGwId: number,
  upcomingGws: Gameweek[],
): ChipRecommendation {
  const reasoning: string[] = [];
  let score = 15;
  let bestGw: number | null = null;
  let bestScore = 0;

  for (const gw of upcomingGws) {
    const gwFixtures = fixtures.filter((f) => f.event === gw.id);

    // Double GW is ideal for Bench Boost
    if (gwFixtures.length > 10) {
      const extraFixtures = gwFixtures.length - 10;
      const gwScore = 35 + extraFixtures * 10;
      reasoning.push(
        `GW${gw.id}: ${gwFixtures.length} fixtures — DGW maximizes bench value`,
      );
      if (gwScore > bestScore) {
        bestScore = gwScore;
        bestGw = gw.id;
      }
    }

    // Check average fixture difficulty
    const avgDifficulty =
      gwFixtures.reduce(
        (s, f) => s + f.team_h_difficulty + f.team_a_difficulty,
        0,
      ) / Math.max(gwFixtures.length * 2, 1);

    if (avgDifficulty < 2.8 && gwFixtures.length >= 10) {
      const gwScore = 20 + (3 - avgDifficulty) * 20;
      reasoning.push(
        `GW${gw.id}: Average FDR ${avgDifficulty.toFixed(1)} — favorable fixture spread`,
      );
      if (gwScore > bestScore) {
        bestScore = gwScore;
        bestGw = gw.id;
      }
    }
  }

  score += bestScore;

  if (reasoning.length === 0) {
    reasoning.push(
      "No ideal BB window detected — best used in a DGW when bench is strong",
    );
  }

  return {
    chip: "bboost",
    label: "Bench Boost",
    score: Math.min(score, 100),
    reasoning,
    suggestedGw: bestGw,
  };
}
