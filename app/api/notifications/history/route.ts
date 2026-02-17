import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationHistory,
  markNotificationRead,
} from "@/lib/db/notifications";
import { withRateLimit } from "@/lib/api/rate-limit";

export async function GET(req: NextRequest) {
  const rateLimitResponse = await withRateLimit(req, "notifications");
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const limitParam = searchParams.get("limit");
  const limit = limitParam
    ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100)
    : 50;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const history = getNotificationHistory(sessionId, limit);

  // Parse data JSON for each entry
  const formatted = history.map((h) => ({
    ...h,
    data: h.data ? JSON.parse(h.data) : null,
  }));

  return NextResponse.json(formatted);
}

export async function PATCH(req: NextRequest) {
  const rateLimitResponse = await withRateLimit(req, "notifications");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await req.json();
  const { sessionId, notificationId } = body;

  if (!sessionId || !notificationId) {
    return NextResponse.json(
      { error: "Missing sessionId or notificationId" },
      { status: 400 },
    );
  }

  markNotificationRead(notificationId, sessionId);
  return NextResponse.json({ success: true });
}
