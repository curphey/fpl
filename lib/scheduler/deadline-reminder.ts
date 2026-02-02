const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const NOTIFICATIONS_API_KEY = process.env.NOTIFICATIONS_API_KEY;
const FPL_API_BASE = "https://fantasy.premierleague.com/api";

interface GameweekEvent {
  id: number;
  deadline_time: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
}

interface BootstrapStatic {
  events: GameweekEvent[];
}

/**
 * Check for upcoming deadlines and send reminders.
 * Called hourly by the scheduler.
 */
export async function checkDeadlineReminders(): Promise<void> {
  console.log("Deadline reminder check started");

  if (!NOTIFICATIONS_API_KEY) {
    console.error("NOTIFICATIONS_API_KEY not configured");
    return;
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

    // Find the next gameweek with an upcoming deadline
    const now = new Date();
    const nextGameweek = data.events.find(
      (e) => !e.finished && new Date(e.deadline_time) > now,
    );

    if (!nextGameweek) {
      console.log("No upcoming deadline found");
      return;
    }

    const deadline = new Date(nextGameweek.deadline_time);
    const hoursUntilDeadline = Math.floor(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60),
    );

    console.log(`GW${nextGameweek.id} deadline in ${hoursUntilDeadline} hours`);

    // Send reminders for users who want 24h or 1h reminders
    const reminderHours = [24, 1];

    for (const hours of reminderHours) {
      // Check if we're within the reminder window (within 30 minutes of the target hour)
      if (Math.abs(hoursUntilDeadline - hours) <= 0.5) {
        console.log(`Sending ${hours}h deadline reminders`);

        // Send push notifications
        const pushResponse = await fetch(`${APP_URL}/api/notifications/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": NOTIFICATIONS_API_KEY,
          },
          body: JSON.stringify({
            type: "deadline",
            title: `GW${nextGameweek.id} Deadline in ${hours}h`,
            body: `Don't forget to confirm your team before the deadline!`,
            url: "/team",
            criteria: {
              push_deadline_reminder: true,
            },
          }),
        });

        const pushResult = await pushResponse.json();
        console.log("Push notification result:", pushResult);

        // Send email notifications
        const emailResponse = await fetch(
          `${APP_URL}/api/notifications/send-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": NOTIFICATIONS_API_KEY,
            },
            body: JSON.stringify({
              type: "deadline",
              title: `GW${nextGameweek.id} Deadline in ${hours} hour${hours > 1 ? "s" : ""}`,
              criteria: {
                email_deadline_reminder: true,
              },
              data: {
                gameweek: nextGameweek.id,
                deadline: deadline.toISOString(),
                hoursRemaining: hours,
                transfers_made: 0,
                captain: "Not set",
              },
            }),
          },
        );

        const emailResult = await emailResponse.json();
        console.log("Email notification result:", emailResult);
      }
    }

    console.log("Deadline reminder check completed", {
      gameweek: nextGameweek.id,
      hoursUntilDeadline,
    });
  } catch (error) {
    console.error("Error in deadline reminder:", error);
  }
}
