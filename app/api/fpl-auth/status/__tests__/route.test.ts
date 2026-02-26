import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/fpl/auth-client", () => ({ getFplSession: vi.fn() }));
vi.mock("@/lib/db/settings", () => ({ getSetting: vi.fn() }));

import { GET } from "../route";
import { NextRequest } from "next/server";
import { getFplSession } from "@/lib/fpl/auth-client";
import { getSetting } from "@/lib/db/settings";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/fpl-auth/status", () => {
  it("returns connected: false when no session", async () => {
    vi.mocked(getFplSession).mockReturnValue(null);
    vi.mocked(getSetting).mockReturnValue(null);
    const res = await GET(
      new NextRequest("http://localhost/api/fpl-auth/status"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.managerName).toBeNull();
    expect(body.expiresAt).toBeNull();
  });

  it("returns connected: true with manager name and expiry when session valid", async () => {
    vi.mocked(getFplSession).mockReturnValue({
      cookie: "pl_profile=X",
      managerName: "Tim Smith",
    });
    vi.mocked(getSetting).mockImplementation((key: string) => {
      if (key === "fpl_session_expires") return "2026-12-01T00:00:00Z";
      return null;
    });
    const res = await GET(
      new NextRequest("http://localhost/api/fpl-auth/status"),
    );
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.managerName).toBe("Tim Smith");
    expect(body.expiresAt).toBe("2026-12-01T00:00:00Z");
  });
});
