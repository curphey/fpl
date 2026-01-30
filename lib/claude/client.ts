/**
 * Claude API client with extended thinking support
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  OptimizeRequest,
  OptimizeResponse,
  TransferConstraints,
  ChipConstraints,
  WildcardConstraints,
  TransferRecommendation,
  ChipRecommendation,
  WildcardRecommendation,
} from "./types";
import {
  buildTransferPrompt,
  buildChipPrompt,
  buildWildcardPrompt,
  buildSystemPrompt,
} from "./prompts";

/**
 * Claude API configuration constants for optimization requests.
 */
export const CLAUDE_CONFIG = {
  /** Token budget for extended thinking (reasoning) */
  THINKING_BUDGET: 10000,
  /** Maximum output tokens for the response */
  MAX_OUTPUT_TOKENS: 16000,
  /** Claude model to use for optimization */
  MODEL: "claude-sonnet-4-20250514",
} as const;

interface PlayerData {
  name: string;
  position: string;
  team: string;
  price: number;
  form: number;
  totalPoints: number;
  ownership: number;
  expectedPoints: number;
}

interface FixtureData {
  team: string;
  fixtures: {
    gw: number;
    opponent: string;
    difficulty: number;
    home: boolean;
  }[];
}

export async function runOptimization(
  request: OptimizeRequest,
  playerData: PlayerData[],
  fixtureData: FixtureData[],
): Promise<OptimizeResponse> {
  const startTime = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  // Format data for prompts
  const playerDataStr = formatPlayerData(playerData);
  const fixtureDataStr = formatFixtureData(fixtureData);

  // Build appropriate prompt based on type
  let prompt: string;
  switch (request.type) {
    case "transfer":
      prompt = buildTransferPrompt(
        request.query,
        request.constraints as TransferConstraints,
        request.currentTeam,
        request.leagueContext,
        playerDataStr,
        fixtureDataStr,
      );
      break;
    case "chip":
      prompt = buildChipPrompt(
        request.query,
        request.constraints as ChipConstraints,
        request.currentTeam,
        request.leagueContext,
        fixtureDataStr,
      );
      break;
    case "wildcard":
      prompt = buildWildcardPrompt(
        request.query,
        request.constraints as WildcardConstraints,
        request.leagueContext,
        playerDataStr,
        fixtureDataStr,
      );
      break;
    default:
      throw new Error(`Unknown optimization type: ${request.type}`);
  }

  // Call Claude with extended thinking
  const response = await client.messages.create({
    model: CLAUDE_CONFIG.MODEL,
    max_tokens: CLAUDE_CONFIG.MAX_OUTPUT_TOKENS,
    thinking: {
      type: "enabled",
      budget_tokens: CLAUDE_CONFIG.THINKING_BUDGET,
    },
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: prompt }],
  });

  // Extract thinking and text from response
  let thinking = "";
  let text = "";

  for (const block of response.content) {
    if (block.type === "thinking") {
      thinking = block.thinking;
    } else if (block.type === "text") {
      text = block.text;
    }
  }

  // Parse JSON response
  const parsed = parseJsonResponse(text, request.type);

  return {
    type: request.type,
    thinking,
    summary: parsed.summary,
    recommendations: parsed.recommendations,
    warnings: parsed.warnings,
    processingTime: Date.now() - startTime,
  };
}

function formatPlayerData(players: PlayerData[]): string {
  // Group by position and format
  const byPosition: Record<string, PlayerData[]> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  for (const p of players) {
    const pos = p.position.toUpperCase();
    if (byPosition[pos]) {
      byPosition[pos].push(p);
    }
  }

  const lines: string[] = [];

  for (const [pos, list] of Object.entries(byPosition)) {
    const top = list.slice(0, 15);
    lines.push(`### ${pos}`);
    for (const p of top) {
      lines.push(
        `- ${p.name} (${p.team}) £${p.price}m | Form: ${p.form} | Pts: ${p.totalPoints} | Own: ${p.ownership}% | xPts: ${p.expectedPoints}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatFixtureData(fixtures: FixtureData[]): string {
  const lines: string[] = [];

  for (const team of fixtures.slice(0, 20)) {
    const fixtureStr = team.fixtures
      .slice(0, 5)
      .map(
        (f) => `GW${f.gw}: ${f.home ? "" : "@"}${f.opponent}(${f.difficulty})`,
      )
      .join(", ");
    lines.push(`${team.team}: ${fixtureStr}`);
  }

  return lines.join("\n");
}

function parseJsonResponse(
  text: string,
  type: string,
): {
  summary: string;
  recommendations:
    | TransferRecommendation[]
    | ChipRecommendation
    | WildcardRecommendation;
  warnings?: string[];
} {
  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1]?.trim() || text.trim();

  try {
    const parsed = JSON.parse(jsonStr);

    if (type === "transfer") {
      return {
        summary: parsed.summary || "Transfer recommendations",
        recommendations: parsed.recommendations || [],
        warnings: parsed.warnings,
      };
    } else if (type === "chip") {
      return {
        summary: parsed.summary || "Chip recommendation",
        recommendations: parsed.recommendation || parsed.recommendations,
        warnings: parsed.warnings,
      };
    } else {
      return {
        summary: parsed.summary || "Wildcard recommendation",
        recommendations: parsed.recommendation || parsed.recommendations,
        warnings: parsed.warnings,
      };
    }
  } catch {
    // If JSON parsing fails, return a fallback
    return {
      summary: "Unable to parse structured response",
      recommendations: type === "transfer" ? [] : ({} as ChipRecommendation),
      warnings: [
        "Response parsing failed. Raw response available in thinking.",
      ],
    };
  }
}
