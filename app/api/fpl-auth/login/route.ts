import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { getSession } from "@/lib/db/sessions";
import { fplLogin, storeFplCredentials } from "@/lib/fpl/auth-client";

export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "fpl");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return createValidationErrorResponse(parsed.error);

  const { sessionId, email, password } = parsed.data;

  const session = getSession(sessionId);
  if (!session) return createErrorResponse("Session not found", "NOT_FOUND");

  const result = await fplLogin(email, password);

  if (!result.success) {
    if (result.error === "INVALID_CREDENTIALS") {
      return createErrorResponse("Invalid FPL credentials", "UNAUTHORIZED");
    }
    return createErrorResponse(result.message, "SERVICE_UNAVAILABLE");
  }

  storeFplCredentials(
    email,
    password,
    result.sessionCookie,
    result.expiresAt,
    result.managerName,
  );

  return NextResponse.json({
    connected: true,
    managerName: result.managerName,
    expiresAt: result.expiresAt,
  });
}
