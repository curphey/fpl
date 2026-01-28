import type { Player, Team, StandingsResult, ManagerPicks, Pick } from './types';
import { getPlayerForm } from './utils';

// =============================================================================
// Types
// =============================================================================

export interface RivalTeam {
  entry: number;
  name: string;
  playerName: string;
  rank: number;
  total: number;
  pointsGap: number;
  picks: Pick[];
  activePicks: Pick[]; // starting XI (multiplier > 0)
  captain: number | null;
}

export interface EffectiveOwnership {
  playerId: number;
  playerName: string;
  position: string;
  teamShortName: string;
  globalOwnership: number;
  leagueEO: number; // % of analyzed managers who own (weighted by multiplier)
  captainEO: number; // % who captain
  ownerCount: number;
  totalManagers: number; // user + rivals
  userStatus: 'captain' | 'own' | 'bench' | 'dont_own';
}

export interface Differential {
  playerId: number;
  playerName: string;
  position: string;
  teamShortName: string;
  form: number;
  expectedPoints: number;
  rivalsOwning: number;
  totalRivals: number;
  riskScore: number; // 0-100
  type: 'attack' | 'cover';
}

export interface RivalComparison {
  rival: RivalTeam;
  shared: number[];
  userOnly: number[];
  rivalOnly: number[];
  captainMatch: boolean;
  pointsGap: number;
}

export interface SwingScenario {
  playerId: number;
  playerName: string;
  position: string;
  teamShortName: string;
  rivalsOwning: number;
  totalRivals: number;
  netImpact2: number;
  netImpact6: number;
  netImpact10: number;
  netImpact15: number;
}

export interface LeagueAnalysis {
  effectiveOwnership: EffectiveOwnership[];
  yourDifferentials: Differential[];
  theirDifferentials: Differential[];
  rivals: RivalTeam[];
  swingScenarios: SwingScenario[];
  userRank: number;
  gapToLeader: number;
  uniquePlayerCount: number;
  eoCoverage: number;
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Select N rivals closest to the user by total points.
 */
export function selectRivals(
  standings: StandingsResult[],
  userEntry: number,
  count: number,
): StandingsResult[] {
  const user = standings.find((s) => s.entry === userEntry);
  if (!user) return standings.filter((s) => s.entry !== userEntry).slice(0, count);

  const others = standings
    .filter((s) => s.entry !== userEntry)
    .map((s) => ({ ...s, gap: Math.abs(s.total - user.total) }))
    .sort((a, b) => a.gap - b.gap);

  return others.slice(0, count);
}

/**
 * Build a RivalTeam from standings + picks data.
 */
export function buildRivalTeam(
  standing: StandingsResult,
  picks: ManagerPicks,
  userTotal: number,
): RivalTeam {
  const captain = picks.picks.find((p) => p.is_captain);
  return {
    entry: standing.entry,
    name: standing.entry_name,
    playerName: standing.player_name,
    rank: standing.rank,
    total: standing.total,
    pointsGap: standing.total - userTotal,
    picks: picks.picks,
    activePicks: picks.picks.filter((p) => p.multiplier > 0),
    captain: captain?.element ?? null,
  };
}

/**
 * Calculate effective ownership for every player across analyzed managers.
 */
export function calculateEffectiveOwnership(
  userPicks: Pick[],
  rivals: RivalTeam[],
  playerMap: Map<number, Player>,
  teamMap: Map<number, Team>,
): EffectiveOwnership[] {
  const totalManagers = 1 + rivals.length;
  const playerIds = new Set<number>();

  // Gather all player IDs from user + rivals
  for (const pick of userPicks) playerIds.add(pick.element);
  for (const rival of rivals) {
    for (const pick of rival.picks) playerIds.add(pick.element);
  }

  const userPickMap = new Map(userPicks.map((p) => [p.element, p]));

  return Array.from(playerIds)
    .map((playerId) => {
      const player = playerMap.get(playerId);
      if (!player) return null;

      const team = teamMap.get(player.team);
      const userPick = userPickMap.get(playerId);

      // Count ownership (multiplier-weighted for EO)
      let eoWeight = 0;
      let captainWeight = 0;
      let ownerCount = 0;

      // User contribution
      if (userPick) {
        eoWeight += userPick.multiplier > 0 ? 1 : 0;
        captainWeight += userPick.is_captain ? 1 : 0;
        ownerCount += 1;
      }

      // Rival contributions
      for (const rival of rivals) {
        const rivalPick = rival.picks.find((p) => p.element === playerId);
        if (rivalPick) {
          eoWeight += rivalPick.multiplier > 0 ? 1 : 0;
          captainWeight += rivalPick.is_captain ? 1 : 0;
          ownerCount += 1;
        }
      }

      let userStatus: EffectiveOwnership['userStatus'] = 'dont_own';
      if (userPick) {
        if (userPick.is_captain) userStatus = 'captain';
        else if (userPick.multiplier > 0) userStatus = 'own';
        else userStatus = 'bench';
      }

      return {
        playerId,
        playerName: player.web_name,
        position: getPositionShort(player.element_type),
        teamShortName: team?.short_name ?? '???',
        globalOwnership: parseFloat(player.selected_by_percent) || 0,
        leagueEO: (eoWeight / totalManagers) * 100,
        captainEO: (captainWeight / totalManagers) * 100,
        ownerCount,
        totalManagers,
        userStatus,
      };
    })
    .filter((x): x is EffectiveOwnership => x !== null)
    .sort((a, b) => b.leagueEO - a.leagueEO);
}

/**
 * Identify differentials — players unique to user (attack) or rivals (cover).
 */
export function identifyDifferentials(
  userPicks: Pick[],
  rivals: RivalTeam[],
  playerMap: Map<number, Player>,
  teamMap: Map<number, Team>,
): { attack: Differential[]; cover: Differential[] } {
  const userActiveIds = new Set(
    userPicks.filter((p) => p.multiplier > 0).map((p) => p.element),
  );

  // Count how many rivals own each player (active only)
  const rivalOwnership = new Map<number, number>();
  for (const rival of rivals) {
    for (const pick of rival.activePicks) {
      rivalOwnership.set(pick.element, (rivalOwnership.get(pick.element) ?? 0) + 1);
    }
  }

  const totalRivals = rivals.length;

  // Attack: user owns, no rival owns
  const attack: Differential[] = [];
  for (const id of userActiveIds) {
    const rivalsOwning = rivalOwnership.get(id) ?? 0;
    if (rivalsOwning === 0) {
      const player = playerMap.get(id);
      if (!player) continue;
      const team = teamMap.get(player.team);
      const form = getPlayerForm(player);
      attack.push({
        playerId: id,
        playerName: player.web_name,
        position: getPositionShort(player.element_type),
        teamShortName: team?.short_name ?? '???',
        form,
        expectedPoints: parseFloat(player.ep_next ?? '0') || form,
        rivalsOwning: 0,
        totalRivals,
        riskScore: 0,
        type: 'attack',
      });
    }
  }
  attack.sort((a, b) => b.form - a.form);

  // Cover: rivals own, user doesn't
  const cover: Differential[] = [];
  for (const [id, count] of rivalOwnership) {
    if (!userActiveIds.has(id)) {
      const player = playerMap.get(id);
      if (!player) continue;
      const team = teamMap.get(player.team);
      const form = getPlayerForm(player);
      const riskScore = Math.round((count / totalRivals) * 100);
      cover.push({
        playerId: id,
        playerName: player.web_name,
        position: getPositionShort(player.element_type),
        teamShortName: team?.short_name ?? '???',
        form,
        expectedPoints: parseFloat(player.ep_next ?? '0') || form,
        rivalsOwning: count,
        totalRivals,
        riskScore,
        type: 'cover',
      });
    }
  }
  cover.sort((a, b) => b.riskScore - a.riskScore);

  return { attack, cover };
}

/**
 * Head-to-head comparison between user and a specific rival.
 */
export function compareWithRival(
  userPicks: Pick[],
  rival: RivalTeam,
): RivalComparison {
  const userActiveIds = new Set(
    userPicks.filter((p) => p.multiplier > 0).map((p) => p.element),
  );
  const rivalActiveIds = new Set(rival.activePicks.map((p) => p.element));

  const shared: number[] = [];
  const userOnly: number[] = [];
  const rivalOnly: number[] = [];

  for (const id of userActiveIds) {
    if (rivalActiveIds.has(id)) shared.push(id);
    else userOnly.push(id);
  }
  for (const id of rivalActiveIds) {
    if (!userActiveIds.has(id)) rivalOnly.push(id);
  }

  const userCaptain = userPicks.find((p) => p.is_captain)?.element;
  const captainMatch = userCaptain === rival.captain;

  return {
    rival,
    shared,
    userOnly,
    rivalOnly,
    captainMatch,
    pointsGap: rival.pointsGap,
  };
}

/**
 * Generate swing scenarios for cover differentials at various point thresholds.
 */
export function generateSwingScenarios(
  userPicks: Pick[],
  rivals: RivalTeam[],
  playerMap: Map<number, Player>,
  teamMap: Map<number, Team>,
): SwingScenario[] {
  const userActiveIds = new Set(
    userPicks.filter((p) => p.multiplier > 0).map((p) => p.element),
  );

  // Count rival ownership of players the user doesn't have
  const rivalOwnership = new Map<number, number>();
  for (const rival of rivals) {
    for (const pick of rival.activePicks) {
      if (!userActiveIds.has(pick.element)) {
        rivalOwnership.set(
          pick.element,
          (rivalOwnership.get(pick.element) ?? 0) + 1,
        );
      }
    }
  }

  const totalRivals = rivals.length;
  const scenarios: SwingScenario[] = [];

  for (const [playerId, rivalsOwning] of rivalOwnership) {
    const player = playerMap.get(playerId);
    if (!player) continue;
    const team = teamMap.get(player.team);

    // Net impact = how many points you lose relative to each rival who owns this player
    // If the player scores X points, each rival gains X and you gain 0
    // Average net impact per rival = -X * (rivalsOwning / totalRivals)
    const fraction = rivalsOwning / totalRivals;

    scenarios.push({
      playerId,
      playerName: player.web_name,
      position: getPositionShort(player.element_type),
      teamShortName: team?.short_name ?? '???',
      rivalsOwning,
      totalRivals,
      netImpact2: Math.round(-2 * fraction * 10) / 10,
      netImpact6: Math.round(-6 * fraction * 10) / 10,
      netImpact10: Math.round(-10 * fraction * 10) / 10,
      netImpact15: Math.round(-15 * fraction * 10) / 10,
    });
  }

  // Sort by worst-case (most negative at 15 pts)
  scenarios.sort((a, b) => a.netImpact15 - b.netImpact15);

  return scenarios;
}

/**
 * Main entry point: run full league analysis.
 */
export function analyzeLeague(
  userPicks: Pick[],
  userStanding: StandingsResult,
  rivals: RivalTeam[],
  leaderTotal: number,
  playerMap: Map<number, Player>,
  teamMap: Map<number, Team>,
): LeagueAnalysis {
  const eo = calculateEffectiveOwnership(userPicks, rivals, playerMap, teamMap);
  const { attack, cover } = identifyDifferentials(userPicks, rivals, playerMap, teamMap);
  const swingScenarios = generateSwingScenarios(userPicks, rivals, playerMap, teamMap);

  // Unique player count (user active picks not owned by any rival)
  const uniquePlayerCount = attack.length;

  // EO coverage: % of high-EO players (>50% EO) that user owns
  const highEO = eo.filter((e) => e.leagueEO >= 50);
  const highEOOwned = highEO.filter((e) => e.userStatus !== 'dont_own');
  const eoCoverage = highEO.length > 0 ? Math.round((highEOOwned.length / highEO.length) * 100) : 100;

  return {
    effectiveOwnership: eo,
    yourDifferentials: attack,
    theirDifferentials: cover,
    rivals,
    swingScenarios,
    userRank: userStanding.rank,
    gapToLeader: leaderTotal - userStanding.total,
    uniquePlayerCount,
    eoCoverage,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function getPositionShort(elementType: number): string {
  const map: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
  return map[elementType] ?? '???';
}
