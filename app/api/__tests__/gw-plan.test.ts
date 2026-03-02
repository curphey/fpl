import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db/gw-plan", () => ({
  getGwPlan: vi.fn(),
  saveGwPlan: vi.fn(),
  insertTransferPrediction: vi.fn(),
}));

vi.mock("@/lib/claude/gw-plan-client", () => ({
  generateGwPlan: vi.fn(),
}));

vi.mock("@/lib/db/sessions", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getBootstrapStatic: vi.fn(),
    getFixtures: vi.fn(),
    getManagerPicks: vi.fn(),
    getManagerHistory: vi.fn(),
  },
}));

vi.mock("@/lib/fpl/utils", () => ({
  enrichPlayers: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/fpl/transfer-model", () => ({
  scoreTransferTargets: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/fpl/captain-model", () => ({
  scoreCaptainOptions: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/fpl/points-model", () => ({
  predictPoints: vi.fn().mockReturnValue([]),
}));

vi.mock("@/lib/db/settings", () => ({
  hasAnthropicApiKey: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/fpl/auth-client", () => ({
  getFplSession: vi.fn().mockReturnValue(null),
  authenticatedFetch: vi.fn(),
}));

import { GET, POST } from "../gw-plan/route";
import {
  getGwPlan,
  saveGwPlan,
  insertTransferPrediction,
} from "@/lib/db/gw-plan";
import { generateGwPlan } from "@/lib/claude/gw-plan-client";
import { getSession } from "@/lib/db/sessions";
import { fplClient } from "@/lib/fpl/client";
import { scoreTransferTargets } from "@/lib/fpl/transfer-model";
import { enrichPlayers } from "@/lib/fpl/utils";
import { getFplSession } from "@/lib/fpl/auth-client";

const mockGetGwPlan = vi.mocked(getGwPlan);
const mockSaveGwPlan = vi.mocked(saveGwPlan);
const mockInsertTransfer = vi.mocked(insertTransferPrediction);
const mockGenerateGwPlan = vi.mocked(generateGwPlan);
const mockGetSession = vi.mocked(getSession);
const mockBootstrap = vi.mocked(fplClient.getBootstrapStatic);
const mockFixtures = vi.mocked(fplClient.getFixtures);
const mockPicks = vi.mocked(fplClient.getManagerPicks);
const mockScoreTransferTargets = vi.mocked(scoreTransferTargets);
const mockEnrichPlayers = vi.mocked(enrichPlayers);
const mockGetManagerHistory = vi.mocked(fplClient.getManagerHistory);

describe("GET /api/gw-plan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when sessionId is missing", async () => {
    const req = new NextRequest("http://localhost/api/gw-plan?gw=28");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when no plan exists", async () => {
    mockGetGwPlan.mockReturnValue(null);
    const req = new NextRequest(
      "http://localhost/api/gw-plan?sessionId=sess1&gw=28",
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns cached plan when it exists", async () => {
    const plan = {
      id: "abc",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 62,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [],
        notes: "",
      },
      thinking: "",
      generatedAt: "2026-02-25",
    };
    mockGetGwPlan.mockReturnValue(plan);
    const req = new NextRequest(
      "http://localhost/api/gw-plan?sessionId=sess1&gw=28",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.predictedTeamPoints).toBe(62);
  });
});

describe("POST /api/gw-plan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when sessionId is missing", async () => {
    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when session has no manager connected", async () => {
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: null,
      display_name: null,
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("generates and returns a plan when manager is connected", async () => {
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: 12345,
      display_name: "Test FC",
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    mockBootstrap.mockResolvedValue({
      elements: [],
      teams: [],
      events: [
        {
          id: 28,
          is_current: true,
          is_next: false,
          finished: false,
          deadline_time: "",
        },
      ],
    } as never);
    mockFixtures.mockResolvedValue([]);
    mockPicks.mockResolvedValue({
      picks: [],
      entry_history: { bank: 10, event_transfers_cost: 0 },
    } as never);
    mockGenerateGwPlan.mockResolvedValue({
      thinking: "my thoughts",
      plan: {
        predictedTeamPoints: 58,
        captain: { playerId: 1, name: "Salah", reasoning: "great" },
        transfers: [],
        notes: "",
      },
      processingTime: 5000,
    });
    mockSaveGwPlan.mockReturnValue({
      id: "plan1",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 58,
        captain: { playerId: 1, name: "Salah", reasoning: "great" },
        transfers: [],
        notes: "",
      },
      thinking: "my thoughts",
      generatedAt: "2026-02-25",
    });

    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.predictedTeamPoints).toBe(58);
  });

  it("inserts transfer predictions for each transfer in the plan", async () => {
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: 12345,
      display_name: "Test FC",
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    mockBootstrap.mockResolvedValue({
      elements: [],
      teams: [],
      events: [],
    } as never);
    mockFixtures.mockResolvedValue([]);
    mockPicks.mockResolvedValue({
      picks: [],
      entry_history: { bank: 5, event_transfers_cost: 0 },
    } as never);
    mockGenerateGwPlan.mockResolvedValue({
      thinking: "",
      plan: {
        predictedTeamPoints: 60,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [
          {
            playerOut: { id: 100, name: "Saka", predicted4GW: 18 },
            playerIn: { id: 200, name: "Palmer", predicted4GW: 26 },
            pointsGain: 8,
            reasoning: "good form",
          },
        ],
        notes: "",
      },
      processingTime: 3000,
    });
    mockSaveGwPlan.mockReturnValue({
      id: "p1",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 60,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [
          {
            playerOut: { id: 100, name: "Saka", predicted4GW: 18 },
            playerIn: { id: 200, name: "Palmer", predicted4GW: 26 },
            pointsGain: 8,
            reasoning: "good form",
          },
        ],
        notes: "",
      },
      thinking: "",
      generatedAt: "2026-02-25",
    });

    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(req);
    expect(mockInsertTransfer).toHaveBeenCalledWith(
      "sess1",
      28,
      100,
      "Saka",
      200,
      "Palmer",
      8,
      "good form",
    );
  });

  it("filters targets using bank + sum of top 2 selling prices, including double-transfer targets", async () => {
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: 12345,
      display_name: "Test FC",
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    mockBootstrap.mockResolvedValue({
      elements: [],
      teams: [],
      events: [],
    } as never);
    mockFixtures.mockResolvedValue([]);
    // 2 squad players: £10.0m + £8.0m; bank £0.5m
    // top-2 sum = 180; maxAffordable = 5 + 180 = 185 (£18.5m)
    mockPicks.mockResolvedValue({
      picks: [
        {
          element: 1,
          position: 1,
          multiplier: 1,
          is_captain: false,
          is_vice_captain: false,
          selling_price: 100, // £10.0m
          purchase_price: 100,
        },
        {
          element: 2,
          position: 2,
          multiplier: 1,
          is_captain: false,
          is_vice_captain: false,
          selling_price: 80, // £8.0m
          purchase_price: 80,
        },
      ],
      entry_history: { bank: 5, event_transfers_cost: 0 }, // £0.5m
    } as never);
    mockEnrichPlayers.mockReturnValue([]);
    mockScoreTransferTargets.mockReturnValue([
      // single-transfer affordable (≤ £10.5m)
      {
        player: {
          id: 10,
          now_cost: 105,
          element_type: 3,
          web_name: "CheapTarget",
          team: 1,
          form: "5.0",
        } as never,
        score: 9.0,
        formScore: 9.0,
        fixtureScore: 9.0,
        valueScore: 9.0,
        xgiScore: 9.0,
        upcomingDifficulty: 2,
      },
      // double-transfer affordable (≤ £18.5m) but not single-transfer affordable
      {
        player: {
          id: 15,
          now_cost: 175,
          element_type: 3,
          web_name: "ExpensiveTarget",
          team: 2,
          form: "8.0",
        } as never,
        score: 8.5,
        formScore: 8.5,
        fixtureScore: 8.5,
        valueScore: 8.5,
        xgiScore: 8.5,
        upcomingDifficulty: 2,
      },
      // completely unaffordable (> £18.5m)
      {
        player: {
          id: 20,
          now_cost: 200,
          element_type: 4,
          web_name: "TooExpensive",
          team: 3,
          form: "4.0",
        } as never,
        score: 8.0,
        formScore: 8.0,
        fixtureScore: 8.0,
        valueScore: 8.0,
        xgiScore: 8.0,
        upcomingDifficulty: 3,
      },
    ]);
    mockGenerateGwPlan.mockResolvedValue({
      thinking: "",
      plan: {
        predictedTeamPoints: 50,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [],
        notes: "",
      },
      processingTime: 1000,
    });
    mockSaveGwPlan.mockReturnValue({
      id: "p1",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 50,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [],
        notes: "",
      },
      thinking: "",
      generatedAt: "2026-02-25",
    });

    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(req);

    const callArg = mockGenerateGwPlan.mock.calls[0][0];
    const targetIds = callArg.topTargets.map((t: { id: number }) => t.id);
    expect(targetIds).toContain(10); // single-transfer target included
    expect(targetIds).toContain(15); // double-transfer target now included
    expect(targetIds).not.toContain(20); // completely unaffordable excluded
  });

  it("includes targets from each position even when top-scoring position dominates", async () => {
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: 12345,
      display_name: "Test FC",
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    mockBootstrap.mockResolvedValue({
      elements: [],
      teams: [],
      events: [],
    } as never);
    mockFixtures.mockResolvedValue([]);
    mockPicks.mockResolvedValue({
      picks: [],
      entry_history: { bank: 200, event_transfers_cost: 0 }, // £20m bank — all targets affordable
    } as never);

    // 22 MID targets (highest scores) + 2 FWD targets (low scores).
    // A raw slice(0, 20) would fill all 20 slots with MIDs, leaving FWDs out.
    const midTargets = Array.from({ length: 22 }, (_, i) => ({
      player: {
        id: 100 + i,
        now_cost: 80,
        element_type: 3, // MID
        web_name: `Mid${i}`,
        team: 1,
        form: "8.0",
      } as never,
      score: 9.0 - i * 0.1,
      formScore: 5,
      fixtureScore: 5,
      valueScore: 5,
      xgiScore: 5,
      upcomingDifficulty: 2,
    }));
    const fwdTargets = [
      {
        player: {
          id: 200,
          now_cost: 80,
          element_type: 4, // FWD
          web_name: "FwdA",
          team: 2,
          form: "4.0",
        } as never,
        score: 3.0,
        formScore: 3,
        fixtureScore: 3,
        valueScore: 3,
        xgiScore: 3,
        upcomingDifficulty: 3,
      },
      {
        player: {
          id: 201,
          now_cost: 80,
          element_type: 4, // FWD
          web_name: "FwdB",
          team: 3,
          form: "3.5",
        } as never,
        score: 2.5,
        formScore: 2.5,
        fixtureScore: 2.5,
        valueScore: 2.5,
        xgiScore: 2.5,
        upcomingDifficulty: 3,
      },
    ];
    mockScoreTransferTargets.mockReturnValue([...midTargets, ...fwdTargets]);
    mockGenerateGwPlan.mockResolvedValue({
      thinking: "",
      plan: {
        predictedTeamPoints: 50,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [],
        notes: "",
      },
      processingTime: 1000,
    });
    mockSaveGwPlan.mockReturnValue({
      id: "p1",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 50,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [],
        notes: "",
      },
      thinking: "",
      generatedAt: "2026-02-25",
    });

    const req = new NextRequest("http://localhost/api/gw-plan", {
      method: "POST",
      body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
      headers: { "Content-Type": "application/json" },
    });
    await POST(req);

    const callArg = mockGenerateGwPlan.mock.calls[0][0];
    const targetIds = callArg.topTargets.map((t: { id: number }) => t.id);
    // FWD targets must be present despite low scores
    expect(targetIds).toContain(200);
    expect(targetIds).toContain(201);
    // MID targets should also be present (position diversity, not FWD-only)
    expect(targetIds).toContain(100);
  });
});

describe("POST /api/gw-plan — free transfer count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Common setup for all free transfer tests
    mockGetSession.mockReturnValue({
      id: "sess1",
      fpl_manager_id: 12345,
      display_name: "Test FC",
      created_at: "2026-01-01",
      last_seen_at: "2026-01-01",
    });
    mockBootstrap.mockResolvedValue({
      elements: [],
      teams: [],
      events: [
        {
          id: 28,
          is_current: true,
          is_next: false,
          finished: false,
          deadline_time: "",
        },
      ],
    } as never);
    mockFixtures.mockResolvedValue([]);
    mockPicks.mockResolvedValue({
      picks: [],
      entry_history: { bank: 10, event_transfers_cost: 0 },
    } as never);
    mockGenerateGwPlan.mockResolvedValue({
      thinking: "",
      plan: {
        predictedTeamPoints: 58,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [],
        notes: "",
      },
      processingTime: 1000,
    });
    mockSaveGwPlan.mockReturnValue({
      id: "plan1",
      sessionId: "sess1",
      gameweek: 28,
      plan: {
        predictedTeamPoints: 58,
        captain: { playerId: 1, name: "Salah", reasoning: "" },
        transfers: [],
        notes: "",
      },
      thinking: "",
      generatedAt: "2026-02-25",
    });
  });

  it("passes freeTransfers: 2 when last GW had 0 transfers (banked)", async () => {
    vi.mocked(getFplSession).mockReturnValueOnce({
      cookie: "pl_profile=X",
      managerName: "Tim",
      expiresAt: "2026-12-01T00:00:00Z",
    });
    mockGetManagerHistory.mockResolvedValueOnce({
      current: [
        {
          event: 27,
          event_transfers: 0,
          event_transfers_cost: 0,
          points: 55,
          total_points: 1200,
          rank: 5000,
          bank: 10,
          value: 1020,
          overall_rank: 50000,
          percentile_rank: 10,
        },
      ],
      past: [],
      chips: [],
    } as never);

    const res = await POST(
      new NextRequest("http://localhost/api/gw-plan", {
        method: "POST",
        body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(generateGwPlan)).toHaveBeenCalledWith(
      expect.objectContaining({ freeTransfers: 2 }),
    );
  });

  it("passes freeTransfers: 1 when last GW had transfers", async () => {
    vi.mocked(getFplSession).mockReturnValueOnce({
      cookie: "pl_profile=X",
      managerName: "Tim",
      expiresAt: "2026-12-01T00:00:00Z",
    });
    mockGetManagerHistory.mockResolvedValueOnce({
      current: [
        {
          event: 27,
          event_transfers: 1,
          event_transfers_cost: 0,
          points: 55,
          total_points: 1200,
          rank: 5000,
          bank: 10,
          value: 1020,
          overall_rank: 50000,
          percentile_rank: 10,
        },
      ],
      past: [],
      chips: [],
    } as never);

    const res = await POST(
      new NextRequest("http://localhost/api/gw-plan", {
        method: "POST",
        body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(generateGwPlan)).toHaveBeenCalledWith(
      expect.objectContaining({ freeTransfers: 1 }),
    );
  });

  it("defaults to freeTransfers: 1 when getManagerHistory throws", async () => {
    vi.mocked(getFplSession).mockReturnValueOnce({
      cookie: "pl_profile=X",
      managerName: "Tim",
      expiresAt: "2026-12-01T00:00:00Z",
    });
    mockGetManagerHistory.mockRejectedValueOnce(new Error("API error"));

    const res = await POST(
      new NextRequest("http://localhost/api/gw-plan", {
        method: "POST",
        body: JSON.stringify({ sessionId: "sess1", gameweek: 28 }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(generateGwPlan)).toHaveBeenCalledWith(
      expect.objectContaining({ freeTransfers: 1 }),
    );
  });
});
