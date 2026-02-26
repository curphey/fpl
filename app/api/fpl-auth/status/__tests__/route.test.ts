import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/fpl/auth-client", () => ({ getFplSession: vi.fn() }));
vi.mock("@/lib/db/sessions", () => ({ getSession: vi.fn() }));

import { GET } from "../route";
import { NextRequest } from "next/server";
import { getFplSession } from "@/lib/fpl/auth-client";
import { getSession } from "@/lib/db/sessions";

const VALID_SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const validSession = {
  id: VALID_SESSION_ID,
  fpl_manager_id: null,
  display_name: null,
  created_at: "",
  last_seen_at: "",
};

function makeRequest(sessionId?: string) {
  const url = sessionId
    ? `http://localhost/api/fpl-auth/status?sessionId=${sessionId}`
    : "http://localhost/api/fpl-auth/status";
  return new NextRequest(url);
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/fpl-auth/status", () => {
  it("returns 401 when no sessionId provided", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when session not found", async () => {
    vi.mocked(getSession).mockReturnValue(null);
    const res = await GET(makeRequest(VALID_SESSION_ID));
    expect(res.status).toBe(401);
  });

  it("returns connected: false when no FPL session", async () => {
    vi.mocked(getSession).mockReturnValue(validSession);
    vi.mocked(getFplSession).mockReturnValue(null);
    const res = await GET(makeRequest(VALID_SESSION_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.managerName).toBeNull();
    expect(body.expiresAt).toBeNull();
  });

  it("returns connected: true with manager name and expiry", async () => {
    vi.mocked(getSession).mockReturnValue(validSession);
    vi.mocked(getFplSession).mockReturnValue({
      cookie: "pl_profile=X",
      managerName: "Tim Smith",
      expiresAt: "2026-12-01T00:00:00Z",
    });
    const res = await GET(makeRequest(VALID_SESSION_ID));
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.managerName).toBe("Tim Smith");
    expect(body.expiresAt).toBe("2026-12-01T00:00:00Z");
  });
});
