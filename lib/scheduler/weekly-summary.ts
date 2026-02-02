const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const NOTIFICATIONS_API_KEY = process.env.NOTIFICATIONS_API_KEY;

/**
 * Send weekly AI-generated FPL summary emails.
 * Called every Tuesday at 10:00 AM UTC by the scheduler.
 *
 * Email content includes:
 * - Gameweek recap (points, rank changes)
 * - AI-generated transfer recommendations
 * - Captain pick suggestions
 * - Price change alerts
 * - Chip timing advice
 * - Mini-league movement summary
 */
export async function sendWeeklySummary(): Promise<void> {
  console.log("Weekly AI summary job started at", new Date().toISOString());

  if (!NOTIFICATIONS_API_KEY) {
    console.error("NOTIFICATIONS_API_KEY not configured");
    return;
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
    }
  } catch (error) {
    console.error("Error sending weekly AI summary:", error);
  }
}
