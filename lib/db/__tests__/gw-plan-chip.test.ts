import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRun, mockGet, mockPrepare } = vi.hoisted(() => {
  const mockRun = vi.fn();
  const mockGet = vi.fn();
  const mockAll = vi.fn();
  const mockPrepare = vi
    .fn()
    .mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  return { mockRun, mockGet, mockAll, mockPrepare };
});

vi.mock("@/lib/db/client", () => ({
  db: { prepare: mockPrepare },
}));

import { saveGwPlan, getGwPlan } from "@/lib/db/gw-plan";
import type { GwPlanResult } from "@/lib/db/gw-plan";

const PLAN: GwPlanResult = {
  predictedTeamPoints: 60,
  captain: { playerId: 1, name: "Salah", reasoning: "Top pick" },
  transfers: [],
  substitutions: [],
  notes: "",
};

describe("saveGwPlan — chipType", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves and retrieves chip_type on a gw_plan", () => {
    const sessionId = "00000000-0000-4000-8000-000000000001";
    const saved = saveGwPlan(sessionId, 99, PLAN, "", "wildcard");
    expect(saved.chipType).toBe("wildcard");
    expect(mockRun).toHaveBeenCalledWith(
      expect.any(String), // id (UUID)
      sessionId,
      99,
      JSON.stringify(PLAN),
      "", // thinking
      "wildcard", // chipType
    );

    mockGet.mockReturnValue({
      id: "some-id",
      session_id: sessionId,
      gameweek: 99,
      plan_json: JSON.stringify(PLAN),
      thinking: "",
      generated_at: "2026-03-03",
      chip_type: "wildcard",
    });

    const fetched = getGwPlan(sessionId, 99);
    expect(fetched?.chipType).toBe("wildcard");
  });

  it("chipType defaults to undefined when not set", () => {
    const sessionId = "00000000-0000-4000-8000-000000000002";
    const saved = saveGwPlan(sessionId, 98, PLAN, "");
    expect(saved.chipType).toBeUndefined();
    expect(mockRun).toHaveBeenCalledWith(
      expect.any(String),
      sessionId,
      98,
      JSON.stringify(PLAN),
      "",
      null, // chipType undefined → null for SQL
    );
  });
});
