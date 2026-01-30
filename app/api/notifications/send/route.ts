import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  NotificationType,
  NotificationPreferences,
  PushSubscriptionJSON,
} from "@/lib/notifications/types";
import {
  isInQuietHours,
  shouldRespectQuietHours,
} from "@/lib/notifications/quiet-hours";
import { timingSafeCompare } from "@/lib/utils/timing-safe";
import {
  notificationSendSchema,
  validationErrorResponse,
} from "@/lib/api/validation";

// Lazy initialization for build time
let vapidConfigured = false;
let db: SupabaseClient | null = null;

function initializeServices() {
  // Initialize web-push with VAPID keys
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT =
    process.env.VAPID_SUBJECT || "mailto:admin@fplinsights.com";

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && !vapidConfigured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  }

  // Initialize Supabase admin client
  if (!db) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      db = createClient(supabaseUrl, supabaseServiceKey);
    }
  }

  return { vapidConfigured, db };
}

interface SendNotificationRequest {
  user_id?: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
  // If no user_id, can specify criteria to select users
  criteria?: {
    push_enabled?: boolean;
    push_price_changes?: boolean;
    push_injury_news?: boolean;
    push_deadline_reminder?: boolean;
    push_league_updates?: boolean;
  };
}

interface SendResult {
  success: number;
  failed: number;
  errors: string[];
}

/**
 * POST /api/notifications/send
 *
 * Send push notifications to users.
 * Protected by API key for server-to-server calls.
 */
export async function POST(request: NextRequest) {
  // Validate API key using constant-time comparison to prevent timing attacks
  const apiKey = request.headers.get("x-api-key");
  if (!timingSafeCompare(apiKey, process.env.NOTIFICATIONS_API_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Initialize services
  const { vapidConfigured: isVapidConfigured, db: db } = initializeServices();

  // Check VAPID configuration
  if (!isVapidConfigured) {
    return NextResponse.json(
      { error: "Push notifications not configured (missing VAPID keys)" },
      { status: 503 },
    );
  }

  // Check Supabase configuration
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const rawBody = await request.json();

    // Validate request with Zod
    const parseResult = notificationSendSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(validationErrorResponse(parseResult.error), {
        status: 400,
      });
    }

    const body = parseResult.data as SendNotificationRequest;
    const {
      user_id,
      type,
      title,
      body: notificationBody,
      url,
      data,
      criteria,
    } = body;

    // Build query for notification preferences
    // Include quiet hours fields for filtering
    let query = db
      .from("notification_preferences")
      .select(
        "user_id, push_subscription, quiet_hours_start, quiet_hours_end, timezone",
      )
      .eq("push_enabled", true)
      .not("push_subscription", "is", null);

    // Filter by specific user if provided
    if (user_id) {
      query = query.eq("user_id", user_id);
    }

    // Filter by notification type preference
    if (criteria) {
      if (criteria.push_price_changes !== undefined) {
        query = query.eq("push_price_changes", criteria.push_price_changes);
      }
      if (criteria.push_injury_news !== undefined) {
        query = query.eq("push_injury_news", criteria.push_injury_news);
      }
      if (criteria.push_deadline_reminder !== undefined) {
        query = query.eq(
          "push_deadline_reminder",
          criteria.push_deadline_reminder,
        );
      }
      if (criteria.push_league_updates !== undefined) {
        query = query.eq("push_league_updates", criteria.push_league_updates);
      }
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 },
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        message: "No eligible subscribers found",
      });
    }

    // Filter out users in quiet hours (unless this notification type bypasses quiet hours)
    const now = new Date();
    const filteredSubscriptions = shouldRespectQuietHours(type)
      ? subscriptions.filter((sub) => {
          const prefs = {
            quiet_hours_start: sub.quiet_hours_start,
            quiet_hours_end: sub.quiet_hours_end,
            timezone: sub.timezone,
          } as NotificationPreferences;
          return !isInQuietHours(prefs, now);
        })
      : subscriptions;

    if (filteredSubscriptions.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        skipped: subscriptions.length,
        message: "All subscribers are in quiet hours",
      });
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      type,
      title,
      body: notificationBody,
      url: url || "/",
      data: data || {},
    });

    // Send notifications in parallel
    const results: SendResult = { success: 0, failed: 0, errors: [] };
    const historyRecords: Array<{
      user_id: string;
      notification_type: string;
      channel: string;
      title: string;
      body: string;
      data: Record<string, unknown> | null;
    }> = [];

    await Promise.all(
      filteredSubscriptions.map(
        async ({ user_id: recipientId, push_subscription }) => {
          const subscription = push_subscription as PushSubscriptionJSON;

          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: subscription.keys,
              },
              payload,
            );

            results.success++;
            historyRecords.push({
              user_id: recipientId,
              notification_type: type,
              channel: "push",
              title,
              body: notificationBody,
              data: data || null,
            });
          } catch (error) {
            results.failed++;
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            results.errors.push(`User ${recipientId}: ${errorMessage}`);

            // If subscription is invalid/expired, remove it
            if (
              error instanceof webpush.WebPushError &&
              (error.statusCode === 404 || error.statusCode === 410)
            ) {
              await db
                .from("notification_preferences")
                .update({ push_enabled: false, push_subscription: null })
                .eq("user_id", recipientId);
            }
          }
        },
      ),
    );

    // Save notification history
    if (historyRecords.length > 0) {
      await db.from("notification_history").insert(historyRecords);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error sending notifications:", error);
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 },
    );
  }
}
