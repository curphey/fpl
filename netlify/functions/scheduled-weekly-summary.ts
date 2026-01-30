import type { Config } from "@netlify/functions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fplinsights.com";
const NOTIFICATIONS_API_KEY = process.env.NOTIFICATIONS_API_KEY;

/**
 * Scheduled function to send weekly transfer recommendation summaries.
 * Runs every Tuesday at 10:00 AM UTC (typically after price changes settle).
 */
export default async function handler() {
  console.log("Weekly summary job started");

  if (!NOTIFICATIONS_API_KEY) {
    console.error("NOTIFICATIONS_API_KEY not configured");
    return new Response("Configuration error", { status: 503 });
  }

  try {
    // Send weekly summary emails to users who opted in
    const emailResponse = await fetch(
      `${APP_URL}/api/notifications/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": NOTIFICATIONS_API_KEY,
        },
        body: JSON.stringify({
          type: "transfer_rec",
          title: "Your Weekly Transfer Recommendations",
          criteria: {
            email_weekly_summary: true,
          },
        }),
      },
    );

    const emailResult = await emailResponse.json();
    console.log("Weekly summary result:", emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        result: emailResult,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error sending weekly summary:", error);
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
export const config: Config = {
  schedule: "0 10 * * 2",
};
