import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rate-limit";
import { getFplSession } from "@/lib/fpl/auth-client";
import { getSetting } from "@/lib/db/settings";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const session = getFplSession();
  if (!session) {
    return NextResponse.json({
      connected: false,
      managerName: null,
      expiresAt: null,
    });
  }

  return NextResponse.json({
    connected: true,
    managerName: session.managerName,
    expiresAt: getSetting("fpl_session_expires"),
  });
}
