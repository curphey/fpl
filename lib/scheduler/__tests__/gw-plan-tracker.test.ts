import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/gw-plan", () => ({
  getActiveTransferPredictions: vi.fn(),
  updateTransferActuals: vi.fn(),
}));

vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getElementSummary: vi.fn(),
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Player was suspended." }],
        }),
      },
    };
  }),
}));

vi.mock("@/lib/db/settings", () => ({
  getAnthropicApiKey: vi.fn().mockReturnValue("test-api-key"),
}));

import {
  calculateTrackingStatus,
  trackGwPlanPredictions,
} from "../gw-plan-tracker";
import {
  getActiveTransferPredictions,
  updateTransferActuals,
} from "@/lib/db/gw-plan";
import { fplClient } from "@/lib/fpl/client";

const mockGetActive = vi.mocked(getActiveTransferPredictions);
const mockUpdateActuals = vi.mocked(updateTransferActuals);
const mockGetElementSummary = vi.mocked(fplClient.getElementSummary);

describe("calculateTrackingStatus", () => {
  it("returns pending when fewer than 2 GWs have been played since transfer", () => {
    const result = calculateTrackingStatus(
      { predictedGainPts: 10, gwActuals: { "26": 5 }, gameweekMade: 25 },
      28,
    );
    expect(result.status).toBe("pending");
  });

  it("returns on_track when 2+ GWs played and actual is within 20% of predicted", () => {
    const result = calculateTrackingStatus(
      {
        predictedGainPts: 10,
        gwActuals: { "26": 5, "27": 4 },
        gameweekMade: 25,
      },
      28,
    );
    expect(result.status).toBe("on_track");
  });

  it("returns miss when 2+ GWs played and actual is more than 20% below predicted", () => {
    const result = calculateTrackingStatus(
      {
        predictedGainPts: 10,
        gwActuals: { "26": 1, "27": 1 },
        gameweekMade: 25,
      },
      28,
    );
    expect(result.status).toBe("miss");
  });

  it("returns hit when 4 GWs complete and actual >= 80% of predicted", () => {
    const result = calculateTrackingStatus(
      {
        predictedGainPts: 10,
        gwActuals: { "26": 3, "27": 3, "28": 2, "29": 2 },
        gameweekMade: 25,
      },
      30,
    );
    expect(result.status).toBe("hit");
  });

  it("returns miss when 4 GWs complete and actual < 80% of predicted", () => {
    const result = calculateTrackingStatus(
      {
        predictedGainPts: 10,
        gwActuals: { "26": 1, "27": 0, "28": 1, "29": 0 },
        gameweekMade: 25,
      },
      30,
    );
    expect(result.status).toBe("miss");
  });
});

describe("trackGwPlanPredictions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when there are no active predictions", async () => {
    mockGetActive.mockReturnValue([]);
    await trackGwPlanPredictions(28);
    expect(mockUpdateActuals).not.toHaveBeenCalled();
  });

  it("fetches both playerIn and playerOut summaries and computes net gain", async () => {
    mockGetActive.mockReturnValue([
      {
        id: "pred1",
        sessionId: "sess1",
        gameweekMade: 25,
        playerInId: 200,
        playerInName: "Salah",
        playerOutId: 100,
        playerOutName: "Saka",
        predictedGainPts: 10,
        actualGainPts: null,
        gwActuals: {},
        status: "pending",
        reasoning: "",
        trackingNotes: null,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);

    // playerIn (Salah): 8 in GW26, 6 in GW27
    // playerOut (Saka): 3 in GW26, 4 in GW27
    // Net: GW26 = 8-3 = 5, GW27 = 6-4 = 2, total = 7
    mockGetElementSummary.mockImplementation((id: number) => {
      if (id === 200) {
        return Promise.resolve({
          history: [
            { round: 26, total_points: 8 },
            { round: 27, total_points: 6 },
          ],
        }) as never;
      }
      return Promise.resolve({
        history: [
          { round: 26, total_points: 3 },
          { round: 27, total_points: 4 },
        ],
      }) as never;
    });

    await trackGwPlanPredictions(28);

    expect(mockGetElementSummary).toHaveBeenCalledWith(200);
    expect(mockGetElementSummary).toHaveBeenCalledWith(100);
    expect(mockUpdateActuals).toHaveBeenCalledWith(
      "pred1",
      { "26": 5, "27": 2 },
      7,
      "on_track",
      null,
    );
  });

  it("calls updateTransferActuals with miss status when underperforming", async () => {
    mockGetActive.mockReturnValue([
      {
        id: "pred2",
        sessionId: "sess1",
        gameweekMade: 25,
        playerInId: 300,
        playerInName: "Flop",
        playerOutId: 100,
        playerOutName: "Saka",
        predictedGainPts: 10,
        actualGainPts: null,
        gwActuals: {},
        status: "pending",
        reasoning: "",
        trackingNotes: null,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);

    // playerIn (Flop): 1 in GW26, 0 in GW27
    // playerOut (Saka): 5 in GW26, 6 in GW27
    // Net: GW26 = 1-5 = -4, GW27 = 0-6 = -6, total = -10
    mockGetElementSummary.mockImplementation((id: number) => {
      if (id === 300) {
        return Promise.resolve({
          history: [
            { round: 26, total_points: 1 },
            { round: 27, total_points: 0 },
          ],
        }) as never;
      }
      return Promise.resolve({
        history: [
          { round: 26, total_points: 5 },
          { round: 27, total_points: 6 },
        ],
      }) as never;
    });

    await trackGwPlanPredictions(28);

    expect(mockUpdateActuals).toHaveBeenCalledWith(
      "pred2",
      { "26": -4, "27": -6 },
      -10,
      "miss",
      expect.any(String),
    );
  });
});
