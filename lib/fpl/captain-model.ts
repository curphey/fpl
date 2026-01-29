import type { Fixture } from "./types";
import type { EnrichedPlayer } from "./utils";
import { getPlayerForm, getPlayerXGI } from "./utils";

// =============================================================================
// Scoring Constants
// =============================================================================

/** Weights for captain scoring model (must sum to 1.0) */
const CAPTAIN_WEIGHTS = {
  FORM: 0.35, // Recent performance
  FIXTURE: 0.25, // Fixture difficulty (easier = better)
  XGI: 0.2, // Expected goal involvement
  HOME_ADVANTAGE: 0.1, // Home players get a bump
  SET_PIECES: 0.1, // Penalty/FK/corner takers
} as const;

/** Points for set piece duties */
const SET_PIECE_POINTS = {
  PRIMARY_PENALTY: 5,
  SECONDARY_PENALTY: 2,
  DIRECT_FREEKICK: 2,
  CORNERS: 1,
} as const;

/** Maximum possible set piece score (used for normalization) */
const MAX_SET_PIECE_SCORE =
  SET_PIECE_POINTS.PRIMARY_PENALTY +
  SET_PIECE_POINTS.DIRECT_FREEKICK +
  SET_PIECE_POINTS.CORNERS;

/** Minimum minutes to consider a player for captaincy */
const MIN_MINUTES_THRESHOLD = 90;

/** Ownership threshold for safe vs differential */
const SAFE_OWNERSHIP_THRESHOLD = 15;

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
  category: "safe" | "differential";
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
    (f) => f.event === gwId && (f.team_h === teamId || f.team_a === teamId),
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
  if (player.penalties_order !== null && player.penalties_order <= 1) {
    score += SET_PIECE_POINTS.PRIMARY_PENALTY;
  } else if (player.penalties_order !== null && player.penalties_order <= 2) {
    score += SET_PIECE_POINTS.SECONDARY_PENALTY;
  }
  if (
    player.direct_freekicks_order !== null &&
    player.direct_freekicks_order <= 1
  ) {
    score += SET_PIECE_POINTS.DIRECT_FREEKICK;
  }
  if (
    player.corners_and_indirect_freekicks_order !== null &&
    player.corners_and_indirect_freekicks_order <= 1
  ) {
    score += SET_PIECE_POINTS.CORNERS;
  }
  return score;
}

/**
 * Build captain recommendations for a given gameweek.
 * See CAPTAIN_WEIGHTS for model weight configuration.
 */
export function scoreCaptainOptions(
  players: EnrichedPlayer[],
  fixtures: Fixture[],
  teamMap: Map<number, { short_name: string }>,
  gwId: number,
): CaptainPick[] {
  const maxForm = Math.max(...players.map((p) => getPlayerForm(p)), 1);
  const maxXGI = Math.max(...players.map((p) => getPlayerXGI(p)), 0.1);

  return players
    .filter((p) => p.minutes > MIN_MINUTES_THRESHOLD)
    .map((player) => {
      const fix = getNextFixture(player.team, fixtures, gwId);
      if (!fix) return null;

      const opponent = teamMap.get(fix.opponentId);
      const form = getPlayerForm(player);
      const xgi = getPlayerXGI(player);
      const setPiece = getSetPieceScore(player);

      // Normalize scores to 0-10 scale
      const formScore = (form / maxForm) * 10;
      const fixtureScore = ((5 - fix.difficulty) / 4) * 10;
      const xgiScore = (xgi / maxXGI) * 10;
      const homeBonus = fix.isHome ? 10 : 0;
      const setPieceScore = (setPiece / MAX_SET_PIECE_SCORE) * 10;

      // Apply weights
      const score =
        formScore * CAPTAIN_WEIGHTS.FORM +
        fixtureScore * CAPTAIN_WEIGHTS.FIXTURE +
        xgiScore * CAPTAIN_WEIGHTS.XGI +
        homeBonus * CAPTAIN_WEIGHTS.HOME_ADVANTAGE +
        setPieceScore * CAPTAIN_WEIGHTS.SET_PIECES;

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
        opponentShortName: opponent?.short_name ?? "???",
        difficulty: fix.difficulty,
        category: (ownership >= SAFE_OWNERSHIP_THRESHOLD
          ? "safe"
          : "differential") as "safe" | "differential",
      };
    })
    .filter((x): x is CaptainPick => x !== null)
    .sort((a, b) => b.score - a.score);
}
