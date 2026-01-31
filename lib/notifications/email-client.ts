import { Resend } from "resend";
import type {
  NotificationType,
  DeadlineReminderData,
  PriceChangeData,
  InjuryNewsData,
  LeagueUpdateData,
  WeeklySummaryData,
} from "./types";

// Lazy initialization
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL =
  process.env.FROM_EMAIL || "FPL Insights <noreply@fplinsights.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fplinsights.com";

export interface EmailPayload {
  to: string;
  type: NotificationType;
  title: string;
  data?: Record<string, unknown>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate HTML email content based on notification type
 */
function generateEmailHtml(
  type: NotificationType,
  title: string,
  data?: Record<string, unknown>,
): string {
  const header = `
    <div style="background: linear-gradient(135deg, #37003c 0%, #04f5ff 100%); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        FPL Insights
      </h1>
    </div>
  `;

  const footer = `
    <div style="background: #1a1a2e; padding: 24px; text-align: center; border-top: 1px solid #333;">
      <p style="color: #888; margin: 0 0 12px 0; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        You're receiving this because you enabled email notifications in FPL Insights.
      </p>
      <a href="${APP_URL}/notifications" style="color: #04f5ff; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Manage notification preferences
      </a>
    </div>
  `;

  let content = "";

  switch (type) {
    case "deadline": {
      const d = data as DeadlineReminderData | undefined;
      content = `
        <div style="padding: 32px; background: #0f0f23;">
          <h2 style="color: #04f5ff; margin: 0 0 16px 0; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ⏰ ${title}
          </h2>
          ${
            d
              ? `
            <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              Gameweek ${d.gameweek} deadline is in <strong style="color: #ff6b6b;">${d.hoursRemaining} hour${d.hoursRemaining !== 1 ? "s" : ""}</strong>.
            </p>
            <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #888; margin: 0 0 8px 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Your current setup:
              </p>
              <p style="color: #e0e0e0; margin: 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Captain: <strong style="color: #00ff87;">${d.captain}</strong><br/>
                Transfers made: <strong>${d.transfers_made}</strong>
              </p>
            </div>
          `
              : ""
          }
          <a href="${APP_URL}/team" style="display: inline-block; background: #00ff87; color: #37003c; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 16px;">
            Review Your Team
          </a>
        </div>
      `;
      break;
    }

    case "price_change": {
      const d = data as PriceChangeData | undefined;
      content = `
        <div style="padding: 32px; background: #0f0f23;">
          <h2 style="color: #04f5ff; margin: 0 0 16px 0; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${d?.direction === "rise" ? "📈" : "📉"} ${title}
          </h2>
          ${
            d
              ? `
            <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #e0e0e0; margin: 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <strong style="color: ${d.direction === "rise" ? "#00ff87" : "#ff6b6b"};">${d.player_name}</strong> (${d.team})
              </p>
              <p style="color: #888; margin: 8px 0 0 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Current price: £${(d.current_price / 10).toFixed(1)}m<br/>
                ${d.direction === "rise" ? "Rise" : "Fall"} probability: <strong style="color: ${d.probability > 90 ? "#ff6b6b" : "#ffd93d"};">${d.probability}%</strong>
              </p>
              ${d.owned ? '<p style="color: #00ff87; margin: 8px 0 0 0; font-size: 12px;">✓ In your squad</p>' : ""}
            </div>
          `
              : ""
          }
          <a href="${APP_URL}/transfers" style="display: inline-block; background: #00ff87; color: #37003c; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 16px;">
            View Transfer Hub
          </a>
        </div>
      `;
      break;
    }

    case "injury": {
      const d = data as InjuryNewsData | undefined;
      content = `
        <div style="padding: 32px; background: #0f0f23;">
          <h2 style="color: #04f5ff; margin: 0 0 16px 0; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            🏥 ${title}
          </h2>
          ${
            d
              ? `
            <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #e0e0e0; margin: 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <strong>${d.player_name}</strong> (${d.team})
              </p>
              <p style="color: ${d.chance_of_playing !== null && d.chance_of_playing < 50 ? "#ff6b6b" : "#ffd93d"}; margin: 8px 0 0 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Status: ${d.status}
              </p>
              ${d.news ? `<p style="color: #888; margin: 8px 0 0 0; font-size: 14px; font-style: italic;">"${d.news}"</p>` : ""}
              ${d.chance_of_playing !== null ? `<p style="color: #888; margin: 8px 0 0 0; font-size: 12px;">Chance of playing: ${d.chance_of_playing}%</p>` : ""}
            </div>
          `
              : ""
          }
          <a href="${APP_URL}/news" style="display: inline-block; background: #00ff87; color: #37003c; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 16px;">
            View Injury Tracker
          </a>
        </div>
      `;
      break;
    }

    case "transfer_rec": {
      content = `
        <div style="padding: 32px; background: #0f0f23;">
          <h2 style="color: #04f5ff; margin: 0 0 16px 0; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            💡 ${title}
          </h2>
          <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            Your weekly transfer recommendations are ready. We've analyzed fixtures, form, and underlying stats to suggest the best moves for your team.
          </p>
          <a href="${APP_URL}/transfers" style="display: inline-block; background: #00ff87; color: #37003c; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 16px;">
            View Recommendations
          </a>
        </div>
      `;
      break;
    }

    case "league_update": {
      const d = data as LeagueUpdateData | undefined;
      const rankIcon =
        d && d.rank_change < 0 ? "📈" : d && d.rank_change > 0 ? "📉" : "➡️";
      content = `
        <div style="padding: 32px; background: #0f0f23;">
          <h2 style="color: #04f5ff; margin: 0 0 16px 0; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            🏆 ${title}
          </h2>
          ${
            d
              ? `
            <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #e0e0e0; margin: 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <strong>${d.league_name}</strong> - GW${d.gameweek}
              </p>
              <p style="color: #888; margin: 12px 0 0 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Your rank: <strong style="color: #00ff87;">${d.your_rank.toLocaleString()}</strong>
                ${rankIcon} ${Math.abs(d.rank_change)} place${Math.abs(d.rank_change) !== 1 ? "s" : ""}
              </p>
              <p style="color: #888; margin: 8px 0 0 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                Points this GW: <strong>${d.points_scored}</strong><br/>
                Gap to leader: <strong style="color: ${d.gap_to_leader > 0 ? "#ff6b6b" : "#00ff87"};">${d.gap_to_leader > 0 ? `-${d.gap_to_leader}` : `+${Math.abs(d.gap_to_leader)}`}</strong> points
              </p>
            </div>
          `
              : ""
          }
          <a href="${APP_URL}/leagues/analyze" style="display: inline-block; background: #00ff87; color: #37003c; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 16px;">
            Analyze Your Leagues
          </a>
        </div>
      `;
      break;
    }

    case "weekly_summary": {
      const d = data as WeeklySummaryData | undefined;
      const overallRankIcon =
        d && d.rank_change < 0 ? "📈" : d && d.rank_change > 0 ? "📉" : "➡️";
      content = d
        ? `
        <div style="padding: 32px; background: #0f0f23;">
          <!-- Header greeting -->
          <h2 style="color: #04f5ff; margin: 0 0 8px 0; font-size: 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            📊 Your Weekly FPL Summary
          </h2>
          <p style="color: #888; margin: 0 0 24px 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            Hi ${d.manager_name}! Here's your personalized FPL insights for Gameweek ${d.gameweek}.
          </p>

          <!-- Gameweek Recap -->
          <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
            <h3 style="color: #00ff87; margin: 0 0 16px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ⚽ GW${d.gameweek} Recap
            </h3>
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              <div style="flex: 1; min-width: 120px;">
                <p style="color: #888; margin: 0 0 4px 0; font-size: 12px;">GW Points</p>
                <p style="color: #e0e0e0; margin: 0; font-size: 24px; font-weight: 700;">${d.gw_points}</p>
              </div>
              <div style="flex: 1; min-width: 120px;">
                <p style="color: #888; margin: 0 0 4px 0; font-size: 12px;">Overall Rank</p>
                <p style="color: #e0e0e0; margin: 0; font-size: 24px; font-weight: 700;">
                  ${d.overall_rank.toLocaleString()}
                  <span style="font-size: 14px; color: ${d.rank_change < 0 ? "#00ff87" : d.rank_change > 0 ? "#ff6b6b" : "#888"};">
                    ${overallRankIcon}
                  </span>
                </p>
              </div>
              <div style="flex: 1; min-width: 120px;">
                <p style="color: #888; margin: 0 0 4px 0; font-size: 12px;">Captain</p>
                <p style="color: #e0e0e0; margin: 0; font-size: 16px; font-weight: 600;">${d.captain_name} (${d.captain_points}pts)</p>
              </div>
            </div>
            <p style="color: #e0e0e0; margin: 16px 0 0 0; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${d.ai_recap}
            </p>
          </div>

          <!-- Transfer Suggestions -->
          <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
            <h3 style="color: #04f5ff; margin: 0 0 12px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              💡 Transfer Suggestions
            </h3>
            <p style="color: #e0e0e0; margin: 0; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${d.ai_transfer_suggestions}
            </p>
            <a href="${APP_URL}/transfers" style="display: inline-block; background: transparent; color: #04f5ff; padding: 8px 0; text-decoration: none; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 12px;">
              View all transfer recommendations →
            </a>
          </div>

          <!-- Captain Picks -->
          <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
            <h3 style="color: #ffd93d; margin: 0 0 12px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              👑 Captain Picks for Next GW
            </h3>
            <p style="color: #e0e0e0; margin: 0; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${d.ai_captain_picks}
            </p>
            <a href="${APP_URL}/captain" style="display: inline-block; background: transparent; color: #ffd93d; padding: 8px 0; text-decoration: none; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 12px;">
              View captain selector →
            </a>
          </div>

          <!-- Chip Advice -->
          ${
            d.ai_chip_advice
              ? `
          <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
            <h3 style="color: #ff6b6b; margin: 0 0 12px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              🎯 Chip Strategy
            </h3>
            <p style="color: #e0e0e0; margin: 0; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${d.ai_chip_advice}
            </p>
            <a href="${APP_URL}/chips" style="display: inline-block; background: transparent; color: #ff6b6b; padding: 8px 0; text-decoration: none; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 12px;">
              View chip advisor →
            </a>
          </div>
          `
              : ""
          }

          <!-- Price Alerts -->
          ${
            d.price_risers.length > 0 || d.price_fallers.length > 0
              ? `
          <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
            <h3 style="color: #e0e0e0; margin: 0 0 12px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              💰 Price Change Alerts
            </h3>
            ${
              d.price_risers.length > 0
                ? `
            <p style="color: #888; margin: 0 0 8px 0; font-size: 12px;">Likely to rise:</p>
            <p style="color: #00ff87; margin: 0 0 12px 0; font-size: 14px;">
              ${d.price_risers.map((p) => `${p.name} (${p.probability}%)`).join(", ")}
            </p>
            `
                : ""
            }
            ${
              d.price_fallers.length > 0
                ? `
            <p style="color: #888; margin: 0 0 8px 0; font-size: 12px;">Likely to fall:</p>
            <p style="color: #ff6b6b; margin: 0; font-size: 14px;">
              ${d.price_fallers.map((p) => `${p.name} (${p.probability}%)`).join(", ")}
            </p>
            `
                : ""
            }
          </div>
          `
              : ""
          }

          <!-- Mini-League Summary -->
          ${
            d.leagues.length > 0
              ? `
          <div style="background: #1a1a2e; border-radius: 8px; padding: 20px; margin: 0 0 20px 0;">
            <h3 style="color: #e0e0e0; margin: 0 0 12px 0; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              🏆 Mini-League Update
            </h3>
            ${d.leagues
              .slice(0, 3)
              .map(
                (l) => `
              <div style="border-bottom: 1px solid #333; padding: 12px 0;">
                <p style="color: #e0e0e0; margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">${l.name}</p>
                <p style="color: #888; margin: 0; font-size: 13px;">
                  Rank: <strong style="color: #00ff87;">${l.rank}</strong>
                  ${l.rank_change !== 0 ? `(${l.rank_change > 0 ? "↓" : "↑"}${Math.abs(l.rank_change)})` : ""}
                  • Gap to ${l.top_rival}: <strong>${l.gap_to_top > 0 ? `-${l.gap_to_top}` : `+${Math.abs(l.gap_to_top)}`}</strong> pts
                </p>
              </div>
            `,
              )
              .join("")}
            <a href="${APP_URL}/leagues" style="display: inline-block; background: transparent; color: #04f5ff; padding: 8px 0; text-decoration: none; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 12px;">
              View all leagues →
            </a>
          </div>
          `
              : ""
          }

          <!-- CTA -->
          <a href="${APP_URL}" style="display: inline-block; background: #00ff87; color: #37003c; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 8px;">
            Open FPL Insights
          </a>
        </div>
      `
        : `
        <div style="padding: 32px; background: #0f0f23;">
          <h2 style="color: #04f5ff; margin: 0 0 16px 0; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            📊 ${title}
          </h2>
          <p style="color: #e0e0e0; font-size: 16px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            Your weekly FPL insights are ready. Check the app for personalized recommendations.
          </p>
          <a href="${APP_URL}" style="display: inline-block; background: #00ff87; color: #37003c; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 16px;">
            Open FPL Insights
          </a>
        </div>
      `;
      break;
    }

    default:
      content = `
        <div style="padding: 32px; background: #0f0f23;">
          <h2 style="color: #04f5ff; margin: 0 0 16px 0; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${title}
          </h2>
          <a href="${APP_URL}" style="display: inline-block; background: #00ff87; color: #37003c; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 16px;">
            Open FPL Insights
          </a>
        </div>
      `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background: #0a0a1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #0f0f23;">
          ${header}
          ${content}
          ${footer}
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate plain text email content
 */
function generateEmailText(
  type: NotificationType,
  title: string,
  data?: Record<string, unknown>,
): string {
  let text = `FPL Insights\n${"=".repeat(40)}\n\n${title}\n\n`;

  switch (type) {
    case "deadline": {
      const d = data as DeadlineReminderData | undefined;
      if (d) {
        text += `Gameweek ${d.gameweek} deadline is in ${d.hoursRemaining} hour${d.hoursRemaining !== 1 ? "s" : ""}.\n\n`;
        text += `Your current setup:\n`;
        text += `- Captain: ${d.captain}\n`;
        text += `- Transfers made: ${d.transfers_made}\n\n`;
      }
      text += `Review your team: ${APP_URL}/team\n`;
      break;
    }
    case "price_change": {
      const d = data as PriceChangeData | undefined;
      if (d) {
        text += `${d.player_name} (${d.team})\n`;
        text += `Current price: £${(d.current_price / 10).toFixed(1)}m\n`;
        text += `${d.direction === "rise" ? "Rise" : "Fall"} probability: ${d.probability}%\n`;
        if (d.owned) text += `✓ In your squad\n`;
        text += `\n`;
      }
      text += `View Transfer Hub: ${APP_URL}/transfers\n`;
      break;
    }
    case "injury": {
      const d = data as InjuryNewsData | undefined;
      if (d) {
        text += `${d.player_name} (${d.team})\n`;
        text += `Status: ${d.status}\n`;
        if (d.news) text += `"${d.news}"\n`;
        if (d.chance_of_playing !== null)
          text += `Chance of playing: ${d.chance_of_playing}%\n`;
        text += `\n`;
      }
      text += `View Injury Tracker: ${APP_URL}/news\n`;
      break;
    }
    case "transfer_rec":
      text += `Your weekly transfer recommendations are ready.\n\n`;
      text += `View Recommendations: ${APP_URL}/transfers\n`;
      break;
    case "league_update": {
      const d = data as LeagueUpdateData | undefined;
      if (d) {
        text += `${d.league_name} - GW${d.gameweek}\n\n`;
        text += `Your rank: ${d.your_rank.toLocaleString()}\n`;
        text += `Rank change: ${d.rank_change > 0 ? "↓" : d.rank_change < 0 ? "↑" : "→"} ${Math.abs(d.rank_change)} place${Math.abs(d.rank_change) !== 1 ? "s" : ""}\n`;
        text += `Points this GW: ${d.points_scored}\n`;
        text += `Gap to leader: ${d.gap_to_leader > 0 ? `-${d.gap_to_leader}` : `+${Math.abs(d.gap_to_leader)}`} points\n\n`;
      }
      text += `Analyze Your Leagues: ${APP_URL}/leagues/analyze\n`;
      break;
    }
    case "weekly_summary": {
      const d = data as WeeklySummaryData | undefined;
      if (d) {
        text += `Hi ${d.manager_name}!\n\n`;
        text += `GAMEWEEK ${d.gameweek} RECAP\n`;
        text += `-`.repeat(30) + `\n`;
        text += `GW Points: ${d.gw_points}\n`;
        text += `Overall Rank: ${d.overall_rank.toLocaleString()}`;
        text +=
          d.rank_change !== 0
            ? ` (${d.rank_change < 0 ? "↑" : "↓"}${Math.abs(d.rank_change).toLocaleString()})\n`
            : "\n";
        text += `Captain: ${d.captain_name} (${d.captain_points} pts)\n\n`;
        text += `${d.ai_recap}\n\n`;

        text += `TRANSFER SUGGESTIONS\n`;
        text += `-`.repeat(30) + `\n`;
        text += `${d.ai_transfer_suggestions}\n\n`;
        text += `View recommendations: ${APP_URL}/transfers\n\n`;

        text += `CAPTAIN PICKS\n`;
        text += `-`.repeat(30) + `\n`;
        text += `${d.ai_captain_picks}\n\n`;
        text += `View captain selector: ${APP_URL}/captain\n\n`;

        if (d.ai_chip_advice) {
          text += `CHIP STRATEGY\n`;
          text += `-`.repeat(30) + `\n`;
          text += `${d.ai_chip_advice}\n\n`;
        }

        if (d.price_risers.length > 0 || d.price_fallers.length > 0) {
          text += `PRICE ALERTS\n`;
          text += `-`.repeat(30) + `\n`;
          if (d.price_risers.length > 0) {
            text += `Likely to rise: ${d.price_risers.map((p) => `${p.name} (${p.probability}%)`).join(", ")}\n`;
          }
          if (d.price_fallers.length > 0) {
            text += `Likely to fall: ${d.price_fallers.map((p) => `${p.name} (${p.probability}%)`).join(", ")}\n`;
          }
          text += `\n`;
        }

        if (d.leagues.length > 0) {
          text += `MINI-LEAGUE UPDATE\n`;
          text += `-`.repeat(30) + `\n`;
          for (const l of d.leagues.slice(0, 3)) {
            text += `${l.name}: Rank ${l.rank}`;
            text +=
              l.rank_change !== 0
                ? ` (${l.rank_change > 0 ? "↓" : "↑"}${Math.abs(l.rank_change)})`
                : "";
            text += ` | Gap: ${l.gap_to_top > 0 ? `-${l.gap_to_top}` : `+${Math.abs(l.gap_to_top)}`} pts\n`;
          }
          text += `\n`;
        }
      }
      text += `Open FPL Insights: ${APP_URL}\n`;
      break;
    }
    default:
      text += `Open FPL Insights: ${APP_URL}\n`;
  }

  text += `\n${"=".repeat(40)}\n`;
  text += `You're receiving this because you enabled email notifications.\n`;
  text += `Manage preferences: ${APP_URL}/notifications\n`;

  return text;
}

/**
 * Send an email notification
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const resend = getResend();

  if (!resend) {
    return {
      success: false,
      error: "Email service not configured (missing RESEND_API_KEY)",
    };
  }

  try {
    const html = generateEmailHtml(payload.type, payload.title, payload.data);
    const text = generateEmailText(payload.type, payload.title, payload.data);

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: payload.to,
      subject: `FPL Insights: ${payload.title}`,
      html,
      text,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send batch emails (with rate limiting)
 */
export async function sendBatchEmails(
  payloads: EmailPayload[],
  options?: { delayMs?: number },
): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = { success: 0, failed: 0, errors: [] as string[] };
  const delayMs = options?.delayMs || 100; // Default 100ms between emails

  for (const payload of payloads) {
    const result = await sendEmail(payload);
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push(`${payload.to}: ${result.error}`);
    }

    // Small delay to respect rate limits
    if (delayMs > 0 && payloads.indexOf(payload) < payloads.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
