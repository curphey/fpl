import type { Config } from "@netlify/functions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fplinsights.com";
const NOTIFICATIONS_API_KEY = process.env.NOTIFICATIONS_API_KEY;

/**
 * Scheduled function to send weekly AI-generated FPL summary emails.
 * Runs every Tuesday at 10:00 AM UTC (after GW results settle and before price changes).
 *
 * Email content includes:
 * - Gameweek recap (points, rank changes)
 * - AI-generated transfer recommendations
 * - Captain pick suggestions
 * - Price change alerts
 * - Chip timing advice
 * - Mini-league movement summary
 */
export default async function handler() {
  console.log("Weekly AI summary job started at", new Date().toISOString());

  if (!NOTIFICATIONS_API_KEY) {
    console.error("NOTIFICATIONS_API_KEY not configured");
    return new Response("Configuration error", { status: 503 });
  }

  try {
    // Call the weekly summary API endpoint which:
    // 1. Fetches users who opted in for weekly summaries
    // 2. Gets their FPL manager data
    // 3. Generates AI-powered personalized insights
    // 4. Sends comprehensive summary emails
    const response = await fetch(
      `${APP_URL}/api/notifications/weekly-summary`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": NOTIFICATIONS_API_KEY,
        },
      },
    );

    const result = await response.json();
    console.log("Weekly AI summary result:", result);

    if (!response.ok) {
      console.error("Weekly summary API error:", result);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "API request failed",
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        result,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error sending weekly AI summary:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Schedule: Run every Tuesday at 10:00 AM UTC
// Tuesday is ideal because:
// - GW results have settled from the weekend
// - Price changes typically happen overnight Mon->Tue
// - Users have time to plan transfers before next deadline
export const config: Config = {
  schedule: "0 10 * * 2",
};
