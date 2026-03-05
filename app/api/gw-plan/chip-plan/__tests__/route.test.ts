import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/db/sessions", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/db/gw-plan", () => ({
  saveGwPlan: vi.fn(),
}));
vi.mock("@/lib/db/settings", () => ({
  hasAnthropicApiKey: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/fpl/auth-client", () => ({ getFplSession: vi.fn() }));
vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getManagerHistory: vi.fn(),
    getManagerPicks: vi.fn(),
    getBootstrapStatic: vi.fn(),
    getFixtures: vi.fn(),
  },
}));
vi.mock("@/lib/claude/chip-plan-client", () => ({ generateChipPlan: vi.fn() }));
vi.mock("@/lib/fpl/points-model", () => ({
  predictPoints: vi.fn().mockReturnValue([]),
}));

import { POST } from "../route";
import { getSession } from "@/lib/db/sessions";
import { saveGwPlan } from "@/lib/db/gw-plan";
import { hasAnthropicApiKey } from "@/lib/db/settings";
import { getFplSession } from "@/lib/fpl/auth-client";
import { fplClient } from "@/lib/fpl/client";
import { generateChipPlan } from "@/lib/claude/chip-plan-client";
import type { ManagerHistory } from "@/lib/fpl/types";

const SESSION_ID = "a0000000-0000-4000-8000-000000000001";

const mockSession = {
  id: SESSION_ID,
  fpl_manager_id: 999,
  display_name: null,
  created_at: "",
  updated_at: "",
};

const mockHistory = {
  chips: [],
  current: [],
  past: [],
} as unknown as ManagerHistory;

const mockPicks = {
  active_chip: null,
  entry_history: { bank: 20, total_transfers: 1, event: 28 },
  picks: [
    {
      element: 1,
      position: 1,
      multiplier: 1,
      is_captain: false,
      is_vice_captain: false,
      selling_price: 55,
    },
    {
      element: 2,
      position: 12,
      multiplier: 0,
      is_captain: false,
      is_vice_captain: false,
      selling_price: 45,
    },
  ],
};

const mockBootstrap = {
  elements: [
    {
      id: 1,
      web_name: "Raya",
      element_type: 1,
      team: 1,
      now_cost: 55,
      form: "7.0",
    },
    {
      id: 2,
      web_name: "Flekken",
      element_type: 1,
      team: 8,
      now_cost: 45,
      form: "5.0",
    },
  ],
  teams: [
    { id: 1, short_name: "ARS" },
    { id: 8, short_name: "BRE" },
  ],
  events: [],
};

const mockChipResult = {
  thinking: "I thought hard",
  result: {
    predictedTeamPoints: 80,
    squad: {
      GK: [
        { id: 3, name: "Flekken2", cost: 4.5 },
        { id: 4, name: "GKB", cost: 4.0 },
      ],
      DEF: [
        { id: 5, name: "D1", cost: 5.0 },
        { id: 6, name: "D2", cost: 4.5 },
        { id: 7, name: "D3", cost: 4.5 },
        { id: 8, name: "D4", cost: 5.0 },
        { id: 9, name: "D5", cost: 5.0 },
      ],
      MID: [
        { id: 10, name: "M1", cost: 13.0 },
        { id: 11, name: "M2", cost: 11.5 },
        { id: 12, name: "M3", cost: 8.5 },
        { id: 13, name: "M4", cost: 10.5 },
        { id: 14, name: "M5", cost: 5.5 },
      ],
      FWD: [
        { id: 15, name: "F1", cost: 9.5 },
        { id: 16, name: "F2", cost: 9.0 },
        { id: 17, name: "F3", cost: 5.5 },
      ],
    },
    startingXI: [3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16],
    benchOrder: [9, 14, 17, 4],
    captain: { playerId: 10, name: "M1", reasoning: "Best pick" },
    notes: "Go get 'em",
  },
  processingTime: 5000,
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/gw-plan/chip-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupMocks() {
  vi.mocked(hasAnthropicApiKey).mockReturnValue(true);
  vi.mocked(getSession).mockReturnValue(mockSession);
  vi.mocked(getFplSession).mockReturnValue({
    csrfToken: "tok",
    plProfile: "pro",
  } as ReturnType<typeof getFplSession>);
  vi.mocked(fplClient.getManagerHistory).mockResolvedValue(mockHistory);
  vi.mocked(fplClient.getManagerPicks).mockResolvedValue(
    mockPicks as Awaited<ReturnType<typeof fplClient.getManagerPicks>>,
  );
  vi.mocked(fplClient.getBootstrapStatic).mockResolvedValue(
    mockBootstrap as Awaited<ReturnType<typeof fplClient.getBootstrapStatic>>,
  );
  vi.mocked(fplClient.getFixtures).mockResolvedValue([]);
  vi.mocked(generateChipPlan).mockResolvedValue(mockChipResult);
  vi.mocked(saveGwPlan).mockReturnValue({
    id: "plan-123",
    sessionId: SESSION_ID,
    gameweek: 28,
    plan: {} as ReturnType<typeof saveGwPlan>["plan"],
    thinking: "",
    generatedAt: new Date().toISOString(),
    chipType: "wildcard",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  setupMocks();
});

describe("POST /api/gw-plan/chip-plan", () => {
  it("returns 400 for missing chipType", async () => {
    const req = makeRequest({ sessionId: SESSION_ID, gameweek: 28 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid chipType", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "triple_captain",
    });
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
      gameweek: 28,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when FPL session is not active", async () => {
    vi.mocked(getFplSession).mockReturnValue(null);
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 503 when Anthropic API key is not configured", async () => {
    const { hasAnthropicApiKey } = await import("@/lib/db/settings");
    vi.mocked(hasAnthropicApiKey).mockReturnValue(false);
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });

  it("returns 409 when wildcard already used in current half", async () => {
    vi.mocked(fplClient.getManagerHistory).mockResolvedValue({
      ...mockHistory,
      chips: [{ name: "wildcard", time: "2025-10-01T10:00:00Z", event: 10 }],
    } as unknown as ManagerHistory);
    // gameweek 28 = second half (≥ 20), chip used at event 10 = first half — NOT a conflict
    // Use gameweek 15 (first half) with chip used at event 10 (also first half) — IS a conflict
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 15,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("allows wildcard in second half when only used in first half", async () => {
    vi.mocked(fplClient.getManagerHistory).mockResolvedValue({
      ...mockHistory,
      chips: [{ name: "wildcard", time: "2025-10-01T10:00:00Z", event: 10 }],
    } as unknown as ManagerHistory);
    // gameweek 28 = second half, chip used at event 10 = first half — allowed
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 409 when freehit already used", async () => {
    vi.mocked(fplClient.getManagerHistory).mockResolvedValue({
      ...mockHistory,
      chips: [{ name: "freehit", time: "2025-11-01T10:00:00Z", event: 12 }],
    } as unknown as ManagerHistory);
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "freehit",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 200 with plan on wildcard happy path", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { chipType?: string };
    expect(json.chipType).toBe("wildcard");
  });

  it("calls generateChipPlan with correct chipType and budget", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "freehit",
    });
    await POST(req);
    expect(vi.mocked(generateChipPlan)).toHaveBeenCalledWith(
      expect.objectContaining({ chipType: "freehit" }),
    );
    // Budget = sum of selling prices + bank = (55 + 45) + 20 = 120
    expect(vi.mocked(generateChipPlan)).toHaveBeenCalledWith(
      expect.objectContaining({ budget: 120 }),
    );
  });

  it("calls saveGwPlan with chipType", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    await POST(req);
    expect(vi.mocked(saveGwPlan)).toHaveBeenCalledWith(
      SESSION_ID,
      28,
      expect.any(Object),
      expect.any(String),
      "wildcard",
    );
  });

  it("calls predictPoints for 4 separate gameweeks when chipType is wildcard", async () => {
    const { predictPoints } = await import("@/lib/fpl/points-model");
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    await POST(req);
    // Should call predictPoints for GW28, 29, 30, 31 (not just once)
    const calls = vi.mocked(predictPoints).mock.calls;
    const calledGws = calls.map((c) => c[2]); // third arg is gwId
    expect(calledGws).toContain(28);
    expect(calledGws).toContain(29);
    expect(calledGws).toContain(30);
    expect(calledGws).toContain(31);
  });

  it("calls predictPoints once for freehit (single GW)", async () => {
    const { predictPoints } = await import("@/lib/fpl/points-model");
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "freehit",
    });
    await POST(req);
    // Free hit only needs the immediate GW prediction
    const calls = vi.mocked(predictPoints).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][2]).toBe(28);
  });

  it("saves lineupPlan from Claude result for wildcard", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "wildcard",
    });
    await POST(req);
    const savedPlan = vi.mocked(saveGwPlan).mock.calls[0][2];
    // IDs must match exactly; names are enriched from playerMap (unknown players get "Player N")
    expect(savedPlan.lineupPlan?.startingXI.map((p) => p.id)).toEqual(
      mockChipResult.result.startingXI,
    );
    expect(savedPlan.lineupPlan?.benchOrder.map((p) => p.id)).toEqual(
      mockChipResult.result.benchOrder,
    );
  });

  it("saves lineupPlan from Claude result for freehit", async () => {
    const req = makeRequest({
      sessionId: SESSION_ID,
      gameweek: 28,
      chipType: "freehit",
    });
    await POST(req);
    const savedPlan = vi.mocked(saveGwPlan).mock.calls[0][2];
    expect(savedPlan.lineupPlan?.startingXI.map((p) => p.id)).toEqual(
      mockChipResult.result.startingXI,
    );
    expect(savedPlan.lineupPlan?.benchOrder.map((p) => p.id)).toEqual(
      mockChipResult.result.benchOrder,
    );
  });
});
