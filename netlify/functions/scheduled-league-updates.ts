import type { Config } from "@netlify/functions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fplinsights.com";
const NOTIFICATIONS_API_KEY = process.env.NOTIFICATIONS_API_KEY;
const FPL_API_BASE = "https://fantasy.premierleague.com/api";

interface GameweekEvent {
  id: number;
  deadline_time: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  finished_provisional: boolean;
}

interface BootstrapStatic {
  events: GameweekEvent[];
}

/**
 * Scheduled function to send league update notifications after gameweeks finish.
 * Runs every 6 hours to check for newly finished gameweeks.
 */
export default async function handler() {
  console.log("League updates check started");

  if (!NOTIFICATIONS_API_KEY) {
    console.error("NOTIFICATIONS_API_KEY not configured");
    return new Response("Configuration error", { status: 503 });
  }

  try {
    // Fetch current gameweek data from FPL API
    const response = await fetch(`${FPL_API_BASE}/bootstrap-static/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FPL-App/1.0)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`FPL API error: ${response.status}`);
    }

    const data: BootstrapStatic = await response.json();

    // Find the most recently finished gameweek
    const finishedGameweeks = data.events.filter((e) => e.finished);
    const lastFinishedGW =
      finishedGameweeks.length > 0
        ? finishedGameweeks[finishedGameweeks.length - 1]
        : null;

    if (!lastFinishedGW) {
      console.log("No finished gameweeks found");
      return new Response("No finished gameweeks", { status: 200 });
    }

    // Check if this GW just finished (within last 6 hours)
    // We use a simple heuristic: if there's a next GW and it's upcoming
    const currentGW = data.events.find((e) => e.is_current);
    const justFinished =
      currentGW &&
      currentGW.id === lastFinishedGW.id + 1 &&
      !currentGW.finished_provisional;

    if (!justFinished) {
      console.log(`GW${lastFinishedGW.id} finished but not recently`);
      return new Response("No recent GW finish", { status: 200 });
    }

    console.log(`GW${lastFinishedGW.id} recently finished, sending updates`);

    // Send push notifications for league updates
    const pushResponse = await fetch(`${APP_URL}/api/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": NOTIFICATIONS_API_KEY,
      },
      body: JSON.stringify({
        type: "league_update",
        title: `GW${lastFinishedGW.id} Complete`,
        body: "Check your mini-league standings!",
        url: "/leagues/analyze",
        criteria: {
          push_league_updates: true,
        },
      }),
    });

    const pushResult = await pushResponse.json();
    console.log("Push notification result:", pushResult);

    return new Response(
      JSON.stringify({
        success: true,
        gameweek: lastFinishedGW.id,
        result: pushResult,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error checking league updates:", error);
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

// Schedule: Run every 6 hours
export const config: Config = {
  schedule: "0 */6 * * *",
};
