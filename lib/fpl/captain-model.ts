import type { Fixture } from './types';
import type { EnrichedPlayer } from './utils';
import { getPlayerForm, getPlayerXGI } from './utils';

export interface CaptainPick {
  player: EnrichedPlayer;
  score: number;
  formScore: number;
  fixtureScore: number;
  xgiScore: number;
  homeBonus: number;
  setPieceScore: number;
  isHome: boolean;
  opponentShortName: string;
  difficulty: number;
  category: 'safe' | 'differential';
}

/**
 * Find the next fixture for a given team in a specific gameweek.
 */
function getNextFixture(
  teamId: number,
  fixtures: Fixture[],
  gwId: number,
): { difficulty: number; isHome: boolean; opponentId: number } | null {
  const match = fixtures.find(
    (f) =>
      f.event === gwId && (f.team_h === teamId || f.team_a === teamId),
  );
  if (!match) return null;

  if (match.team_h === teamId) {
    return {
      difficulty: match.team_h_difficulty,
      isHome: true,
      opponentId: match.team_a,
    };
  }
  return {
    difficulty: match.team_a_difficulty,
    isHome: false,
    opponentId: match.team_h,
  };
}

/**
 * Score for set-piece involvement.
 * Players on penalties / free kicks / corners score higher.
 */
function getSetPieceScore(player: EnrichedPlayer): number {
  let score = 0;
  if (player.penalties_order !== null && player.penalties_order <= 1) score += 5;
  else if (player.penalties_order !== null && player.penalties_order <= 2) score += 2;
  if (player.direct_freekicks_order !== null && player.direct_freekicks_order <= 1) score += 2;
  if (player.corners_and_indirect_freekicks_order !== null && player.corners_and_indirect_freekicks_order <= 1) score += 1;
  return score;
}

/**
 * Build captain recommendations for a given gameweek.
 *
 * Model weights:
 *   - Form (35%): recent performance
 *   - Fixture (25%): easier = better
 *   - xGI (20%): expected goal involvement
 *   - Home advantage (10%): home players get a bump
 *   - Set pieces (10%): penalty/FK takers
 */
export function scoreCaptainOptions(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  teamMap: Map<number, { short_name: string }>,
  gwId: number,
): CaptainPick[] {
  const maxForm = Math.max(...players.map((p) => getPlayerForm(p)), 1);
  const maxXGI = Math.max(...players.map((p) => getPlayerXGI(p)), 0.1);
  const maxSetPiece = 8; // max possible: pen(5) + fk(2) + corner(1)

  return players
    .filter((p) => p.minutes > 90) // must have meaningful minutes
    .map((player) => {
      const fix = getNextFixture(player.team, fixtures, gwId);
      if (!fix) return null;

      const opponent = teamMap.get(fix.opponentId);
      const form = getPlayerForm(player);
      const xgi = getPlayerXGI(player);
      const setPiece = getSetPieceScore(player);

      const formScore = (form / maxForm) * 10;
      const fixtureScore = ((5 - fix.difficulty) / 4) * 10;
      const xgiScore = (xgi / maxXGI) * 10;
      const homeBonus = fix.isHome ? 10 : 0;
      const setPieceScore = (setPiece / maxSetPiece) * 10;

      const score =
        formScore * 0.35 +
        fixtureScore * 0.25 +
        xgiScore * 0.2 +
        homeBonus * 0.1 +
        setPieceScore * 0.1;

      const ownership = parseFloat(player.selected_by_percent) || 0;

      return {
        player,
        score,
        formScore,
        fixtureScore,
        xgiScore,
        homeBonus,
        setPieceScore,
        isHome: fix.isHome,
        opponentShortName: opponent?.short_name ?? '???',
        difficulty: fix.difficulty,
        category: (ownership >= 15 ? 'safe' : 'differential') as 'safe' | 'differential',
      };
    })
    .filter((x): x is CaptainPick => x !== null)
    .sort((a, b) => b.score - a.score);
}
