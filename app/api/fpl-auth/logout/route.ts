import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { getSession } from "@/lib/db/sessions";
import { clearFplCredentials } from "@/lib/fpl/auth-client";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
});

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const session = getSession(parsed.data.sessionId);
  if (!session) return createErrorResponse("Session not found", "NOT_FOUND");

  // Single-user design: FPL credentials are stored globally in app_settings.
  // Any authenticated session can trigger logout. For multi-user support this
  // would need per-session credential storage.
  clearFplCredentials();
  return NextResponse.json({ ok: true });
}
