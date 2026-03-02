import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/fpl/auth-client", () => ({
  connectFplTokens: vi.fn(),
}));

import { POST, OPTIONS } from "../route";
import { NextRequest } from "next/server";
import { connectFplTokens } from "@/lib/fpl/auth-client";

const mockConnect = vi.mocked(connectFplTokens);

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/fpl-auth/connect", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://fantasy.premierleague.com",
    },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("OPTIONS /api/fpl-auth/connect", () => {
  it("returns 200 with CORS headers for preflight", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://fantasy.premierleague.com",
    );
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("POST /api/fpl-auth/connect", () => {
  it("returns 400 for missing fields", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty access_token", async () => {
    const res = await POST(
      makeRequest({ access_token: "", refresh_token: "rt" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when connectFplTokens throws FPL_INVALID_TOKEN", async () => {
    mockConnect.mockRejectedValueOnce(new Error("FPL_INVALID_TOKEN"));
    const res = await POST(
      makeRequest({ access_token: "at", refresh_token: "rt" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid FPL token");
  });

  it("returns 200 and CORS header on success", async () => {
    mockConnect.mockResolvedValueOnce({
      managerName: "Tim Smith",
      entryId: 4343974,
      expiresAt: "2026-12-01T00:00:00Z",
    });
    const res = await POST(
      makeRequest({ access_token: "at", refresh_token: "rt" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.managerName).toBe("Tim Smith");
    expect(body.entryId).toBe(4343974);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://fantasy.premierleague.com",
    );
  });

  it("returns 500 when connectFplTokens throws unexpected error", async () => {
    mockConnect.mockRejectedValueOnce(new Error("DB error"));
    const res = await POST(
      makeRequest({ access_token: "at", refresh_token: "rt" }),
    );
    expect(res.status).toBe(500);
  });

  it("returns 429 with CORS header when rate limited", async () => {
    const { rateLimit } = await import("@/lib/api/rate-limit");
    vi.mocked(rateLimit).mockResolvedValueOnce(
      new Response(null, { status: 429 }) as never,
    );
    const res = await POST(
      makeRequest({ access_token: "at", refresh_token: "rt" }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://fantasy.premierleague.com",
    );
  });
});
