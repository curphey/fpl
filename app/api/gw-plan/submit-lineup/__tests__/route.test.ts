import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db/sessions", () => ({
  getSession: vi.fn(),
}));
vi.mock("@/lib/db/gw-plan", () => ({
  getGwPlanById: vi.fn(),
}));
vi.mock("@/lib/fpl/auth-client", () => ({
  getFplSession: vi.fn(),
  authenticatedFetch: vi.fn(),
}));

import { POST } from "../route";
import { getSession } from "@/lib/db/sessions";
import { getGwPlanById } from "@/lib/db/gw-plan";
import { getFplSession, authenticatedFetch } from "@/lib/fpl/auth-client";

const SESSION_ID = "a0000000-0000-4000-8000-000000000001";
const PLAN_ID = "b0000000-0000-4000-8000-000000000002";

const mockSession = {
  id: SESSION_ID,
  fpl_manager_id: 999,
  display_name: null,
  created_at: "",
  updated_at: "",
};

const mockPlan = {
  id: PLAN_ID,
  sessionId: SESSION_ID,
  gameweek: 28,
  thinking: "",
  generatedAt: new Date().toISOString(),
  plan: {
    predictedTeamPoints: 55,
    captain: { playerId: 1, name: "Salah", reasoning: "" },
    transfers: [],
    substitutions: [
      {
        playerOut: { id: 10, name: "Garner" },
        playerIn: { id: 20, name: "Dalot" },
        reasoning: "Dalot predicted higher",
      },
    ],
    notes: "",
  },
};

const mockMyTeamPicks = [
  { element: 10, position: 8, is_captain: false, is_vice_captain: false },
  { element: 20, position: 12, is_captain: false, is_vice_captain: false },
  { element: 30, position: 1, is_captain: true, is_vice_captain: false },
];

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/gw-plan/submit-lineup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupMocks() {
  vi.mocked(getSession).mockReturnValue(mockSession);
  vi.mocked(getGwPlanById).mockReturnValue(mockPlan);
  vi.mocked(getFplSession).mockReturnValue({
    csrfToken: "tok",
    plProfile: "pro",
  } as ReturnType<typeof getFplSession>);
}

beforeEach(() => {
  vi.resetAllMocks();
  setupMocks();
  vi.mocked(authenticatedFetch)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ picks: mockMyTeamPicks }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
});

describe("POST /api/gw-plan/submit-lineup", () => {
  it("returns 400 for missing sessionId", async () => {
    const req = makeRequest({ planId: PLAN_ID, confirm: true });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing planId", async () => {
    const req = makeRequest({ sessionId: SESSION_ID, confirm: true });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when session has no FPL manager", async () => {
    vi.mocked(getSession).mockReturnValue({
      ...mockSession,
      fpl_manager_id: null,
    } as ReturnType<typeof getSession>);
    const req = makeRequest({
      sessionId: SESSION_ID,
      planId: PLAN_ID,
      confirm: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when FPL session is not active", async () => {
    vi.mocked(getFplSession).mockReturnValue(null);
    const req = makeRequest({
      sessionId: SESSION_ID,
      planId: PLAN_ID,
      confirm: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 404 when plan is not found", async () => {
    vi.mocked(getGwPlanById).mockReturnValue(null);
    const req = makeRequest({
      sessionId: SESSION_ID,
      planId: PLAN_ID,
      confirm: true,
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("swaps positions and POSTs to FPL when confirm=true", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      planId: PLAN_ID,
      confirm: true,
      substitutionIndices: [0],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { submitted: boolean };
    expect(json.submitted).toBe(true);

    // Verify positions were swapped correctly
    const postCall = vi.mocked(authenticatedFetch).mock.calls[1];
    const body = JSON.parse(postCall[1]!.body as string) as {
      picks: Array<{ element: number; position: number }>;
    };
    const garnerPick = body.picks.find((p) => p.element === 10);
    const dalotPick = body.picks.find((p) => p.element === 20);
    expect(garnerPick?.position).toBe(12); // Garner was pos 8, now pos 12 (bench)
    expect(dalotPick?.position).toBe(8); // Dalot was pos 12, now pos 8 (starter)
  });

  it("dry-runs when confirm=false — only fetches my-team, does not POST", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      planId: PLAN_ID,
      confirm: false,
      substitutionIndices: [0],
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { valid: boolean };
    expect(json.valid).toBe(true);
    // Only one call (GET my-team), no POST
    expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when no substitutions are selected", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      planId: PLAN_ID,
      confirm: true,
      substitutionIndices: [],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when FPL GET my-team returns 401", async () => {
    vi.mocked(authenticatedFetch)
      .mockReset()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);
    const req = makeRequest({
      sessionId: SESSION_ID,
      planId: PLAN_ID,
      confirm: true,
      substitutionIndices: [0],
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
