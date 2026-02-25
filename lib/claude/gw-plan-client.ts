/**
 * Claude AI client for GW Plan generation
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_CONFIG } from "./client";
import type { GwPlanResult } from "@/lib/db/gw-plan";
import { getAnthropicApiKey } from "@/lib/db/settings";

// =============================================================================
// Types
// =============================================================================

export interface GwPlanSquadPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
  predictedPtsNextGW: number;
  predicted4GW: number;
  form: string;
  upcomingDifficulty: number;
  /** Current selling price in £m, e.g. 12.5 */
  sellingPrice: number;
}

export interface GwPlanTarget {
  id: number;
  name: string;
  team: string;
  position: string;
  score: number;
  predicted4GW: number;
  form: string;
  upcomingDifficulty: number;
  /** Current buying cost in £m, e.g. 10.5 */
  cost: number;
}

export interface GwPlanCaptainOption {
  id: number;
  name: string;
  score: number;
  opponentShortName: string;
  isHome: boolean;
}

export interface GwPlanRequest {
  gameweek: number;
  squad: GwPlanSquadPlayer[];
  freeTransfers: number;
  bank: number; // in 0.1m units
  topTargets: GwPlanTarget[];
  captainOptions: GwPlanCaptainOption[];
}

export interface GwPlanResponse {
  thinking: string;
  plan: GwPlanResult;
  processingTime: number;
}

// =============================================================================
// Prompt Builder
// =============================================================================

const GW_PLAN_SYSTEM_PROMPT = `You are an expert Fantasy Premier League analyst. Your role is to create a concise, actionable gameweek plan for a manager including captain pick, transfer recommendations, and predicted team points.

Key principles:
1. Prioritise players with good upcoming fixtures and strong form
2. Consider the cost of transfers (4-point hit) vs. the expected gain
3. Recommend the captain with the highest ceiling for the gameweek
4. CRITICAL: Only recommend affordable transfers. A transfer is affordable only if the selling price of the player out + bank balance >= cost of player in. Never recommend a transfer the manager cannot afford.

Always respond with valid JSON matching the expected schema.`;

export function buildGwPlanPrompt(req: GwPlanRequest): string {
  const squadStr = req.squad
    .map(
      (p) =>
        `${p.name} (${p.position}, ${p.team}) £${p.sellingPrice.toFixed(1)}m — Next GW: ${p.predictedPtsNextGW}pts, 4GW: ${p.predicted4GW}pts, Form: ${p.form}, Difficulty: ${p.upcomingDifficulty}`,
    )
    .join("\n");

  const targetsStr = req.topTargets
    .map(
      (t) =>
        `${t.name} (${t.position}, ${t.team}) £${t.cost.toFixed(1)}m — Score: ${t.score}, 4GW: ${t.predicted4GW}pts, Form: ${t.form}, Difficulty: ${t.upcomingDifficulty}`,
    )
    .join("\n");

  const captainStr = req.captainOptions
    .map(
      (c) =>
        `${c.name} — Score: ${c.score}, vs ${c.opponentShortName} (${c.isHome ? "H" : "A"})`,
    )
    .join("\n");

  const bankStr = `£${(req.bank / 10).toFixed(1)}m`;

  return `Create a GW${req.gameweek} plan for this FPL manager.

## Current Squad
Player selling prices are shown (£Xm) — this is what you would receive when selling them.
${squadStr}

## Transfer Budget
Free Transfers: ${req.freeTransfers}
Bank: ${bankStr}
Note: A transfer is only affordable if the selling price of the player out + bank >= cost of player in.

## Top Transfer Targets (pre-filtered to affordable options only)
Target costs are shown (£Xm) — all listed targets are affordable for at least one squad player.
${targetsStr}

## Captain Options
${captainStr}

Based on this data, produce the optimal GW${req.gameweek} plan.

Respond with JSON matching this schema exactly:
{
  "predictedTeamPoints": <number — estimated total team score for GW${req.gameweek}>,
  "captain": {
    "playerId": <number>,
    "name": "<string>",
    "reasoning": "<1-2 sentence explanation>"
  },
  "transfers": [
    {
      "playerOut": { "id": <number>, "name": "<string>", "predicted4GW": <number> },
      "playerIn": { "id": <number>, "name": "<string>", "predicted4GW": <number> },
      "pointsGain": <number — net gain over 4 GWs after hit cost if applicable>,
      "reasoning": "<1-2 sentence explanation>"
    }
  ],
  "notes": "<any additional strategic notes, chip suggestions, or warnings>"
}`;
}

// =============================================================================
// Response Parser
// =============================================================================

export function parseGwPlanResult(text: string): GwPlanResult {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() || text.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      predictedTeamPoints: parsed.predictedTeamPoints ?? 0,
      captain: parsed.captain ?? {
        playerId: 0,
        name: "Unknown",
        reasoning: "Unable to parse captain",
      },
      transfers: parsed.transfers ?? [],
      notes: parsed.notes ?? "",
    };
  } catch {
    return {
      predictedTeamPoints: 0,
      captain: {
        playerId: 0,
        name: "Unknown",
        reasoning: text,
      },
      transfers: [],
      notes: "Parse error — see raw response",
    };
  }
}

// =============================================================================
// API Client
// =============================================================================

export async function generateGwPlan(
  req: GwPlanRequest,
): Promise<GwPlanResponse> {
  const startTime = Date.now();

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      "Anthropic API key not configured. Please add your API key in Settings.",
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_CONFIG.MODEL,
    max_tokens: 12000,
    thinking: {
      type: "enabled",
      budget_tokens: 8000,
    },
    system: GW_PLAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildGwPlanPrompt(req) }],
  });

  let thinking = "";
  let text = "";

  for (const block of response.content) {
    if (block.type === "thinking") {
      thinking = block.thinking;
    } else if (block.type === "text") {
      text = block.text;
    }
  }

  const plan = parseGwPlanResult(text);

  return {
    thinking,
    plan,
    processingTime: Date.now() - startTime,
  };
}
