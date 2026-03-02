import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/fpl/auth-client", () => ({
  getFplSession: vi.fn(),
  authenticatedFetch: vi.fn(),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";

const mockSession = {
  managerName: "Tim",
  entryId: 123,
  expiresAt: "2099-01-01T00:00:00Z",
};

function makeReq(managerId?: string) {
  const url = managerId
    ? `http://localhost/api/fpl/my-team?managerId=${managerId}`
    : "http://localhost/api/fpl/my-team";
  return new NextRequest(url);
}

beforeEach(() => vi.resetAllMocks());

describe("GET /api/fpl/my-team", () => {
  it("returns 400 for missing managerId", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("returns 401 when not FPL authenticated", async () => {
    vi.mocked(getFplSession).mockReturnValue(null);
    const res = await GET(makeReq("123"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns picks when authenticated", async () => {
    vi.mocked(getFplSession).mockReturnValue(mockSession);
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          picks: [
            {
              element: 1,
              position: 1,
              multiplier: 1,
              is_captain: false,
              is_vice_captain: false,
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const res = await GET(makeReq("123"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.picks).toHaveLength(1);
    expect(body.picks[0].element).toBe(1);
  });

  it("returns 401 when authenticatedFetch throws FPL_SESSION_EXPIRED", async () => {
    vi.mocked(getFplSession).mockReturnValue(mockSession);
    vi.mocked(authenticatedFetch).mockRejectedValue(
      new Error("FPL_SESSION_EXPIRED"),
    );
    const res = await GET(makeReq("123"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when authenticatedFetch throws FPL_UNAUTHORIZED", async () => {
    vi.mocked(getFplSession).mockReturnValue(mockSession);
    vi.mocked(authenticatedFetch).mockRejectedValue(
      new Error("FPL_UNAUTHORIZED"),
    );
    const res = await GET(makeReq("123"));
    expect(res.status).toBe(401);
  });

  it("returns error when FPL API returns non-ok response", async () => {
    vi.mocked(getFplSession).mockReturnValue(mockSession);
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(null, { status: 403 }),
    );
    const res = await GET(makeReq("123"));
    expect(res.status).not.toBe(200);
    const body = await res.json();
    expect(body.code).toBe("FPL_API_ERROR");
  });
});
