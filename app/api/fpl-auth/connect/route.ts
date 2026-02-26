import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rate-limit";
import {
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/errors";
import { connectFplTokens } from "@/lib/fpl/auth-client";

export const runtime = "nodejs";

const CORS_ORIGIN = "https://fantasy.premierleague.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const bodySchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await rateLimit(request, "auth");
  if (rl) return rl;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    const res = createValidationErrorResponse(parsed.error);
    Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }

  const { access_token, refresh_token } = parsed.data;

  try {
    const { managerName, entryId, expiresAt } = await connectFplTokens(
      access_token,
      refresh_token,
    );
    const response = NextResponse.json({
      ok: true,
      managerName,
      entryId,
      expiresAt,
    });
    Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "FPL_INVALID_TOKEN") {
      const res = createErrorResponse("Invalid FPL token", "UNAUTHORIZED");
      Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const res = createErrorResponse(
      "Failed to connect FPL account",
      "INTERNAL_ERROR",
    );
    Object.entries(corsHeaders).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
}
