/**
 * Claude AI client for simulation and analysis features
 */

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_CONFIG } from "./client";
import type {
  SimulationRequest,
  SimulationResponse,
  SimulationResult,
  RivalAnalysisRequest,
  RivalAnalysisResponse,
  RivalPrediction,
  InjuryPredictionRequest,
  InjuryPredictionResponse,
  InjuryPrediction,
} from "./simulator-types";

// =============================================================================
// GW Decision Simulator
// =============================================================================

const SIMULATION_SYSTEM_PROMPT = `You are an expert Fantasy Premier League analyst specializing in decision theory and expected value calculations. Your role is to analyze proposed FPL decisions and predict their impact on rank.

Key principles:
1. Consider effective ownership (EO) when evaluating captain choices
2. Account for the risk/reward tradeoff of differential picks
3. Factor in remaining gameweeks when assessing chip timing
4. Use historical patterns and fixture difficulty in predictions

Always respond with valid JSON matching the expected schema.`;

function buildSimulationPrompt(request: SimulationRequest): string {
  const { squad, action, leagueContext, currentGameweek } = request;

  const squadStr = squad
    .map(
      (p) =>
        `${p.name} (${p.position}, ${p.team}) - xPts: ${p.expectedPoints}, Own: ${p.ownership}%`,
    )
    .join("\n");

  let actionStr = "";
  switch (action.type) {
    case "captain_change":
      actionStr = `Change captain from ${action.from} to ${action.to}`;
      break;
    case "transfer":
      actionStr = `Transfer out ${action.out} for ${action.in} (cost: ${action.cost} pts)`;
      break;
    case "chip":
      actionStr = `Use ${action.chip} chip in GW${action.gameweek}`;
      break;
    case "hold":
      actionStr = `Hold/do nothing: ${action.description}`;
      break;
  }

  const leagueStr = leagueContext
    ? `
League Position: Rank ${leagueContext.rank} of ${leagueContext.totalManagers}
Gap to Leader: ${leagueContext.gapToLeader} points
Gameweeks Remaining: ${leagueContext.gameweeksRemaining}
${leagueContext.rivalCaptains ? `Rival Captains: ${leagueContext.rivalCaptains.join(", ")}` : ""}`
    : "No league context provided";

  return `Analyze this FPL decision for GW${currentGameweek}:

## Current Squad
${squadStr}

## Proposed Action
${actionStr}

## League Context
${leagueStr}

Analyze the expected value of this decision compared to the alternative (doing nothing or the opposite choice).

Respond with JSON:
{
  "expectedRankChange": <number, positive means improvement>,
  "confidenceInterval": { "low": <number>, "high": <number> },
  "winProbability": <0-1, probability this beats the alternative>,
  "riskLevel": "low" | "medium" | "high",
  "reasoning": "<detailed analysis>",
  "keyFactors": ["<factor1>", "<factor2>", ...],
  "alternatives": [{ "action": "<description>", "expectedValue": <number> }]
}`;
}

export async function simulateDecision(
  request: SimulationRequest,
): Promise<SimulationResponse> {
  const startTime = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_CONFIG.MODEL,
    max_tokens: 4000,
    thinking: {
      type: "enabled",
      budget_tokens: 8000,
    },
    system: SIMULATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildSimulationPrompt(request) }],
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

  const result = parseSimulationResult(text);

  return {
    thinking,
    result,
    processingTime: Date.now() - startTime,
  };
}

function parseSimulationResult(text: string): SimulationResult {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() || text.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      expectedRankChange: parsed.expectedRankChange ?? 0,
      confidenceInterval: parsed.confidenceInterval ?? { low: 0, high: 0 },
      winProbability: parsed.winProbability ?? 0.5,
      riskLevel: parsed.riskLevel ?? "medium",
      reasoning: parsed.reasoning ?? "Unable to parse reasoning",
      keyFactors: parsed.keyFactors ?? [],
      alternatives: parsed.alternatives,
    };
  } catch {
    return {
      expectedRankChange: 0,
      confidenceInterval: { low: 0, high: 0 },
      winProbability: 0.5,
      riskLevel: "medium",
      reasoning: text,
      keyFactors: ["Parsing error - see raw response"],
    };
  }
}

// =============================================================================
// Rival Gameplan Analyzer
// =============================================================================

const RIVAL_ANALYSIS_SYSTEM_PROMPT = `You are an expert Fantasy Premier League strategist specializing in mini-league competition. Your role is to analyze rival managers' historical behavior and predict their future moves.

Key analysis areas:
1. Chip usage patterns (timing, triggers, historical precedents)
2. Captain selection tendencies (template vs differential)
3. Transfer behavior (reactive vs proactive, bandwagon vs contrarian)
4. Risk tolerance and playing style

Use pattern recognition to make predictions with confidence levels.

Always respond with valid JSON matching the expected schema.`;

function buildRivalAnalysisPrompt(request: RivalAnalysisRequest): string {
  const { rival, yourSquad, upcomingFixtures, currentGameweek } = request;

  const chipsUsedStr =
    rival.chipsUsed.map((c) => `${c.chip} in GW${c.gameweek}`).join(", ") ||
    "None used";

  const captainHistoryStr = rival.captainHistory
    .slice(-5)
    .map((c) => `GW${c.gameweek}: ${c.player} (${c.points} pts)`)
    .join("\n");

  const transfersStr = rival.transferPatterns
    .slice(-5)
    .map((t) => `GW${t.gameweek}: ${t.out} → ${t.in}`)
    .join("\n");

  const fixturesStr = upcomingFixtures
    .map(
      (f) =>
        `GW${f.gameweek}: ${f.isDGW ? "DGW" : f.isBGW ? "BGW" : "Regular"} - Good for: ${f.favorableTeams.join(", ")}`,
    )
    .join("\n");

  const yourSquadStr = yourSquad
    .map((p) => `${p.name} (${p.position})`)
    .join(", ");

  return `Analyze this rival manager and predict their strategy for upcoming gameweeks:

## Rival Profile
Name: ${rival.name}
Current Rank: ${rival.rank}
Points Gap: ${rival.pointsGap > 0 ? `+${rival.pointsGap}` : rival.pointsGap} (${rival.pointsGap > 0 ? "ahead" : "behind"})

Chips Used: ${chipsUsedStr}
Chips Remaining: ${getRemainingChips(rival.chipsUsed)}

## Captain History (last 5 GWs)
${captainHistoryStr}

## Transfer History (last 5 GWs)
${transfersStr}

## Upcoming Fixtures (from GW${currentGameweek})
${fixturesStr}

## Your Squad
${yourSquadStr}

Analyze their patterns and predict:
1. Their next chip usage (which chip, when, why)
2. Their likely captain for GW${currentGameweek}
3. Their likely transfers
4. Their playing style
5. Weaknesses you can exploit
6. Counter-strategy recommendations

Respond with JSON:
{
  "predictedChip": {
    "chip": "<chip name or null>",
    "gameweek": <number>,
    "confidence": <0-1>,
    "reasoning": "<why>"
  } | null,
  "predictedCaptain": {
    "player": "<name>",
    "confidence": <0-1>,
    "reasoning": "<why>"
  },
  "predictedTransfers": {
    "likely": ["<player in>", ...],
    "reasoning": "<pattern analysis>"
  },
  "playStyle": "aggressive" | "template" | "differential" | "conservative",
  "weaknesses": ["<weakness1>", ...],
  "counterStrategy": ["<strategy1>", ...]
}`;
}

function getRemainingChips(used: { chip: string; gameweek: number }[]): string {
  const allChips = ["wildcard", "freehit", "benchboost", "triplecaptain"];
  const usedNames = used.map((c) => c.chip);
  const remaining = allChips.filter((c) => !usedNames.includes(c));
  return remaining.length > 0 ? remaining.join(", ") : "All used";
}

export async function analyzeRival(
  request: RivalAnalysisRequest,
): Promise<RivalAnalysisResponse> {
  const startTime = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_CONFIG.MODEL,
    max_tokens: 4000,
    thinking: {
      type: "enabled",
      budget_tokens: 8000,
    },
    system: RIVAL_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildRivalAnalysisPrompt(request) }],
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

  const prediction = parseRivalPrediction(text);

  return {
    thinking,
    prediction,
    processingTime: Date.now() - startTime,
  };
}

function parseRivalPrediction(text: string): RivalPrediction {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() || text.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      predictedChip: parsed.predictedChip ?? null,
      predictedCaptain: parsed.predictedCaptain ?? {
        player: "Unknown",
        confidence: 0,
        reasoning: "Unable to predict",
      },
      predictedTransfers: parsed.predictedTransfers ?? {
        likely: [],
        reasoning: "Unable to predict",
      },
      playStyle: parsed.playStyle ?? "template",
      weaknesses: parsed.weaknesses ?? [],
      counterStrategy: parsed.counterStrategy ?? [],
    };
  } catch {
    return {
      predictedChip: null,
      predictedCaptain: { player: "Unknown", confidence: 0, reasoning: text },
      predictedTransfers: { likely: [], reasoning: "Parse error" },
      playStyle: "template",
      weaknesses: [],
      counterStrategy: [],
    };
  }
}

// =============================================================================
// Injury Return Predictor
// =============================================================================

const INJURY_PREDICTION_SYSTEM_PROMPT = `You are an expert sports medicine analyst with deep knowledge of football injuries and Fantasy Premier League. Your role is to predict when injured players will return and assess the impact on FPL.

Key considerations:
1. Injury type and typical recovery timelines
2. Player age and injury history
3. Team schedule and competition priorities
4. Manager quotes and press conference hints
5. FPL pricing and ownership implications

Use medical knowledge and historical precedents to make predictions.

Always respond with valid JSON matching the expected schema.`;

function buildInjuryPredictionPrompt(request: InjuryPredictionRequest): string {
  const { player, currentGameweek, squadContext } = request;

  const squadStr = squadContext
    ? `
You ${squadContext.hasPlayer ? "OWN" : "DO NOT OWN"} this player.
${squadContext.replacementOptions.length > 0 ? `Replacement options: ${squadContext.replacementOptions.join(", ")}` : ""}`
    : "";

  return `Predict the return timeline for this injured player:

## Player Details
Name: ${player.name}
Team: ${player.team}
Position: ${player.position}
Price: £${player.price}m
Form (before injury): ${player.formBeforeInjury}
Expected Points/Game (when fit): ${player.expectedPointsPerGame}

## Injury Information
Injury Type: ${player.injuryType}
FPL News: "${player.news}"
News Added: ${player.newsAdded ?? "Unknown"}
Chance of Playing: ${player.chanceOfPlaying !== null ? `${player.chanceOfPlaying}%` : "Unknown"}

## Current Context
Current Gameweek: ${currentGameweek}
${squadStr}

Based on the injury type, historical precedents for similar injuries, and the available information, predict:
1. When will this player likely return?
2. How confident can we be in this prediction?
3. What are the risks?
4. What should managers do?

Respond with JSON:
{
  "estimatedReturnGW": <gameweek number>,
  "confidence": "high" | "medium" | "low",
  "returnRange": { "earliest": <gw>, "latest": <gw> },
  "expectedPointsOnReturn": <number>,
  "historicalPrecedent": "<similar cases and outcomes>",
  "risks": ["<risk1>", ...],
  "recommendation": "hold" | "sell" | "buy" | "wait_and_see",
  "reasoning": "<detailed analysis>",
  "monitoringIndicators": ["<what to watch for>", ...]
}`;
}

export async function predictInjuryReturn(
  request: InjuryPredictionRequest,
): Promise<InjuryPredictionResponse> {
  const startTime = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_CONFIG.MODEL,
    max_tokens: 4000,
    thinking: {
      type: "enabled",
      budget_tokens: 6000,
    },
    system: INJURY_PREDICTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildInjuryPredictionPrompt(request) }],
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

  const prediction = parseInjuryPrediction(text, request.currentGameweek);

  return {
    thinking,
    prediction,
    processingTime: Date.now() - startTime,
  };
}

function parseInjuryPrediction(
  text: string,
  currentGW: number,
): InjuryPrediction {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() || text.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      estimatedReturnGW: parsed.estimatedReturnGW ?? currentGW + 2,
      confidence: parsed.confidence ?? "low",
      returnRange: parsed.returnRange ?? {
        earliest: currentGW + 1,
        latest: currentGW + 4,
      },
      expectedPointsOnReturn: parsed.expectedPointsOnReturn ?? 0,
      historicalPrecedent:
        parsed.historicalPrecedent ?? "No precedent available",
      risks: parsed.risks ?? [],
      recommendation: parsed.recommendation ?? "wait_and_see",
      reasoning: parsed.reasoning ?? text,
      monitoringIndicators: parsed.monitoringIndicators ?? [],
    };
  } catch {
    return {
      estimatedReturnGW: currentGW + 2,
      confidence: "low",
      returnRange: { earliest: currentGW + 1, latest: currentGW + 4 },
      expectedPointsOnReturn: 0,
      historicalPrecedent: "Parse error",
      risks: ["Unable to parse prediction"],
      recommendation: "wait_and_see",
      reasoning: text,
      monitoringIndicators: [],
    };
  }
}
