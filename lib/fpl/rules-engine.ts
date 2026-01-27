import type { PlayerPosition } from './types';
import type { EnrichedPlayer } from './utils';

// =============================================================================
// Squad Composition Rules
// =============================================================================

/** Standard FPL squad structure */
export const SQUAD_SIZE = 15;
export const SQUAD_BUDGET = 1000; // £100.0m in API units
export const MAX_PER_TEAM = 3;

export const POSITION_LIMITS: Record<PlayerPosition, { min: number; max: number }> = {
  1: { min: 2, max: 2 },   // GK
  2: { min: 5, max: 5 },   // DEF
  3: { min: 5, max: 5 },   // MID
  4: { min: 3, max: 3 },   // FWD
};

/** Valid starting XI formations: [DEF, MID, FWD] (GK always 1) */
export const VALID_FORMATIONS: [number, number, number][] = [
  [3, 4, 3],
  [3, 5, 2],
  [4, 3, 3],
  [4, 4, 2],
  [4, 5, 1],
  [5, 2, 3],
  [5, 3, 2],
  [5, 4, 1],
];

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

// =============================================================================
// Squad Validation
// =============================================================================

/**
 * Validate a full 15-player squad against FPL rules.
 */
export function validateSquad(
  squad: EnrichedPlayer[],
  budget?: number,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Size check
  if (squad.length !== SQUAD_SIZE) {
    errors.push({
      code: 'SQUAD_SIZE',
      message: `Squad must have ${SQUAD_SIZE} players (currently ${squad.length})`,
    });
  }

  // Position counts
  const posCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of squad) {
    posCounts[p.element_type] = (posCounts[p.element_type] || 0) + 1;
  }

  for (const [pos, limits] of Object.entries(POSITION_LIMITS)) {
    const count = posCounts[Number(pos)] || 0;
    if (count < limits.min || count > limits.max) {
      errors.push({
        code: 'POSITION_COUNT',
        message: `Need exactly ${limits.min} ${posLabel(Number(pos) as PlayerPosition)} (have ${count})`,
      });
    }
  }

  // Max per team
  const teamCounts = new Map<number, number>();
  for (const p of squad) {
    teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
  }
  for (const [teamId, count] of teamCounts) {
    if (count > MAX_PER_TEAM) {
      const teamName = squad.find((p) => p.team === teamId)?.team_short_name ?? String(teamId);
      errors.push({
        code: 'TEAM_LIMIT',
        message: `Max ${MAX_PER_TEAM} players per team — ${teamName} has ${count}`,
      });
    }
  }

  // Budget
  const totalCost = squad.reduce((sum, p) => sum + p.now_cost, 0);
  const maxBudget = budget ?? SQUAD_BUDGET;
  if (totalCost > maxBudget) {
    errors.push({
      code: 'BUDGET',
      message: `Squad costs £${(totalCost / 10).toFixed(1)}m — budget is £${(maxBudget / 10).toFixed(1)}m`,
    });
  }

  // Duplicate players
  const ids = new Set<number>();
  for (const p of squad) {
    if (ids.has(p.id)) {
      errors.push({ code: 'DUPLICATE', message: `Duplicate player: ${p.web_name}` });
    }
    ids.add(p.id);
  }

  // Warnings: injured / doubtful players
  for (const p of squad) {
    if (p.status === 'i' || p.status === 's' || p.status === 'u') {
      warnings.push({
        code: 'UNAVAILABLE',
        message: `${p.web_name} is ${p.status === 'i' ? 'injured' : p.status === 's' ? 'suspended' : 'unavailable'}`,
      });
    } else if (p.status === 'd') {
      warnings.push({
        code: 'DOUBTFUL',
        message: `${p.web_name} is doubtful (${p.chance_of_playing_next_round ?? '?'}% chance)`,
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// Formation Validation
// =============================================================================

/**
 * Check if a starting XI formation is valid.
 * Expects 11 players: 1 GK + valid DEF/MID/FWD combo.
 */
export function validateFormation(startingXI: EnrichedPlayer[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (startingXI.length !== 11) {
    errors.push({
      code: 'XI_SIZE',
      message: `Starting XI must have 11 players (currently ${startingXI.length})`,
    });
    return { valid: false, errors, warnings };
  }

  const gkCount = startingXI.filter((p) => p.element_type === 1).length;
  const defCount = startingXI.filter((p) => p.element_type === 2).length;
  const midCount = startingXI.filter((p) => p.element_type === 3).length;
  const fwdCount = startingXI.filter((p) => p.element_type === 4).length;

  if (gkCount !== 1) {
    errors.push({
      code: 'GK_COUNT',
      message: `Starting XI must have exactly 1 GK (currently ${gkCount})`,
    });
  }

  const isValid = VALID_FORMATIONS.some(
    ([d, m, f]) => d === defCount && m === midCount && f === fwdCount,
  );

  if (!isValid) {
    errors.push({
      code: 'INVALID_FORMATION',
      message: `${defCount}-${midCount}-${fwdCount} is not a valid formation`,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Get the formation label for a starting XI (e.g. "4-4-2").
 */
export function getFormationLabel(startingXI: EnrichedPlayer[]): string {
  const def = startingXI.filter((p) => p.element_type === 2).length;
  const mid = startingXI.filter((p) => p.element_type === 3).length;
  const fwd = startingXI.filter((p) => p.element_type === 4).length;
  return `${def}-${mid}-${fwd}`;
}

// =============================================================================
// Transfer Cost Calculation
// =============================================================================

export interface TransferCostResult {
  freeTransfers: number;
  transfersMade: number;
  extraTransfers: number;
  hitCost: number;
  netPointsCost: number;
}

/**
 * Calculate the points cost for transfers.
 * Each extra transfer beyond the free allowance costs 4 points.
 */
export function calculateTransferCost(
  freeTransfers: number,
  transfersMade: number,
): TransferCostResult {
  const extraTransfers = Math.max(0, transfersMade - freeTransfers);
  const hitCost = extraTransfers * 4;

  return {
    freeTransfers,
    transfersMade,
    extraTransfers,
    hitCost,
    netPointsCost: hitCost,
  };
}

/**
 * Calculate free transfers for next gameweek.
 * Rolls over unused free transfers (max 5 banked in current rules).
 */
export function calculateNextFreeTransfers(
  currentFree: number,
  transfersMade: number,
): number {
  if (transfersMade > 0) {
    // Used transfers: start fresh with 1, but unused ones don't carry over
    const remaining = Math.max(currentFree - transfersMade, 0);
    return Math.min(remaining + 1, 5);
  }
  // No transfers made: bank one more (up to max 5)
  return Math.min(currentFree + 1, 5);
}

// =============================================================================
// Chip Rules
// =============================================================================

export type ChipType = 'wildcard' | 'freehit' | '3xc' | 'bboost';

export interface ChipInfo {
  name: ChipType;
  label: string;
  description: string;
}

export const CHIPS: ChipInfo[] = [
  {
    name: 'wildcard',
    label: 'Wildcard',
    description: 'Make unlimited free transfers for one gameweek. Two available per season (one each half).',
  },
  {
    name: 'freehit',
    label: 'Free Hit',
    description: 'Make unlimited transfers for one gameweek only. Squad reverts the following gameweek.',
  },
  {
    name: '3xc',
    label: 'Triple Captain',
    description: "Your captain scores triple points instead of double.",
  },
  {
    name: 'bboost',
    label: 'Bench Boost',
    description: "All bench players' points count for this gameweek.",
  },
];

/**
 * Check which chips are still available given the ones already used.
 */
export function getAvailableChips(
  usedChips: { name: string; event: number }[],
  currentGw: number,
): ChipInfo[] {
  const usedNames = new Set(usedChips.map((c) => c.name));

  return CHIPS.filter((chip) => {
    if (chip.name === 'wildcard') {
      // Two wildcards: first half (GW1-19) and second half (GW20-38)
      const wcUsed = usedChips.filter((c) => c.name === 'wildcard');
      const firstHalfUsed = wcUsed.some((c) => c.event <= 19);
      const secondHalfUsed = wcUsed.some((c) => c.event >= 20);

      if (currentGw <= 19) return !firstHalfUsed;
      return !secondHalfUsed;
    }

    return !usedNames.has(chip.name);
  });
}

// =============================================================================
// Auto-Sub Simulation
// =============================================================================

/**
 * Simulate auto-substitutions based on FPL rules.
 * Returns the final XI after subs, maintaining valid formation.
 */
export function simulateAutoSubs(
  startingXI: EnrichedPlayer[],
  bench: EnrichedPlayer[],
  didNotPlay: Set<number>,
): { finalXI: EnrichedPlayer[]; subsIn: number[]; subsOut: number[] } {
  const finalXI = [...startingXI];
  const subsIn: number[] = [];
  const subsOut: number[] = [];

  // Process bench in order (bench is already sorted by priority)
  for (const benchPlayer of bench) {
    if (didNotPlay.has(benchPlayer.id)) continue;

    // Find a player in the XI who didn't play
    for (let i = 0; i < finalXI.length; i++) {
      if (!didNotPlay.has(finalXI[i].id)) continue;

      // Check if swapping maintains a valid formation
      const testXI = [...finalXI];
      testXI[i] = benchPlayer;

      const { valid } = validateFormation(testXI);
      if (valid) {
        subsOut.push(finalXI[i].id);
        subsIn.push(benchPlayer.id);
        finalXI[i] = benchPlayer;
        break;
      }
    }
  }

  return { finalXI, subsIn, subsOut };
}

// =============================================================================
// Helpers
// =============================================================================

function posLabel(pos: PlayerPosition): string {
  const labels: Record<PlayerPosition, string> = {
    1: 'goalkeepers',
    2: 'defenders',
    3: 'midfielders',
    4: 'forwards',
  };
  return labels[pos];
}
