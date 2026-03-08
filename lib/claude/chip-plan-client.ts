/**
 * Claude AI client for Chip Plan generation (Wildcard / Free Hit)
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_CONFIG } from "./client";
import { getAnthropicApiKey } from "@/lib/db/settings";

// =============================================================================
// Types
// =============================================================================

export interface ChipPlanCurrentPlayer {
  id: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  sellingPrice: number; // £m
}

export interface ChipPlanCandidate {
  id: number;
  name: string;
  team: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  cost: number; // buying cost in £m
  predictedNextGW: number;
  predicted4GW: number;
  form: string;
  upcomingDifficulty: number;
}

export interface ChipPlanCandidatesByPosition {
  GK: ChipPlanCandidate[];
  DEF: ChipPlanCandidate[];
  MID: ChipPlanCandidate[];
  FWD: ChipPlanCandidate[];
}

export interface ChipPlanRequest {
  chipType: "wildcard" | "freehit";
  gameweek: number;
  budget: number; // total squad value in 0.1m units (selling prices + bank)
  currentSquad: ChipPlanCurrentPlayer[];
  candidates: ChipPlanCandidatesByPosition;
}

export interface ChipPlanSquadPlayer {
  id: number;
  name: string;
  cost: number; // £m
}

export interface ChipPlanSquad {
  GK: ChipPlanSquadPlayer[];
  DEF: ChipPlanSquadPlayer[];
  MID: ChipPlanSquadPlayer[];
  FWD: ChipPlanSquadPlayer[];
}

export interface ChipPlanRawResult {
  predictedTeamPoints: number;
  squad: ChipPlanSquad;
  startingXI: number[]; // 11 player IDs
  benchOrder: number[]; // 4 player IDs, GK bench last
  captain: { playerId: number; name: string; reasoning: string };
  formation?: string;
  formationReasoning?: string;
  notes: string;
}

export interface ChipPlanResponse {
  thinking: string;
  result: ChipPlanRawResult;
  processingTime: number;
}

// =============================================================================
// Prompt Builder
// =============================================================================

const CHIP_PLAN_SYSTEM_PROMPT = `You are an expert Fantasy Premier League analyst specialising in chip strategy. Your role is to select the optimal 15-player squad when a chip is activated.

Rules you MUST follow:
1. Pick EXACTLY: 2 GK, 5 DEF, 5 MID, 3 FWD
2. Maximum 3 players from any single club
3. Total cost of all 15 players MUST be ≤ the stated budget
4. Wildcard — optimise for predicted4GW (strongest 4-gameweek horizon)
5. Free Hit — optimise for predictedNextGW (next gameweek only; squad reverts automatically)
6. Output the starting XI (11 players) and bench order (4 players). Bench GK goes last in benchOrder.
7. Point values in text: always round to whole numbers. Write "19 points" not "19.2 points".
8. Reasoning: frame all reasoning in terms of predicted future performance — fixtures, predicted points, form. Do NOT make definitive claims about past results.

Always respond with valid JSON matching the schema exactly.`;

export function buildChipPlanPrompt(req: ChipPlanRequest): string {
  const chipLabel = req.chipType === "wildcard" ? "WILDCARD" : "FREE HIT";
  const optimiseFor =
    req.chipType === "wildcard"
      ? "predicted4GW (optimise for the best 4 gameweek horizon)"
      : "predictedNextGW (single gameweek only — squad reverts after this gameweek)";

  const budgetMillion = (req.budget / 10).toFixed(1);

  const formatCandidate = (c: ChipPlanCandidate) =>
    `[${c.id}] ${c.name} (${c.team}) £${c.cost.toFixed(1)}m — Next GW: ${c.predictedNextGW}pts, 4 GW: ${c.predicted4GW}pts, Form: ${c.form}, Difficulty: ${c.upcomingDifficulty}`;

  const currentSquadStr = req.currentSquad
    .map(
      (p) =>
        `[${p.id}] ${p.name} (${p.position}) £${p.sellingPrice.toFixed(1)}m selling price`,
    )
    .join("\n");

  const candidatesStr = (["GK", "DEF", "MID", "FWD"] as const)
    .map(
      (pos) =>
        `### ${pos}\n${req.candidates[pos].map(formatCandidate).join("\n") || "(none available)"}`,
    )
    .join("\n\n");

  return `Build the optimal GW${req.gameweek} squad for a ${chipLabel} chip activation.

Optimise for: ${optimiseFor}

## Budget
Total available: £${budgetMillion}m (sum of all 15 current selling prices + bank balance)
You MUST select 15 players whose combined cost is ≤ £${budgetMillion}m.

## Current Squad (for context — you are replacing ALL of these)
${currentSquadStr}

## Available Players by Position
${candidatesStr}

Respond with JSON matching this schema exactly:
{
  "predictedTeamPoints": <number — estimated total team score for GW${req.gameweek}>,
  "squad": {
    "GK":  [{"id": <number>, "name": "<string>", "cost": <number>}, {"id": <number>, "name": "<string>", "cost": <number>}],
    "DEF": [5 players with same shape],
    "MID": [5 players with same shape],
    "FWD": [3 players with same shape]
  },
  "startingXI": [<11 player IDs>],
  "benchOrder": [<4 player IDs — GK bench LAST>],
  "captain": {
    "playerId": <number>,
    "name": "<string>",
    "reasoning": "<1-2 sentence explanation>"
  },
  "formation": "<DEF-MID-FWD formation e.g. '4-3-3', '3-5-2'>",
  "formationReasoning": "<1-2 sentence explanation of why this formation suits the upcoming fixtures>",
  "notes": "<any additional strategic notes>"
}`;
}

// =============================================================================
// Response Parser
// =============================================================================

const EMPTY_RESULT: ChipPlanRawResult = {
  predictedTeamPoints: 0,
  squad: { GK: [], DEF: [], MID: [], FWD: [] },
  startingXI: [],
  benchOrder: [],
  captain: { playerId: 0, name: "Unknown", reasoning: "Parse error" },
  formation: undefined,
  formationReasoning: undefined,
  notes: "Parse error — see raw response",
};

export function parseChipPlanResult(text: string): ChipPlanRawResult {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() || text.trim();

  try {
    const parsed = JSON.parse(jsonStr) as Partial<ChipPlanRawResult>;
    return {
      predictedTeamPoints: parsed.predictedTeamPoints ?? 0,
      squad: {
        GK: parsed.squad?.GK ?? [],
        DEF: parsed.squad?.DEF ?? [],
        MID: parsed.squad?.MID ?? [],
        FWD: parsed.squad?.FWD ?? [],
      },
      startingXI: parsed.startingXI ?? [],
      benchOrder: parsed.benchOrder ?? [],
      captain: parsed.captain ?? {
        playerId: 0,
        name: "Unknown",
        reasoning: "",
      },
      formation: parsed.formation ?? undefined,
      formationReasoning: parsed.formationReasoning ?? undefined,
      notes: parsed.notes ?? "",
    };
  } catch {
    return EMPTY_RESULT;
  }
}

// =============================================================================
// API Client
// =============================================================================

export async function generateChipPlan(
  req: ChipPlanRequest,
): Promise<ChipPlanResponse> {
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
    system: CHIP_PLAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildChipPlanPrompt(req) }],
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

  const result = parseChipPlanResult(text);

  return {
    thinking,
    result,
    processingTime: Date.now() - startTime,
  };
}
