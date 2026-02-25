/**
 * GW Plan Transfer Tracker
 * Runs on Tuesdays at 7am UTC to track transfer predictions against actuals.
 *
 * For each active transfer prediction (status = 'pending' | 'on_track'):
 * 1. Fetches the player's actual points from the FPL API
 * 2. Updates the gw_actuals JSON with points per GW
 * 3. Recalculates actual_gain_pts
 * 4. Determines new status (pending / on_track / hit / miss)
 * 5. For misses: calls Claude to explain why and stores in tracking_notes
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getActiveTransferPredictions,
  updateTransferActuals,
  type TransferPrediction,
} from "@/lib/db/gw-plan";
import { fplClient } from "@/lib/fpl/client";
import { CLAUDE_CONFIG } from "@/lib/claude/client";
import { getAnthropicApiKey } from "@/lib/db/settings";

// ---------------------------------------------------------------------------
// Pure calculation logic (exported for unit tests)
// ---------------------------------------------------------------------------

export interface TrackingInput {
  predictedGainPts: number;
  gwActuals: Record<string, number>;
  gameweekMade: number;
}

export interface TrackingResult {
  status: TransferPrediction["status"];
  actualGainPts: number;
}

/**
 * Determine status and actualGainPts from prediction data and current GW.
 *
 * Rules:
 * - gwsPlayed  < 2             → pending
 * - gwsPlayed >= 4             → hit (actual >= 80% predicted) or miss
 * - gwsPlayed in [2, 3]        → miss if actual < 80% of proportional target, else on_track
 *
 * "Proportional target" at N GWs = (N / 4) * predictedGainPts
 */
export function calculateTrackingStatus(
  prediction: TrackingInput,
  currentGw: number,
): TrackingResult {
  const { predictedGainPts, gwActuals, gameweekMade } = prediction;

  // Count GWs that have been played since the transfer was made
  const gwsPlayed = Object.keys(gwActuals).filter(
    (gw) => Number(gw) > gameweekMade && Number(gw) <= currentGw,
  ).length;

  // Sum all actual points recorded
  const actualGainPts = Object.values(gwActuals).reduce(
    (sum, pts) => sum + pts,
    0,
  );

  if (gwsPlayed < 2) {
    return { status: "pending", actualGainPts };
  }

  if (gwsPlayed >= 4) {
    const threshold = predictedGainPts * 0.8;
    return {
      status: actualGainPts >= threshold ? "hit" : "miss",
      actualGainPts,
    };
  }

  // 2–3 GWs played: compare against proportional target
  const proportionalTarget = (gwsPlayed / 4) * predictedGainPts;
  const threshold = proportionalTarget * 0.8;

  return {
    status: actualGainPts < threshold ? "miss" : "on_track",
    actualGainPts,
  };
}

// ---------------------------------------------------------------------------
// Claude miss explanation
// ---------------------------------------------------------------------------

async function getMissExplanation(
  prediction: TransferPrediction,
  gwActuals: Record<string, number>,
  actualGainPts: number,
  gwsPlayed: number,
): Promise<string | null> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: CLAUDE_CONFIG.MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content:
            `FPL transfer prediction miss: ${prediction.playerInName} was predicted to gain ` +
            `${prediction.predictedGainPts} pts over 4 GWs but has only scored ${actualGainPts} pts ` +
            `after ${gwsPlayed} GWs. GW breakdown: ${JSON.stringify(gwActuals)}. ` +
            `In 2-3 sentences, explain why this transfer may be underperforming.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : null;
  } catch (error) {
    console.error(
      `[gw-plan-tracker] Claude miss explanation failed for ${prediction.id}:`,
      error,
    );
    return `${prediction.playerInName} underperformed vs prediction of ${prediction.predictedGainPts} pts gain.`;
  }
}

// ---------------------------------------------------------------------------
// Main scheduler job
// ---------------------------------------------------------------------------

/**
 * Track GW plan transfer predictions against actuals.
 * Called on Tuesdays at 7am UTC by the scheduler.
 *
 * @param currentGw - The current gameweek number (injected for testability)
 */
export async function trackGwPlanPredictions(currentGw: number): Promise<void> {
  console.log(
    `[gw-plan-tracker] Starting tracking job for GW ${currentGw} at`,
    new Date().toISOString(),
  );

  const predictions = getActiveTransferPredictions();

  if (predictions.length === 0) {
    console.log("[gw-plan-tracker] No active predictions to track.");
    return;
  }

  console.log(
    `[gw-plan-tracker] Processing ${predictions.length} active prediction(s).`,
  );

  for (const prediction of predictions) {
    try {
      // Fetch player's actual points history from FPL API
      const summary = await fplClient.getElementSummary(prediction.playerInId);

      // Build gwActuals: only include rounds after the transfer was made and up to currentGw
      const gwActuals: Record<string, number> = {};
      for (const entry of summary.history) {
        if (entry.round > prediction.gameweekMade && entry.round <= currentGw) {
          gwActuals[String(entry.round)] = entry.total_points;
        }
      }

      const actualGainPts = Object.values(gwActuals).reduce(
        (sum, pts) => sum + pts,
        0,
      );

      const { status } = calculateTrackingStatus(
        {
          predictedGainPts: prediction.predictedGainPts,
          gwActuals,
          gameweekMade: prediction.gameweekMade,
        },
        currentGw,
      );

      // For misses: ask Claude to explain
      let trackingNotes: string | null = null;
      if (status === "miss") {
        const gwsPlayed = Object.keys(gwActuals).filter(
          (gw) => Number(gw) > prediction.gameweekMade,
        ).length;
        trackingNotes = await getMissExplanation(
          prediction,
          gwActuals,
          actualGainPts,
          gwsPlayed,
        );
      }

      updateTransferActuals(
        prediction.id,
        gwActuals,
        actualGainPts,
        status,
        trackingNotes,
      );

      console.log(
        `[gw-plan-tracker] Updated prediction ${prediction.id}: ` +
          `${prediction.playerInName} → status=${status}, actual=${actualGainPts}pts`,
      );
    } catch (error) {
      // Per-prediction error handling — don't fail the whole job
      console.error(
        `[gw-plan-tracker] Error processing prediction ${prediction.id}:`,
        error,
      );
    }
  }

  console.log("[gw-plan-tracker] Tracking job complete.");
}
