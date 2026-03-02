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
  },
}));

import { POST } from "../route";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/db/sessions";
import { getGwPlanById } from "@/lib/db/gw-plan";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";
import { fplClient } from "@/lib/fpl/client";
import type { GwPlan } from "@/lib/db/gw-plan";
import type { BootstrapStatic } from "@/lib/fpl/types";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const PLAN_ID = "660e8400-e29b-41d4-a716-446655440001";
const mockSession = {
  id: SESSION_ID,
  fpl_manager_id: 123,
  display_name: "Tim",
  created_at: "",
  last_seen_at: "",
};
const mockFplSession = {
  managerName: "Tim",
  entryId: 123,
  expiresAt: "2026-12-01T00:00:00Z",
};
const mockPlan: GwPlan = {
  id: PLAN_ID,
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

/** Returns an authenticatedFetch mock that serves my-team data for /my-team/ URLs
 *  and the given transferResponse for the transfers URL. */
function mockAuthFetch(transferResponse: Response, myTeamPicks: object[] = []) {
  vi.mocked(authenticatedFetch).mockImplementation(async (url) => {
    if (String(url).includes("/my-team/")) {
      return new Response(JSON.stringify({ picks: myTeamPicks }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return transferResponse;
  });
}

const mockBootstrap = {
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
} as unknown as BootstrapStatic;

// resetAllMocks clears implementations AND once-queues between tests
beforeEach(() => vi.resetAllMocks());

describe("POST /api/gw-plan/submit", () => {
  it("returns 400 for missing fields", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 401 when session exists but has no fpl_manager_id", async () => {
    vi.mocked(getSession).mockReturnValue({
      ...mockSession,
      fpl_manager_id: null,
    } as unknown as ReturnType<typeof getSession>);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when not FPL authenticated", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(null);
    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when plan not found", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(null);
    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when plan has no transfers", async () => {
    const emptyTransfersPlan: GwPlan = {
      ...mockPlan,
      plan: {
        ...mockPlan.plan,
        transfers: [],
      },
    };
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(emptyTransfersPlan);
    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("returns validation details on confirm: false", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(mockBootstrap);
    mockAuthFetch(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      {
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
      },
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.transfers).toHaveLength(1);
    expect(body.transfers[0].elementIn).toBe(20);
    expect(body.transfers[0].elementOut).toBe(10);
    expect(body.transferCost).toBe(0);
    expect(body.wildcardActive).toBe(false);
  });

  it("returns submitted: true on confirm: true", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(mockBootstrap);
    mockAuthFetch(
      new Response(JSON.stringify({ transfers_made: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submitted).toBe(true);
    expect(body.transfersMade).toBe(1);
  });

  it("submits only selected transfers when transferIndices provided", async () => {
    const twoTransferPlan: GwPlan = {
      ...mockPlan,
      plan: {
        ...mockPlan.plan,
        transfers: [
          {
            playerOut: { id: 10, name: "PlayerA", predicted4GW: 10 },
            playerIn: { id: 20, name: "PlayerB", predicted4GW: 15 },
            pointsGain: 5,
            hitCost: 0,
            reasoning: "upgrade A",
          },
          {
            playerOut: { id: 30, name: "PlayerC", predicted4GW: 8 },
            playerIn: { id: 40, name: "PlayerD", predicted4GW: 14 },
            pointsGain: 4,
            hitCost: 0,
            reasoning: "upgrade C",
          },
        ],
      },
    };
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(twoTransferPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue({
      elements: [
        {
          id: 10,
          now_cost: 100,
          element_type: 2,
          web_name: "PlayerA",
          team: 1,
        },
        {
          id: 20,
          now_cost: 110,
          element_type: 2,
          web_name: "PlayerB",
          team: 2,
        },
        { id: 30, now_cost: 80, element_type: 3, web_name: "PlayerC", team: 3 },
        { id: 40, now_cost: 90, element_type: 3, web_name: "PlayerD", team: 4 },
      ],
    } as unknown as BootstrapStatic);
    mockAuthFetch(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    // Only submit the first transfer (index 0)
    const res = await POST(
      makeReq({
        sessionId: SESSION_ID,
        planId: PLAN_ID,
        confirm: false,
        transferIndices: [0],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transfers).toHaveLength(1);
    expect(body.transfers[0].elementIn).toBe(20);
    expect(body.transfers[0].elementOut).toBe(10);
  });

  it("surfaces per-transfer error message from FPL transfers error shape", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(mockBootstrap);
    mockAuthFetch(
      new Response(
        JSON.stringify({
          transfers: [
            {
              element_out: [
                {
                  message: "Element out is not a current pick",
                  code: "transfer_element_out_not_pick",
                },
              ],
            },
          ],
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("Element out is not a current pick");
  });

  it("surfaces non_field_errors message from FPL transfers shape B", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(mockBootstrap);
    mockAuthFetch(
      new Response(
        JSON.stringify({
          transfers: [
            {
              non_field_errors: [
                {
                  message: "Selling price for element_out has changed",
                  code: "transfer_element_out_price_mismatch",
                },
              ],
            },
          ],
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.error).toBe("Selling price for element_out has changed");
  });

  it("uses my-team endpoint for selling prices", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(mockBootstrap);
    // my-team returns selling_price: 95 (not now_cost 100)
    mockAuthFetch(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      [
        {
          element: 10,
          position: 1,
          multiplier: 1,
          is_captain: false,
          is_vice_captain: false,
          selling_price: 95,
        },
      ],
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(200);
    // selling_price in the FPL transfer payload must be 95 (from auth picks), not 100 (now_cost)
    const transfersCall = vi
      .mocked(authenticatedFetch)
      .mock.calls.find(
        ([url]) => url === "https://fantasy.premierleague.com/api/transfers/",
      );
    expect(transfersCall).toBeDefined();
    const callBody = JSON.parse(transfersCall![1]?.body as string) as {
      transfers: Array<{ selling_price: number }>;
    };
    expect(callBody.transfers[0].selling_price).toBe(95);
  });

  it("falls back to now_cost when my-team returns 404", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(mockBootstrap);
    vi.mocked(authenticatedFetch).mockImplementation(async (url) => {
      if (String(url).includes("/my-team/")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(200);
    // Falls back to now_cost (100) when my-team fails
    const transfersCall = vi
      .mocked(authenticatedFetch)
      .mock.calls.find(
        ([url]) => url === "https://fantasy.premierleague.com/api/transfers/",
      );
    const callBody = JSON.parse(transfersCall![1]?.body as string) as {
      transfers: Array<{ selling_price: number }>;
    };
    expect(callBody.transfers[0].selling_price).toBe(100); // now_cost fallback
  });

  it("returns alreadyApplied: true when FPL says both element_out and element_in errors indicate transfer already done", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(mockBootstrap);
    mockAuthFetch(
      new Response(
        JSON.stringify({
          transfers: [
            {
              element_out: [
                {
                  message: "Element out is not a current pick",
                  code: "transfer_element_out_not_pick",
                },
              ],
              element_in: [
                {
                  message: "Element in is already picked",
                  code: "transfer_element_in_is_pick",
                },
              ],
            },
          ],
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: true }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submitted).toBe(true);
    expect(body.alreadyApplied).toBe(true);
  });

  it("returns DEADLINE_PASSED when FPL says deadline has passed", async () => {
    vi.mocked(getSession).mockReturnValue(mockSession);
    vi.mocked(getFplSession).mockReturnValue(mockFplSession);
    vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
    vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(mockBootstrap);
    mockAuthFetch(
      new Response(
        JSON.stringify({ non_form_errors: ["Transfer deadline passed"] }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    const res = await POST(
      makeReq({ sessionId: SESSION_ID, planId: PLAN_ID, confirm: false }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("DEADLINE_PASSED");
  });
});
