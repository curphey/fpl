import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPreferenceBySession,
  upsertPreference,
} from "@/lib/db/notifications";
import type { NotificationPreference } from "@/lib/db/notifications";
import type { PushSubscriptionJSON } from "@/lib/notifications/types";
import { withRateLimit } from "@/lib/api/rate-limit";

const preferencesUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  email_enabled: z.boolean().optional(),
  email_address: z.string().email().nullable().optional(),
  email_deadline_reminder: z.boolean().optional(),
  email_deadline_hours: z.number().int().min(1).max(48).optional(),
  email_weekly_summary: z.boolean().optional(),
  email_transfer_recommendations: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  push_subscription: z.unknown().optional(),
  push_deadline_reminder: z.boolean().optional(),
  push_deadline_hours: z.number().int().min(1).max(48).optional(),
  push_price_changes: z.boolean().optional(),
  push_injury_news: z.boolean().optional(),
  push_league_updates: z.boolean().optional(),
  quiet_hours_start: z.number().int().min(0).max(23).nullable().optional(),
  quiet_hours_end: z.number().int().min(0).max(23).nullable().optional(),
  timezone: z.string().max(50).optional(),
});

// Convert SQLite row to API response format
function formatPreference(
  pref: NotificationPreference,
): Record<string, unknown> {
  return {
    ...pref,
    // Parse push_subscription from JSON string if present
    push_subscription: pref.push_subscription
      ? JSON.parse(pref.push_subscription)
      : null,
  };
}

export async function GET(req: NextRequest) {
  const rateLimitResponse = await withRateLimit(req, "notifications");
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const pref = getPreferenceBySession(sessionId);
  if (!pref) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  return NextResponse.json(formatPreference(pref));
}

export async function POST(req: NextRequest) {
  const rateLimitResponse = await withRateLimit(req, "notifications");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await req.json();
    const parseResult = preferencesUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          code: "VALIDATION_ERROR",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { sessionId, ...updates } = parseResult.data;

    // Convert push_subscription to JSON string if present
    const dataToStore = { ...updates } as Record<string, unknown>;
    if (updates.push_subscription !== undefined) {
      dataToStore.push_subscription = updates.push_subscription
        ? JSON.stringify(updates.push_subscription as PushSubscriptionJSON)
        : null;
    }

    upsertPreference(sessionId, dataToStore);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }
}
