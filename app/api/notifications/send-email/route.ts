import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

let db: SupabaseClient | null = null;

function getDb(): SupabaseClient | null {
  if (!db) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseServiceKey) {
      db = createClient(supabaseUrl, supabaseServiceKey);
    }
  }
  return db;
}

interface SendEmailRequest {
  user_id?: string;
  type: NotificationType;
  title: string;
  data?: Record<string, unknown>;
  // If no user_id, can specify criteria to select users
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
  // Validate API key using constant-time comparison to prevent timing attacks
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

  const database = getDb();
  if (!database) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const body: SendEmailRequest = await request.json();
    const { user_id, type, title, data, criteria } = body;

    // Validate required fields
    if (!type || !title) {
      return NextResponse.json(
        { error: "Missing required fields: type, title" },
        { status: 400 },
      );
    }

    // Build query for notification preferences
    // Include quiet hours fields for filtering
    let query = database
      .from("notification_preferences")
      .select(
        "user_id, email_address, quiet_hours_start, quiet_hours_end, timezone",
      )
      .eq("email_enabled", true)
      .not("email_address", "is", null);

    // Filter by specific user if provided
    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    // Filter by notification type preference
    if (criteria) {
      if (criteria.email_deadline_reminder !== undefined) {
        query = query.eq(
          "email_deadline_reminder",
          criteria.email_deadline_reminder,
        );
      }
      if (criteria.email_weekly_summary !== undefined) {
        query = query.eq("email_weekly_summary", criteria.email_weekly_summary);
      }
      if (criteria.email_transfer_recommendations !== undefined) {
        query = query.eq(
          "email_transfer_recommendations",
          criteria.email_transfer_recommendations,
        );
      }
    }

    const { data: recipients, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching recipients:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch recipients" },
        { status: 500 },
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        message: "No eligible recipients found",
      });
    }

    // Filter out users in quiet hours (unless this notification type bypasses quiet hours)
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
    const historyRecords = filteredRecipients.map((r) => ({
      user_id: r.user_id,
      notification_type: type,
      channel: "email" as const,
      title,
      body: title, // For emails, body is same as title in history
      data: data || null,
    }));

    if (historyRecords.length > 0) {
      await database.from("notification_history").insert(historyRecords);
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
