import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
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
import { withRateLimit } from "@/lib/api/rate-limit";
import {
  getAllEnabledPushSubscriptions,
  logNotification,
  upsertPreference,
} from "@/lib/db/notifications";

// Lazy initialization for build time
let vapidConfigured = false;

function initializeVapid() {
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
  const VAPID_SUBJECT =
    process.env.VAPID_SUBJECT || "mailto:admin@fplinsights.com";

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && !vapidConfigured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  }

  return vapidConfigured;
}

interface SendNotificationRequest {
  session_id?: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
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
  // Check rate limit
  const rateLimitResponse = await withRateLimit(request, "notifications");
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Validate API key
  const apiKey = request.headers.get("x-api-key");
  if (!timingSafeCompare(apiKey, process.env.NOTIFICATIONS_API_KEY)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  // Initialize VAPID
  const isVapidConfigured = initializeVapid();
  if (!isVapidConfigured) {
    return NextResponse.json(
      { error: "Push notifications not configured (missing VAPID keys)" },
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
      session_id,
      type,
      title,
      body: notificationBody,
      url,
      data,
      criteria,
    } = body;

    // Get all enabled push subscriptions from SQLite
    let subscriptions = getAllEnabledPushSubscriptions();

    // Filter by specific session if provided
    if (session_id) {
      subscriptions = subscriptions.filter((s) => s.session_id === session_id);
    }

    // Filter by notification type preference
    if (criteria) {
      subscriptions = subscriptions.filter((sub) => {
        if (
          criteria.push_price_changes !== undefined &&
          sub.push_price_changes !== criteria.push_price_changes
        ) {
          return false;
        }
        if (
          criteria.push_injury_news !== undefined &&
          sub.push_injury_news !== criteria.push_injury_news
        ) {
          return false;
        }
        if (
          criteria.push_deadline_reminder !== undefined &&
          sub.push_deadline_reminder !== criteria.push_deadline_reminder
        ) {
          return false;
        }
        if (
          criteria.push_league_updates !== undefined &&
          sub.push_league_updates !== criteria.push_league_updates
        ) {
          return false;
        }
        return true;
      });
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: 0,
        failed: 0,
        message: "No eligible subscribers found",
      });
    }

    // Filter out users in quiet hours
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

    await Promise.all(
      filteredSubscriptions.map(async (sub) => {
        const pushSubJson = sub.push_subscription
          ? (JSON.parse(sub.push_subscription) as PushSubscriptionJSON)
          : null;

        if (!pushSubJson) {
          results.failed++;
          results.errors.push(`Session ${sub.session_id}: No subscription`);
          return;
        }

        try {
          await webpush.sendNotification(
            {
              endpoint: pushSubJson.endpoint,
              keys: pushSubJson.keys,
            },
            payload,
          );

          results.success++;

          // Log notification
          logNotification(
            sub.session_id,
            type,
            "push",
            title,
            notificationBody,
            data,
          );
        } catch (error) {
          results.failed++;
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          results.errors.push(`Session ${sub.session_id}: ${errorMessage}`);

          // If subscription is invalid/expired, disable it
          if (
            error instanceof webpush.WebPushError &&
            (error.statusCode === 404 || error.statusCode === 410)
          ) {
            upsertPreference(sub.session_id, {
              push_enabled: false,
              push_subscription: null,
            });
          }
        }
      }),
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error sending notifications:", error);
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 },
    );
  }
}
