import { NextRequest, NextResponse } from "next/server";
import { sendBatchEmails } from "@/lib/notifications/email-client";
import type {
  NotificationType,
  NotificationPreferences,
} from "@/lib/notifications/types";
import {
  isInQuietHours,
  shouldRespectQuietHours,
} from "@/lib/notifications/quiet-hours";
import { timingSafeCompare } from "@/lib/utils/timing-safe";
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  getAllEnabledEmailSubscriptions,
  logNotification,
} from "@/lib/db/notifications";

interface SendEmailRequest {
  session_id?: string;
  type: NotificationType;
  title: string;
  data?: Record<string, unknown>;
  criteria?: {
    email_enabled?: boolean;
    email_deadline_reminder?: boolean;
    email_weekly_summary?: boolean;
    email_transfer_recommendations?: boolean;
  };
}

/**
 * POST /api/notifications/send-email
 *
 * Send email notifications to users.
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

  // Check email service configuration
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured (missing RESEND_API_KEY)" },
      { status: 503 },
    );
  }

  try {
    const body: SendEmailRequest = await request.json();
    const { session_id, type, title, data, criteria } = body;

    // Validate required fields
    if (!type || !title) {
      return NextResponse.json(
        { error: "Missing required fields: type, title" },
        { status: 400 },
      );
    }

    // Get all enabled email subscriptions from SQLite
    let recipients = getAllEnabledEmailSubscriptions();

    // Filter by specific session if provided
    if (session_id) {
      recipients = recipients.filter((r) => r.session_id === session_id);
    }

    // Filter by notification type preference
    if (criteria) {
      recipients = recipients.filter((r) => {
        if (
          criteria.email_deadline_reminder !== undefined &&
          r.email_deadline_reminder !== criteria.email_deadline_reminder
        ) {
          return false;
        }
        if (
          criteria.email_weekly_summary !== undefined &&
          r.email_weekly_summary !== criteria.email_weekly_summary
        ) {
          return false;
        }
        if (
          criteria.email_transfer_recommendations !== undefined &&
          r.email_transfer_recommendations !==
            criteria.email_transfer_recommendations
        ) {
          return false;
        }
        return true;
      });
    }

    if (recipients.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        message: "No eligible recipients found",
      });
    }

    // Filter out users in quiet hours
    const now = new Date();
    const filteredRecipients = shouldRespectQuietHours(type)
      ? recipients.filter((r) => {
          const prefs = {
            quiet_hours_start: r.quiet_hours_start,
            quiet_hours_end: r.quiet_hours_end,
            timezone: r.timezone,
          } as NotificationPreferences;
          return !isInQuietHours(prefs, now);
        })
      : recipients;

    if (filteredRecipients.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        skipped: recipients.length,
        message: "All recipients are in quiet hours",
      });
    }

    // Send emails
    const payloads = filteredRecipients.map((r) => ({
      to: r.email_address as string,
      type,
      title,
      data,
    }));

    const results = await sendBatchEmails(payloads);

    // Log to notification history
    for (const r of filteredRecipients) {
      logNotification(r.session_id, type, "email", title, title, data);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error sending email notifications:", error);
    return NextResponse.json(
      { error: "Failed to send email notifications" },
      { status: 500 },
    );
  }
}
