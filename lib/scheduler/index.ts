import cron from "node-cron";
import { checkDeadlineReminders } from "./deadline-reminder";
import { sendWeeklySummary } from "./weekly-summary";
import { checkLeagueUpdates } from "./league-updates";
import { trackGwPlanPredictions } from "./gw-plan-tracker";

let schedulerStarted = false;

/**
 * Start the cron scheduler for background tasks.
 * This replaces the Netlify scheduled functions.
 */
export function startScheduler() {
  if (schedulerStarted) {
    console.log("Scheduler already started, skipping");
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("Scheduler disabled in development");
    return;
  }

  // Hourly deadline check (at minute 0)
  cron.schedule("0 * * * *", () => {
    console.log("[Scheduler] Running deadline reminder check");
    checkDeadlineReminders().catch(console.error);
  });

  // Tuesday 10am UTC weekly summary
  cron.schedule("0 10 * * 2", () => {
    console.log("[Scheduler] Running weekly summary");
    sendWeeklySummary().catch(console.error);
  });

  // Every 6 hours league updates (at 0, 6, 12, 18)
  cron.schedule("0 */6 * * *", () => {
    console.log("[Scheduler] Running league updates check");
    checkLeagueUpdates().catch(console.error);
  });

  // Tuesday 7am UTC GW plan transfer tracker
  cron.schedule("0 7 * * 2", async () => {
    console.log("[Scheduler] Running GW plan prediction tracker");
    try {
      const response = await fetch(
        "https://fantasy.premierleague.com/api/bootstrap-static/",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FPL-App/1.0)",
            Accept: "application/json",
          },
        },
      );
      if (!response.ok) throw new Error(`FPL API error: ${response.status}`);
      const data = await response.json();
      const currentGw = data.events.find(
        (e: { is_current: boolean }) => e.is_current,
      );
      const gwNumber = currentGw ? currentGw.id : 1;
      await trackGwPlanPredictions(gwNumber);
    } catch (error) {
      console.error("[Scheduler] GW plan tracker error:", error);
    }
  });

  schedulerStarted = true;
  console.log("Scheduler started with the following jobs:");
  console.log("  - Deadline reminders: every hour");
  console.log("  - Weekly summary: Tuesday 10:00 UTC");
  console.log("  - League updates: every 6 hours");
  console.log("  - GW plan tracker: Tuesday 07:00 UTC");
}

export {
  checkDeadlineReminders,
  sendWeeklySummary,
  checkLeagueUpdates,
  trackGwPlanPredictions,
};
