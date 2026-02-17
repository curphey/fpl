import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createSession,
  getSession,
  updateSession,
  touchSession,
} from "@/lib/db/sessions";
import { withRateLimit } from "@/lib/api/rate-limit";

const sessionUpdateSchema = z.object({
  id: z.string().uuid("Invalid session ID"),
  fpl_manager_id: z
    .number()
    .int()
    .positive()
    .max(15_000_000)
    .nullable()
    .optional(),
  display_name: z.string().max(100).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const rateLimitResponse = await withRateLimit(request, "notifications");
  if (rateLimitResponse) return rateLimitResponse;

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing id", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const session = getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  touchSession(id);
  return NextResponse.json(session);
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await withRateLimit(request, "notifications");
  if (rateLimitResponse) return rateLimitResponse;

  const session = createSession();
  return NextResponse.json(session);
}

export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await withRateLimit(request, "notifications");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const parseResult = sessionUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: parseResult.error.issues,
      },
      { status: 400 },
    );
  }

  const { id, ...data } = parseResult.data;

  const session = getSession(id);
  if (!session) {
    return NextResponse.json(
      { error: "Not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  updateSession(id, data);
  return NextResponse.json({ success: true });
}
