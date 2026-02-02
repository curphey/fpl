import { NextResponse } from "next/server";
import {
  getPreferenceBySession,
  upsertPreference,
} from "@/lib/db/notifications";
import type { NotificationPreference } from "@/lib/db/notifications";
import type { PushSubscriptionJSON } from "@/lib/notifications/types";

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const pref = getPreferenceBySession(sessionId);
  if (!pref) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(formatPreference(pref));
}

export async function POST(req: Request) {
  const body = await req.json();
  const { sessionId, ...updates } = body;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  // Convert push_subscription to JSON string if present
  const dataToStore = { ...updates };
  if (updates.push_subscription !== undefined) {
    dataToStore.push_subscription = updates.push_subscription
      ? JSON.stringify(updates.push_subscription as PushSubscriptionJSON)
      : null;
  }

  upsertPreference(sessionId, dataToStore);
  return NextResponse.json({ success: true });
}
