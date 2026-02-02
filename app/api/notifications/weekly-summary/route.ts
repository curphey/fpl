import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sendEmail } from "@/lib/notifications/email-client";
import type { WeeklySummaryData } from "@/lib/notifications/types";
import {
  isInQuietHours,
  shouldRespectQuietHours,
} from "@/lib/notifications/quiet-hours";
import { timingSafeCompare } from "@/lib/utils/timing-safe";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  getAllEnabledEmailSubscriptions,
  logNotification,
  type NotificationPreference,
} from "@/lib/db/notifications";
import { getSession } from "@/lib/db/sessions";
import { getAnthropicApiKey } from "@/lib/db/settings";

const FPL_API_BASE = "https://fantasy.premierleague.com/api";

interface FPLManager {
  id: number;
  player_first_name: string;
  player_last_name: string;
  name: string;
  summary_overall_points: number;
  summary_overall_rank: number;
  summary_event_points: number;
  summary_event_rank: number;
  current_event: number;
  leagues: {
    classic: Array<{
      id: number;
      name: string;
      entry_rank: number;
      entry_last_rank: number;
    }>;
  };
}

interface FPLPicks {
  entry_history: {
    points: number;
    total_points: number;
    rank: number;
    overall_rank: number;
    event_transfers: number;
  };
  picks: Array<{
    element: number;
    is_captain: boolean;
    multiplier: number;
  }>;
}

interface FPLHistory {
  current: Array<{
    event: number;
    points: number;
    total_points: number;
    rank: number;
    overall_rank: number;
  }>;
}

interface FPLBootstrap {
  events: Array<{
    id: number;
    name: string;
    deadline_time: string;
    finished: boolean;
    is_current: boolean;
    is_next: boolean;
  }>;
  elements: Array<{
    id: number;
    web_name: string;
    team: number;
    element_type: number;
    now_cost: number;
    form: string;
    total_points: number;
    selected_by_percent: string;
    transfers_in_event: number;
    transfers_out_event: number;
  }>;
  teams: Array<{
    id: number;
    short_name: string;
    name: string;
  }>;
}

async function fetchFPL<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${FPL_API_BASE}${path}`, {
      headers: { "User-Agent": "FPL-Insights/1.0" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function predictPriceChanges(elements: FPLBootstrap["elements"]): {
  risers: Array<{ name: string; team: string; probability: number }>;
  fallers: Array<{ name: string; team: string; probability: number }>;
} {
  const risers: Array<{ name: string; team: string; probability: number }> = [];
  const fallers: Array<{ name: string; team: string; probability: number }> =
    [];

  for (const el of elements) {
    const netTransfers = el.transfers_in_event - el.transfers_out_event;
    const ownership = parseFloat(el.selected_by_percent);

    if (netTransfers > 100000 && ownership < 30) {
      risers.push({
        name: el.web_name,
        team: "",
        probability: Math.min(95, 60 + Math.floor(netTransfers / 10000)),
      });
    } else if (netTransfers < -80000 && ownership > 5) {
      fallers.push({
        name: el.web_name,
        team: "",
        probability: Math.min(
          95,
          60 + Math.floor(Math.abs(netTransfers) / 10000),
        ),
      });
    }
  }

  return {
    risers: risers.sort((a, b) => b.probability - a.probability).slice(0, 5),
    fallers: fallers.sort((a, b) => b.probability - a.probability).slice(0, 5),
  };
}

async function generateAIInsights(
  managerName: string,
  gwPoints: number,
  overallRank: number,
  rankChange: number,
  captainName: string,
  captainPoints: number,
  teamNames: Map<number, string>,
  topPlayers: FPLBootstrap["elements"],
): Promise<{
  recap: string;
  transfers: string;
  captain: string;
  chips: string;
}> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      recap: `You scored ${gwPoints} points this gameweek. Your overall rank is now ${overallRank.toLocaleString()}.`,
      transfers:
        "Check the Transfer Hub for personalized recommendations based on form and fixtures.",
      captain:
        "Visit the Captain Selector for data-driven captain picks for the upcoming gameweek.",
      chips: "",
    };
  }

  try {
    const client = new Anthropic({ apiKey });

    const topPlayersStr = topPlayers
      .slice(0, 10)
      .map(
        (p) =>
          `${p.web_name} (${teamNames.get(p.team) || "UNK"}) - ${p.total_points}pts, Form: ${p.form}, Own: ${p.selected_by_percent}%`,
      )
      .join("\n");

    const prompt = `You are an FPL expert writing a personalized weekly email summary for a manager. Be concise, insightful, and actionable. Use a friendly but analytical tone.

Manager: ${managerName}
GW Points: ${gwPoints}
Overall Rank: ${overallRank.toLocaleString()} (${rankChange < 0 ? "up " + Math.abs(rankChange).toLocaleString() : rankChange > 0 ? "down " + rankChange.toLocaleString() : "no change"})
Captain: ${captainName} scored ${captainPoints} points

Top performing players this week:
${topPlayersStr}

Generate 4 sections (keep each to 2-3 sentences max):

1. RECAP: A brief, personalized gameweek summary. Comment on their performance relative to the average.

2. TRANSFERS: Suggest 1-2 specific transfer targets based on the top performers. Be specific about who to consider.

3. CAPTAIN: Recommend 2-3 captain options for next week with brief reasoning.

4. CHIPS: If relevant, suggest chip timing advice. If not applicable, return empty string.

Return as JSON:
{
  "recap": "...",
  "transfers": "...",
  "captain": "...",
  "chips": "..."
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        recap: parsed.recap || "",
        transfers: parsed.transfers || "",
        captain: parsed.captain || "",
        chips: parsed.chips || "",
      };
    }

    throw new Error("Could not parse AI response");
  } catch (error) {
    console.error("AI generation error:", error);
    return {
      recap: `You scored ${gwPoints} points this gameweek. Your overall rank is now ${overallRank.toLocaleString()}.`,
      transfers:
        "Check the Transfer Hub for personalized recommendations based on form and fixtures.",
      captain:
        "Visit the Captain Selector for data-driven captain picks for the upcoming gameweek.",
      chips: "",
    };
  }
}

/**
 * POST /api/notifications/weekly-summary
 *
 * Generate and send weekly AI-powered summary emails.
 * Protected by API key for server-to-server calls.
 */
export async function POST(request: NextRequest) {
  // Check rate limit
  const rateLimitResponse = await withRateLimit(request, "notifications");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Validate API key
  const apiKey = request.headers.get("x-api-key");
  if (!timingSafeCompare(apiKey, process.env.NOTIFICATIONS_API_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 503 },
    );
  }

  try {
    // Fetch FPL bootstrap data
    const bootstrap = await fetchFPL<FPLBootstrap>("/bootstrap-static/");
    if (!bootstrap) {
      return NextResponse.json(
        { error: "Failed to fetch FPL data" },
        { status: 503 },
      );
    }

    const currentGw = bootstrap.events.find((e) => e.is_current);
    if (!currentGw) {
      return NextResponse.json(
        { error: "No current gameweek" },
        { status: 400 },
      );
    }

    const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
    const playerMap = new Map(bootstrap.elements.map((e) => [e.id, e]));

    // Get users who opted in for weekly summary from SQLite
    const allRecipients = getAllEnabledEmailSubscriptions().filter(
      (r) => r.email_weekly_summary,
    );

    // Filter out users in quiet hours
    const now = new Date();
    const filteredRecipients = shouldRespectQuietHours("weekly_summary")
      ? allRecipients.filter((r) => {
          const prefs = {
            quiet_hours_start: r.quiet_hours_start,
            quiet_hours_end: r.quiet_hours_end,
            timezone: r.timezone,
          };
          return !isInQuietHours(
            prefs as Parameters<typeof isInQuietHours>[0],
            now,
          );
        })
      : allRecipients;

    if (filteredRecipients.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        message: "No eligible recipients",
      });
    }

    // Get sessions with FPL manager IDs
    const recipientsWithManagerId: Array<
      NotificationPreference & {
        fpl_manager_id: number;
        display_name: string | null;
      }
    > = [];

    for (const r of filteredRecipients) {
      const session = getSession(r.session_id);
      if (session?.fpl_manager_id) {
        recipientsWithManagerId.push({
          ...r,
          fpl_manager_id: session.fpl_manager_id,
          display_name: session.display_name,
        });
      }
    }

    if (recipientsWithManagerId.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        message: "No sessions with FPL manager IDs found",
      });
    }

    // Price change predictions
    const priceChanges = predictPriceChanges(bootstrap.elements);

    // Top players by form
    const topPlayers = [...bootstrap.elements]
      .sort((a, b) => parseFloat(b.form) - parseFloat(a.form))
      .slice(0, 20);

    const results = { success: 0, failed: 0, errors: [] as string[] };

    // Process each user
    for (const recipient of recipientsWithManagerId) {
      try {
        // Fetch manager data
        const manager = await fetchFPL<FPLManager>(
          `/entry/${recipient.fpl_manager_id}/`,
        );
        if (!manager) {
          results.failed++;
          results.errors.push(
            `${recipient.email_address}: Failed to fetch manager data`,
          );
          continue;
        }

        // Fetch picks for current GW
        const picks = await fetchFPL<FPLPicks>(
          `/entry/${recipient.fpl_manager_id}/event/${currentGw.id}/picks/`,
        );

        // Fetch history for rank change
        const history = await fetchFPL<FPLHistory>(
          `/entry/${recipient.fpl_manager_id}/history/`,
        );

        // Calculate rank change
        let rankChange = 0;
        if (history?.current && history.current.length >= 2) {
          const prevGw = history.current[history.current.length - 2];
          rankChange = prevGw.overall_rank - manager.summary_overall_rank;
        }

        // Get captain info
        const captainPick = picks?.picks.find((p) => p.is_captain);
        const captainPlayer = captainPick
          ? playerMap.get(captainPick.element)
          : null;
        const captainName = captainPlayer?.web_name || "Unknown";
        const captainPoints = captainPlayer ? captainPlayer.total_points : 0;

        // Generate AI insights
        const managerDisplayName =
          recipient.display_name || manager.player_first_name;
        const aiInsights = await generateAIInsights(
          managerDisplayName,
          manager.summary_event_points,
          manager.summary_overall_rank,
          rankChange,
          captainName,
          captainPoints,
          teamMap,
          topPlayers,
        );

        // Build league data
        const leagues = manager.leagues.classic
          .filter((l) => l.name !== "Overall")
          .slice(0, 5)
          .map((l) => ({
            name: l.name,
            rank: l.entry_rank,
            rank_change: l.entry_last_rank - l.entry_rank,
            top_rival: "Leader",
            gap_to_top: l.entry_rank > 1 ? l.entry_rank - 1 : 0,
          }));

        // Build email data
        const summaryData: WeeklySummaryData = {
          manager_name: managerDisplayName,
          gameweek: currentGw.id,
          gw_points: manager.summary_event_points,
          gw_rank: manager.summary_event_rank,
          overall_points: manager.summary_overall_points,
          overall_rank: manager.summary_overall_rank,
          rank_change: rankChange,
          captain_name: captainName,
          captain_points: captainPoints * (captainPick?.multiplier || 2),
          ai_recap: aiInsights.recap,
          ai_transfer_suggestions: aiInsights.transfers,
          ai_captain_picks: aiInsights.captain,
          ai_chip_advice: aiInsights.chips,
          price_risers: priceChanges.risers,
          price_fallers: priceChanges.fallers,
          leagues,
        };

        // Send email
        const emailResult = await sendEmail({
          to: recipient.email_address as string,
          type: "weekly_summary",
          title: `Your GW${currentGw.id} Summary`,
          data: summaryData as unknown as Record<string, unknown>,
        });

        if (emailResult.success) {
          results.success++;

          // Log to notification history
          logNotification(
            recipient.session_id,
            "weekly_summary",
            "email",
            `Your GW${currentGw.id} Summary`,
            `Weekly FPL summary for ${managerDisplayName}`,
            { gameweek: currentGw.id },
          );
        } else {
          results.failed++;
          results.errors.push(
            `${recipient.email_address}: ${emailResult.error}`,
          );
        }

        // Small delay between emails
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${recipient.email_address}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error generating weekly summaries:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly summaries" },
      { status: 500 },
    );
  }
}
