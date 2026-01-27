import type { Fixture, Team, Gameweek } from './types';

export interface FixtureCell {
  opponent: Team;
  difficulty: number;
  isHome: boolean;
  fixture: Fixture;
}

export interface TeamFixtureRow {
  team: Team;
  fixtures: Map<number, FixtureCell[]>; // gwId -> cells (multiple for DGW)
  totalDifficulty: number; // sum of difficulty across selected range
}

/**
 * Build the fixture grid data for all teams across a range of gameweeks.
 */
export function buildFixtureGrid(
  teams: Team[],
  fixtures: Fixture[],
  gwStart: number,
  gwEnd: number,
): TeamFixtureRow[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const rows: TeamFixtureRow[] = teams.map((team) => ({
    team,
    fixtures: new Map(),
    totalDifficulty: 0,
  }));

  const rowMap = new Map(rows.map((r) => [r.team.id, r]));

  for (const fixture of fixtures) {
    const gw = fixture.event;
    if (gw === null || gw < gwStart || gw > gwEnd) continue;

    const homeTeam = teamMap.get(fixture.team_h);
    const awayTeam = teamMap.get(fixture.team_a);
    if (!homeTeam || !awayTeam) continue;

    // Home team row
    const homeRow = rowMap.get(fixture.team_h);
    if (homeRow) {
      const cells = homeRow.fixtures.get(gw) ?? [];
      cells.push({
        opponent: awayTeam,
        difficulty: fixture.team_h_difficulty,
        isHome: true,
        fixture,
      });
      homeRow.fixtures.set(gw, cells);
      homeRow.totalDifficulty += fixture.team_h_difficulty;
    }

    // Away team row
    const awayRow = rowMap.get(fixture.team_a);
    if (awayRow) {
      const cells = awayRow.fixtures.get(gw) ?? [];
      cells.push({
        opponent: homeTeam,
        difficulty: fixture.team_a_difficulty,
        isHome: false,
        fixture,
      });
      awayRow.fixtures.set(gw, cells);
      awayRow.totalDifficulty += fixture.team_a_difficulty;
    }
  }

  return rows;
}

/**
 * Sort team rows by total difficulty (easiest first).
 */
export function sortByEasiestFixtures(rows: TeamFixtureRow[]): TeamFixtureRow[] {
  return [...rows].sort((a, b) => {
    // More fixtures = better (DGWs), so penalize blanks
    const aCount = countFixtures(a);
    const bCount = countFixtures(b);
    // Lower average difficulty + more fixtures = better
    const aScore = aCount === 0 ? 999 : a.totalDifficulty / aCount;
    const bScore = bCount === 0 ? 999 : b.totalDifficulty / bCount;
    if (aScore !== bScore) return aScore - bScore;
    return bCount - aCount; // tie-break: more fixtures first
  });
}

function countFixtures(row: TeamFixtureRow): number {
  let count = 0;
  for (const cells of row.fixtures.values()) {
    count += cells.length;
  }
  return count;
}

/**
 * Get the FDR color class for a difficulty rating.
 */
export function getFDRColorClass(difficulty: number): string {
  switch (difficulty) {
    case 1: return 'bg-emerald-600 text-white';
    case 2: return 'bg-emerald-400/80 text-gray-900';
    case 3: return 'bg-gray-400/80 text-gray-900';
    case 4: return 'bg-orange-500/80 text-white';
    case 5: return 'bg-red-600 text-white';
    default: return 'bg-fpl-purple-light text-fpl-muted';
  }
}

/**
 * Identify DGW and BGW gameweeks for a list of fixtures.
 */
export function findSpecialGameweeks(
  fixtures: Fixture[],
  teams: Team[],
  events: Gameweek[],
): { dgws: Map<number, number[]>; bgws: Map<number, number[]> } {
  // dgws: gwId -> teamIds that have double fixtures
  // bgws: gwId -> teamIds that have no fixtures
  const teamIds = new Set(teams.map((t) => t.id));
  const dgws = new Map<number, number[]>();
  const bgws = new Map<number, number[]>();

  for (const event of events) {
    const gwFixtures = fixtures.filter((f) => f.event === event.id);
    const teamFixtureCount = new Map<number, number>();

    for (const tid of teamIds) {
      teamFixtureCount.set(tid, 0);
    }

    for (const f of gwFixtures) {
      teamFixtureCount.set(f.team_h, (teamFixtureCount.get(f.team_h) ?? 0) + 1);
      teamFixtureCount.set(f.team_a, (teamFixtureCount.get(f.team_a) ?? 0) + 1);
    }

    const dgwTeams: number[] = [];
    const bgwTeams: number[] = [];
    for (const [tid, count] of teamFixtureCount) {
      if (count >= 2) dgwTeams.push(tid);
      if (count === 0) bgwTeams.push(tid);
    }

    if (dgwTeams.length > 0) dgws.set(event.id, dgwTeams);
    if (bgwTeams.length > 0) bgws.set(event.id, bgwTeams);
  }

  return { dgws, bgws };
}
