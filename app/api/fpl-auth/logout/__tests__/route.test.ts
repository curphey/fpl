import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db/sessions", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/fpl/auth-client", () => ({ clearFplCredentials: vi.fn() }));

import { DELETE } from "../route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/db/sessions";
import { clearFplCredentials } from "@/lib/fpl/auth-client";

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/fpl-auth/logout", () => {
  it("returns 400 for missing sessionId", async () => {
    const res = await DELETE(
      new NextRequest("http://localhost/api/fpl-auth/logout", {
        method: "DELETE",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown session", async () => {
    vi.mocked(getSession).mockReturnValue(null);
    const res = await DELETE(
      new NextRequest("http://localhost/api/fpl-auth/logout", {
        method: "DELETE",
        body: JSON.stringify({ sessionId: "bad" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(404);
  });

  it("clears credentials and returns ok: true", async () => {
    vi.mocked(getSession).mockReturnValue({
      id: "s1",
      fpl_manager_id: null,
      display_name: null,
      created_at: "",
      last_seen_at: "",
    });
    const res = await DELETE(
      new NextRequest("http://localhost/api/fpl-auth/logout", {
        method: "DELETE",
        body: JSON.stringify({ sessionId: "s1" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(clearFplCredentials).toHaveBeenCalledOnce();
  });
});
