import { NextResponse } from "next/server";
import {
  createSession,
  getSession,
  updateSession,
  touchSession,
} from "@/lib/db/sessions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  touchSession(id);
  return NextResponse.json(session);
}

export async function POST() {
  const session = createSession();
  return NextResponse.json(session);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  updateSession(id, data);
  return NextResponse.json({ success: true });
}
