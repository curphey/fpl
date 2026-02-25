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

  it("filters transfer targets to only those affordable given bank + max selling price", async () => {
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
    // squad player worth £10.0m, bank is £0.5m → max spend = £10.5m
    mockPicks.mockResolvedValue({
      picks: [
        {
          element: 1,
          position: 1,
          multiplier: 1,
          is_captain: false,
          is_vice_captain: false,
          selling_price: 100, // £10.0m
        },
      ],
      entry_history: { bank: 5, event_transfers_cost: 0 }, // £0.5m
    } as never);
    // affordable target: now_cost 105 (£10.5m); expensive: now_cost 200 (£20.0m)
    mockEnrichPlayers.mockReturnValue([
      {
        id: 10,
        now_cost: 105,
        element_type: 3,
        web_name: "Target1",
        team: 1,
        form: "5.0",
      } as never,
      {
        id: 20,
        now_cost: 200,
        element_type: 4,
        web_name: "Target2",
        team: 2,
        form: "4.0",
      } as never,
    ]);
    mockScoreTransferTargets.mockReturnValue([
      {
        player: {
          id: 10,
          now_cost: 105,
          element_type: 3,
          web_name: "Target1",
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
      {
        player: {
          id: 20,
          now_cost: 200,
          element_type: 4,
          web_name: "Target2",
          team: 2,
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
    const targetIds = callArg.topTargets.map((t) => t.id);
    expect(targetIds).toContain(10); // affordable target included
    expect(targetIds).not.toContain(20); // expensive target excluded
  });
});
