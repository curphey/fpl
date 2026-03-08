import { randomUUID } from "crypto";
import { db } from "./client";

export interface GwPlanResult {
  predictedTeamPoints: number;
  captain: {
    playerId: number;
    name: string;
    reasoning: string;
  };
  transfers: Array<{
    playerOut: { id: number; name: string; predicted4GW: number };
    playerIn: { id: number; name: string; predicted4GW: number };
    pointsGain: number;
    /** Points deducted for this transfer (0 = within free transfers, 4 = one hit, 8 = two hits) */
    hitCost: number;
    reasoning: string;
  }>;
  /**
   * Bench order and substitution advice.
   * @deprecated Use `substitutions` instead. Kept for backward compatibility with cached plans.
   */
  benchAdvice?: string;
  substitutions: Array<{
    playerOut: { id: number; name: string };
    playerIn: { id: number; name: string };
    reasoning: string;
  }>;
  /** Recommended starting XI and bench order */
  lineupPlan?: {
    startingXI: Array<{
      id: number;
      name: string;
      teamCode?: number;
      elementType?: number;
      predictedPts?: number;
    }>;
    benchOrder: Array<{
      id: number;
      name: string;
      teamCode?: number;
      elementType?: number;
      predictedPts?: number;
    }>;
  };
  /**
   * Full 15-player squad for chip plans (wildcard/freehit), each player
   * marked as new (transferred in) or retained (already in squad).
   * Used for display instead of the artificial swap-pair transfers list.
   */
  chipSquad?: {
    GK: Array<{ id: number; name: string; cost: number; isNew: boolean }>;
    DEF: Array<{ id: number; name: string; cost: number; isNew: boolean }>;
    MID: Array<{ id: number; name: string; cost: number; isNew: boolean }>;
    FWD: Array<{ id: number; name: string; cost: number; isNew: boolean }>;
  };
  /** Predicted points for the current squad over the same period (for chip plan comparison) */
  currentSquadPredictedPoints?: number;
  /** Chip squad's predicted score for the immediate gameweek only */
  predictedNextGwPoints?: number;
  /** Current squad's predicted score for the immediate gameweek only */
  currentSquadNextGwPoints?: number;
  /** Recommended formation e.g. "4-3-3", "3-5-2" */
  formation?: string;
  /** Why this formation was chosen */
  formationReasoning?: string;
  notes: string;
}

export interface GwPlan {
  id: string;
  sessionId: string;
  gameweek: number;
  plan: GwPlanResult;
  thinking: string;
  generatedAt: string;
  chipType?: "wildcard" | "freehit";
}

export interface TransferPrediction {
  id: string;
  sessionId: string;
  gameweekMade: number;
  playerOutId: number;
  playerOutName: string;
  playerInId: number;
  playerInName: string;
  predictedGainPts: number;
  actualGainPts: number | null;
  gwActuals: Record<string, number>;
  status: "pending" | "on_track" | "hit" | "miss";
  reasoning: string;
  trackingNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getGwPlan(sessionId: string, gameweek: number): GwPlan | null {
  const row = db
    .prepare("SELECT * FROM gw_plans WHERE session_id = ? AND gameweek = ?")
    .get(sessionId, gameweek) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToGwPlan(row);
}

export function saveGwPlan(
  sessionId: string,
  gameweek: number,
  plan: GwPlanResult,
  thinking: string,
  chipType?: "wildcard" | "freehit",
): GwPlan {
  const id = randomUUID();
  db.prepare(
    `INSERT OR REPLACE INTO gw_plans (id, session_id, gameweek, plan_json, thinking, chip_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    sessionId,
    gameweek,
    JSON.stringify(plan),
    thinking,
    chipType ?? null,
  );
  return {
    id,
    sessionId,
    gameweek,
    plan,
    thinking,
    generatedAt: new Date().toISOString(),
    chipType,
  };
}

export function getTransferPredictions(
  sessionId: string,
): TransferPrediction[] {
  const rows = db
    .prepare(
      "SELECT * FROM transfer_predictions WHERE session_id = ? ORDER BY gameweek_made DESC",
    )
    .all(sessionId) as Record<string, unknown>[];
  return rows.map(rowToTransferPrediction);
}

export function getActiveTransferPredictions(): TransferPrediction[] {
  const rows = db
    .prepare(
      "SELECT * FROM transfer_predictions WHERE status IN ('pending', 'on_track')",
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToTransferPrediction);
}

export function insertTransferPrediction(
  sessionId: string,
  gameweekMade: number,
  playerOutId: number,
  playerOutName: string,
  playerInId: number,
  playerInName: string,
  predictedGainPts: number,
  reasoning: string,
): TransferPrediction {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO transfer_predictions
     (id, session_id, gameweek_made, player_out_id, player_out_name,
      player_in_id, player_in_name, predicted_gain_pts, gw_actuals, reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    sessionId,
    gameweekMade,
    playerOutId,
    playerOutName,
    playerInId,
    playerInName,
    predictedGainPts,
    "{}",
    reasoning,
  );
  return {
    id,
    sessionId,
    gameweekMade,
    playerOutId,
    playerOutName,
    playerInId,
    playerInName,
    predictedGainPts,
    actualGainPts: null,
    gwActuals: {},
    status: "pending",
    reasoning,
    trackingNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function updateTransferActuals(
  id: string,
  gwActuals: Record<string, number>,
  actualGainPts: number,
  status: TransferPrediction["status"],
  trackingNotes: string | null,
): void {
  db.prepare(
    `UPDATE transfer_predictions
     SET gw_actuals = ?, actual_gain_pts = ?, status = ?, tracking_notes = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  ).run(JSON.stringify(gwActuals), actualGainPts, status, trackingNotes, id);
}

function rowToGwPlan(row: Record<string, unknown>): GwPlan {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    gameweek: row.gameweek as number,
    plan: JSON.parse(row.plan_json as string) as GwPlanResult,
    thinking: (row.thinking as string) ?? "",
    generatedAt: row.generated_at as string,
    chipType: (row.chip_type as "wildcard" | "freehit" | null) ?? undefined,
  };
}

function rowToTransferPrediction(
  row: Record<string, unknown>,
): TransferPrediction {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    gameweekMade: row.gameweek_made as number,
    playerOutId: row.player_out_id as number,
    playerOutName: row.player_out_name as string,
    playerInId: row.player_in_id as number,
    playerInName: row.player_in_name as string,
    predictedGainPts: row.predicted_gain_pts as number,
    actualGainPts: (row.actual_gain_pts as number | null) ?? null,
    gwActuals: JSON.parse((row.gw_actuals as string) ?? "{}") as Record<
      string,
      number
    >,
    status: (row.status as TransferPrediction["status"]) ?? "pending",
    reasoning: (row.reasoning as string) ?? "",
    trackingNotes: (row.tracking_notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function getGwPlanById(id: string, sessionId: string): GwPlan | null {
  const row = db
    .prepare("SELECT * FROM gw_plans WHERE id = ? AND session_id = ?")
    .get(id, sessionId) as Record<string, unknown> | undefined;
  return row ? rowToGwPlan(row) : null;
}
