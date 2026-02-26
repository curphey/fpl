import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { createErrorResponse } from "@/lib/api/errors";
import { getSession } from "@/lib/db/sessions";
import { getFplSession } from "@/lib/fpl/auth-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return createErrorResponse("sessionId is required", "UNAUTHORIZED");
  }
  const session = getSession(sessionId);
  if (!session) {
    return createErrorResponse("Session not found", "UNAUTHORIZED");
  }

  // Single-user design: FPL credentials are stored globally in app_settings,
  // not per-session. Any authenticated session can read the connection status.
  const fplSession = getFplSession();
  if (!fplSession) {
    return NextResponse.json({
      connected: false,
      managerName: null,
      expiresAt: null,
    });
  }

  return NextResponse.json({
    connected: true,
    managerName: fplSession.managerName,
    expiresAt: fplSession.expiresAt,
  });
}
