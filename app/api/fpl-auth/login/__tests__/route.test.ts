import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db/sessions", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/fpl/auth-client", () => ({
  fplLogin: vi.fn(),
  storeFplCredentials: vi.fn(),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/db/sessions";
import { fplLogin, storeFplCredentials } from "@/lib/fpl/auth-client";

const mockGetSession = vi.mocked(getSession);
const mockFplLogin = vi.mocked(fplLogin);
const mockStore = vi.mocked(storeFplCredentials);

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

const validSession = {
  id: VALID_UUID,
  fpl_manager_id: 123,
  display_name: "Tim",
  created_at: "",
  last_seen_at: "",
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/fpl-auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/fpl-auth/login", () => {
  it("returns 400 for missing fields", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      makeRequest({
        sessionId: VALID_UUID,
        email: "not-an-email",
        password: "pw",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when session not found", async () => {
    mockGetSession.mockReturnValue(null);
    const res = await POST(
      makeRequest({ sessionId: VALID_UUID, email: "a@b.com", password: "pw" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 on INVALID_CREDENTIALS", async () => {
    mockGetSession.mockReturnValue(validSession);
    mockFplLogin.mockResolvedValue({
      success: false,
      error: "INVALID_CREDENTIALS",
      message: "bad creds",
    });
    const res = await POST(
      makeRequest({ sessionId: VALID_UUID, email: "a@b.com", password: "bad" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid FPL credentials");
  });

  it("returns 503 on CLOUDFLARE_BLOCKED", async () => {
    mockGetSession.mockReturnValue(validSession);
    mockFplLogin.mockResolvedValue({
      success: false,
      error: "CLOUDFLARE_BLOCKED",
      message: "blocked",
    });
    const res = await POST(
      makeRequest({ sessionId: VALID_UUID, email: "a@b.com", password: "pw" }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 503 on NETWORK_ERROR", async () => {
    mockGetSession.mockReturnValue(validSession);
    mockFplLogin.mockResolvedValue({
      success: false,
      error: "NETWORK_ERROR",
      message: "timeout",
    });
    const res = await POST(
      makeRequest({ sessionId: VALID_UUID, email: "a@b.com", password: "pw" }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 200 and stores credentials on success", async () => {
    mockGetSession.mockReturnValue(validSession);
    mockFplLogin.mockResolvedValue({
      success: true,
      managerName: "Tim Smith",
      sessionCookie: "pl_profile=X",
      expiresAt: "2026-12-01T00:00:00Z",
    });
    const res = await POST(
      makeRequest({ sessionId: VALID_UUID, email: "a@b.com", password: "pw" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.managerName).toBe("Tim Smith");
    expect(body.expiresAt).toBe("2026-12-01T00:00:00Z");
    expect(mockStore).toHaveBeenCalledWith(
      "a@b.com",
      "pw",
      "pl_profile=X",
      "2026-12-01T00:00:00Z",
      "Tim Smith",
    );
  });

  it("returns 500 when storeFplCredentials throws", async () => {
    mockGetSession.mockReturnValue(validSession);
    mockFplLogin.mockResolvedValue({
      success: true,
      managerName: "Tim Smith",
      sessionCookie: "pl_profile=X",
      expiresAt: "2026-12-01T00:00:00Z",
    });
    mockStore.mockImplementation(() => {
      throw new Error("DB full");
    });
    const res = await POST(
      makeRequest({ sessionId: VALID_UUID, email: "a@b.com", password: "pw" }),
    );
    expect(res.status).toBe(500);
  });
});
