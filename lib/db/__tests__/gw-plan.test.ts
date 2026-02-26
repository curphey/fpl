import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRun, mockGet, mockAll, mockPrepare } = vi.hoisted(() => {
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

import {
  getGwPlan,
  saveGwPlan,
  getTransferPredictions,
  insertTransferPrediction,
  updateTransferActuals,
  getActiveTransferPredictions,
  getGwPlanById,
} from "../gw-plan";

describe("getGwPlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no plan exists", () => {
    mockGet.mockReturnValue(undefined);
    expect(getGwPlan("sess1", 28)).toBeNull();
  });

  it("parses plan_json and returns GwPlan", () => {
    const plan = {
      predictedTeamPoints: 62,
      captain: { playerId: 1, name: "Salah", reasoning: "great fixtures" },
      transfers: [],
      notes: "",
    };
    mockGet.mockReturnValue({
      id: "abc",
      session_id: "sess1",
      gameweek: 28,
      plan_json: JSON.stringify(plan),
      thinking: "my thoughts",
      generated_at: "2026-02-25",
    });
    const result = getGwPlan("sess1", 28);
    expect(result).not.toBeNull();
    expect(result!.plan.predictedTeamPoints).toBe(62);
    expect(result!.thinking).toBe("my thoughts");
  });
});

describe("saveGwPlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls INSERT OR REPLACE with serialized plan", () => {
    const plan = {
      predictedTeamPoints: 55,
      captain: { playerId: 2, name: "Haaland", reasoning: "goals" },
      transfers: [],
      notes: "",
    };
    saveGwPlan("sess1", 27, plan, "thinking text");
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO gw_plans"),
    );
    expect(mockRun).toHaveBeenCalledWith(
      expect.any(String),
      "sess1",
      27,
      JSON.stringify(plan),
      "thinking text",
    );
  });

  it("returns the saved GwPlan with the provided data", () => {
    const plan = {
      predictedTeamPoints: 55,
      captain: { playerId: 2, name: "Haaland", reasoning: "goals" },
      transfers: [],
      notes: "",
    };
    const result = saveGwPlan("sess1", 27, plan, "");
    expect(result.sessionId).toBe("sess1");
    expect(result.gameweek).toBe(27);
    expect(result.plan).toEqual(plan);
  });
});

describe("getTransferPredictions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no predictions", () => {
    mockAll.mockReturnValue([]);
    expect(getTransferPredictions("sess1")).toEqual([]);
  });

  it("maps rows to TransferPrediction objects", () => {
    mockAll.mockReturnValue([
      {
        id: "p1",
        session_id: "sess1",
        gameweek_made: 25,
        player_out_id: 100,
        player_out_name: "Saka",
        player_in_id: 200,
        player_in_name: "Salah",
        predicted_gain_pts: 8.2,
        actual_gain_pts: null,
        gw_actuals: "{}",
        status: "pending",
        reasoning: "great fixtures",
        tracking_notes: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ]);
    const result = getTransferPredictions("sess1");
    expect(result).toHaveLength(1);
    expect(result[0].playerOutName).toBe("Saka");
    expect(result[0].playerInName).toBe("Salah");
    expect(result[0].predictedGainPts).toBe(8.2);
    expect(result[0].gwActuals).toEqual({});
    expect(result[0].status).toBe("pending");
  });
});

describe("insertTransferPrediction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts a new prediction row", () => {
    insertTransferPrediction(
      "sess1",
      28,
      100,
      "Saka",
      200,
      "Salah",
      8.2,
      "good fixtures",
    );
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transfer_predictions"),
    );
    expect(mockRun).toHaveBeenCalled();
  });

  it("returns the inserted prediction with status pending", () => {
    const result = insertTransferPrediction(
      "sess1",
      28,
      100,
      "Saka",
      200,
      "Salah",
      8.2,
      "good fixtures",
    );
    expect(result.status).toBe("pending");
    expect(result.actualGainPts).toBeNull();
    expect(result.gwActuals).toEqual({});
  });
});

describe("updateTransferActuals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates gw_actuals, actual_gain_pts, status, tracking_notes", () => {
    updateTransferActuals("pred1", { "28": 12, "29": 3 }, 15, "on_track", null);
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE transfer_predictions"),
    );
    expect(mockRun).toHaveBeenCalledWith(
      JSON.stringify({ "28": 12, "29": 3 }),
      15,
      "on_track",
      null,
      "pred1",
    );
  });
});

describe("getActiveTransferPredictions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries only pending and on_track predictions", () => {
    mockAll.mockReturnValue([]);
    getActiveTransferPredictions();
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("IN ('pending', 'on_track')"),
    );
  });

  it("maps rows to TransferPrediction objects", () => {
    mockAll.mockReturnValue([
      {
        id: "p2",
        session_id: "sess2",
        gameweek_made: 26,
        player_out_id: 101,
        player_out_name: "Trent",
        player_in_id: 201,
        player_in_name: "Alexander-Arnold",
        predicted_gain_pts: 3.0,
        actual_gain_pts: 2.5,
        gw_actuals: '{"26":2,"27":0}',
        status: "on_track",
        reasoning: "decent fixtures",
        tracking_notes: null,
        created_at: "2026-01-10",
        updated_at: "2026-01-17",
      },
    ]);
    const result = getActiveTransferPredictions();
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("on_track");
    expect(result[0].gwActuals).toEqual({ "26": 2, "27": 0 });
  });
});

describe("getGwPlanById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for unknown id", () => {
    mockGet.mockReturnValue(undefined);
    expect(getGwPlanById("no-such-id", "any-session")).toBeNull();
  });

  it("returns plan by id when session matches", () => {
    const plan = {
      predictedTeamPoints: 62,
      captain: { playerId: 1, name: "Salah", reasoning: "great fixtures" },
      transfers: [],
      notes: "",
    };
    mockGet.mockReturnValue({
      id: "plan-1",
      session_id: "sess1",
      gameweek: 28,
      plan_json: JSON.stringify(plan),
      thinking: "thoughts",
      generated_at: "2026-02-26",
    });
    const found = getGwPlanById("plan-1", "sess1");
    expect(found).not.toBeNull();
    expect(found?.id).toBe("plan-1");
    expect(found?.sessionId).toBe("sess1");
  });

  it("returns null when session does not match (row not returned by DB)", () => {
    mockGet.mockReturnValue(undefined);
    expect(getGwPlanById("plan-1", "wrong-session")).toBeNull();
  });
});
