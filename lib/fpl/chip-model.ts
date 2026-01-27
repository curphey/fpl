import type { Fixture, Gameweek } from './types';
import type { EnrichedPlayer } from './utils';

export interface ChipRecommendation {
  chip: 'wildcard' | 'freehit' | '3xc' | 'bboost';
  label: string;
  score: number; // 0-100 recommendation strength
  reasoning: string[];
  suggestedGw: number | null;
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
  const upcomingGws = events.filter((e) => e.id >= currentGwId && e.id <= currentGwId + 6);

  if (availableChips.includes('wildcard')) {
    recommendations.push(analyzeWildcard(players, currentGwId));
  }

  if (availableChips.includes('freehit')) {
    recommendations.push(analyzeFreeHit(fixtures, events, currentGwId, upcomingGws));
  }

  if (availableChips.includes('3xc')) {
    recommendations.push(analyzeTripleCaptain(players, fixtures, currentGwId, upcomingGws));
  }

  if (availableChips.includes('bboost')) {
    recommendations.push(analyzeBenchBoost(fixtures, events, currentGwId, upcomingGws));
  }

  return recommendations.sort((a, b) => b.score - a.score);
}

function analyzeWildcard(
  players: EnrichedPlayer[],
  currentGwId: number,
): ChipRecommendation {
  const reasoning: string[] = [];
  let score = 30; // baseline — wildcards are always somewhat useful

  // Check how many top-form players exist that could reshape a squad
  const topForm = players
    .filter((p) => p.status === 'a')
    .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
    .slice(0, 15);

  const avgTopForm = topForm.reduce((s, p) => s + parseFloat(p.form), 0) / topForm.length;

  if (avgTopForm > 6) {
    score += 20;
    reasoning.push(`Strong in-form players available (avg form ${avgTopForm.toFixed(1)})`);
  }

  // Mid-season inflection points are good wildcard moments
  if (currentGwId >= 18 && currentGwId <= 22) {
    score += 15;
    reasoning.push('Mid-season window — good time for squad restructure');
  }

  if (reasoning.length === 0) {
    reasoning.push('No strong trigger — consider saving for a better window');
  }

  return {
    chip: 'wildcard',
    label: 'Wildcard',
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
      reasoning.push(`GW${gw.id}: ${blankTeams} teams with no fixture (blank GW)`);
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
    reasoning.push('No blank/double GWs detected in the next 6 gameweeks — save for later');
  }

  return {
    chip: 'freehit',
    label: 'Free Hit',
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
      .filter((p) => p.now_cost >= 100 && p.status === 'a' && parseFloat(p.form) > 5)
      .slice(0, 10);

    for (const player of premiums) {
      const fix = gwFixtures.find(
        (f) => f.team_h === player.team || f.team_a === player.team,
      );
      if (!fix) continue;

      const isHome = fix.team_h === player.team;
      const difficulty = isHome ? fix.team_h_difficulty : fix.team_a_difficulty;

      if (isHome && difficulty <= 2 && parseFloat(player.form) > 7) {
        const gwScore = 40 + (10 - difficulty * 3) + parseFloat(player.form) * 2;
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
      playerFixtureCount.set(f.team_h, (playerFixtureCount.get(f.team_h) || 0) + 1);
      playerFixtureCount.set(f.team_a, (playerFixtureCount.get(f.team_a) || 0) + 1);
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
    reasoning.push('No standout TC opportunity in next 6 GWs — keep for a DGW or high-form captain pick');
  }

  return {
    chip: '3xc',
    label: 'Triple Captain',
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
      reasoning.push(`GW${gw.id}: ${gwFixtures.length} fixtures — DGW maximizes bench value`);
      if (gwScore > bestScore) {
        bestScore = gwScore;
        bestGw = gw.id;
      }
    }

    // Check average fixture difficulty
    const avgDifficulty =
      gwFixtures.reduce((s, f) => s + f.team_h_difficulty + f.team_a_difficulty, 0) /
      Math.max(gwFixtures.length * 2, 1);

    if (avgDifficulty < 2.8 && gwFixtures.length >= 10) {
      const gwScore = 20 + (3 - avgDifficulty) * 20;
      reasoning.push(`GW${gw.id}: Average FDR ${avgDifficulty.toFixed(1)} — favorable fixture spread`);
      if (gwScore > bestScore) {
        bestScore = gwScore;
        bestGw = gw.id;
      }
    }
  }

  score += bestScore;

  if (reasoning.length === 0) {
    reasoning.push('No ideal BB window detected — best used in a DGW when bench is strong');
  }

  return {
    chip: 'bboost',
    label: 'Bench Boost',
    score: Math.min(score, 100),
    reasoning,
    suggestedGw: bestGw,
  };
}
