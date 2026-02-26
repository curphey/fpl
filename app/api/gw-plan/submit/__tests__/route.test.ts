import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db/sessions", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/db/gw-plan", () => ({ getGwPlanById: vi.fn() }));
vi.mock("@/lib/fpl/auth-client", () => ({
  getFplSession: vi.fn(),
  authenticatedFetch: vi.fn(),
}));
vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getBootstrapStatic: vi.fn(),
    getManagerPicks: vi.fn(),
  },
}));

import { POST } from "../route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/db/sessions";
import { getGwPlanById } from "@/lib/db/gw-plan";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";
import { fplClient } from "@/lib/fpl/client";
import type { GwPlan } from "@/lib/db/gw-plan";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const mockSession = {
  id: SESSION_ID,
  fpl_manager_id: 123,
  display_name: "Tim",
  created_at: "",
  last_seen_at: "",
};
const mockFplSession = {
  cookie: "pl_profile=X; csrftoken=csrf123",
  managerName: "Tim",
  expiresAt: "2026-12-01T00:00:00Z",
};
const mockPlan: GwPlan = {
  id: "plan-1",
  sessionId: SESSION_ID,
  gameweek: 28,
  plan: {
    predictedTeamPoints: 60,
    captain: { playerId: 100, name: "Salah", reasoning: "great fixtures" },
    transfers: [
      {
        playerOut: { id: 10, name: "OldPlayer", predicted4GW: 10 },
        playerIn: { id: 20, name: "NewPlayer", predicted4GW: 15 },
        pointsGain: 5,
        hitCost: 0,
        reasoning: "upgrade",
      },
    ],
    notes: "",
  },
  thinking: "",
  generatedAt: "2026-02-26T00:00:00Z",
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/gw-plan/submit", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/gw-plan/submit", () => {
  it("returns 400 for missing fields", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not FPL authenticated", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(null);
    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: "plan-1", confirm: false }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when plan not found", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(null);
    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: "plan-1", confirm: false }),
    );
    expect(res.status).toBe(404);
  });

  it("returns validation details on confirm: false", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue({
      elements: [
        {
          id: 10,
          now_cost: 100,
          element_type: 2,
          web_name: "OldPlayer",
          team: 1,
        },
        {
          id: 20,
          now_cost: 110,
          element_type: 2,
          web_name: "NewPlayer",
          team: 2,
        },
      ],
    } as never);
    vi.mocked(fplClient.getManagerPicks).mockResolvedValue({
      picks: [
        {
          element: 10,
          position: 1,
          multiplier: 1,
          is_captain: false,
          is_vice_captain: false,
          selling_price: 105,
        },
      ],
      entry_history: {
        bank: 10,
        event_transfers: 0,
        event_transfers_cost: 0,
        points: 55,
        total_points: 1200,
        rank: 5000,
        event: 28,
      },
      active_chip: null,
    } as never);
    // FPL validation POST (confirm: false) — dry-run
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: "plan-1", confirm: false }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.transfers).toHaveLength(1);
    expect(body.transfers[0].elementIn).toBe(20);
    expect(body.transfers[0].elementOut).toBe(10);
  });

  it("returns submitted: true on confirm: true", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue({
      elements: [
        {
          id: 10,
          now_cost: 100,
          element_type: 2,
          web_name: "OldPlayer",
          team: 1,
        },
        {
          id: 20,
          now_cost: 110,
          element_type: 2,
          web_name: "NewPlayer",
          team: 2,
        },
      ],
    } as never);
    vi.mocked(fplClient.getManagerPicks).mockResolvedValue({
      picks: [],
      entry_history: {
        bank: 10,
        event_transfers: 0,
        event_transfers_cost: 0,
        points: 55,
        total_points: 1200,
        rank: 5000,
        event: 28,
      },
      active_chip: null,
    } as never);
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(JSON.stringify({ transfers_made: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: "plan-1", confirm: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submitted).toBe(true);
  });
});
