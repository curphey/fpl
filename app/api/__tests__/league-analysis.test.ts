import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock rate limiting
vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit: vi.fn().mockResolvedValue(null),
}));

// Mock FPL client
vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getManagerPicks: vi.fn(),
    getManagerHistory: vi.fn(),
  },
  FPLApiError: class FPLApiError extends Error {
    statusCode: number;
    endpoint: string;
    constructor(message: string, statusCode: number, endpoint: string = "") {
      super(message);
      this.name = "FPLApiError";
      this.statusCode = statusCode;
      this.endpoint = endpoint;
    }
  },
}));

import { fplClient, FPLApiError } from "@/lib/fpl/client";
import { POST } from "../league-analysis/route";

const mockedFplClient = fplClient as {
  getManagerPicks: ReturnType<typeof vi.fn>;
  getManagerHistory: ReturnType<typeof vi.fn>;
};

describe("/api/league-analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: unknown) =>
    new NextRequest("http://localhost/api/league-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const mockPicks = {
    active_chip: null,
    automatic_subs: [],
    entry_history: { event: 20, points: 65 },
    picks: [
      {
        element: 1,
        position: 1,
        multiplier: 1,
        is_captain: false,
        is_vice_captain: false,
      },
      {
        element: 2,
        position: 2,
        multiplier: 2,
        is_captain: true,
        is_vice_captain: false,
      },
    ],
  };

  const mockHistory = {
    current: [{ event: 1, points: 50 }],
    past: [],
    chips: [{ name: "wildcard", event: 10, time: "2024-01-15" }],
  };

  describe("validation", () => {
    it("returns 400 for missing managerIds", async () => {
      const request = createRequest({ gameweek: 20 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for empty managerIds array", async () => {
      const request = createRequest({ managerIds: [], gameweek: 20 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("At least one manager");
    });

    it("returns 400 for too many managerIds", async () => {
      const managerIds = Array.from({ length: 51 }, (_, i) => i + 1);
      const request = createRequest({ managerIds, gameweek: 20 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("Maximum 50");
    });

    it("returns 400 for invalid gameweek", async () => {
      const request = createRequest({ managerIds: [123], gameweek: 0 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for gameweek above 38", async () => {
      const request = createRequest({ managerIds: [123], gameweek: 39 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for invalid manager ID", async () => {
      const request = createRequest({ managerIds: ["abc"], gameweek: 20 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("successful requests", () => {
    it("fetches picks for single manager", async () => {
      mockedFplClient.getManagerPicks.mockResolvedValue(mockPicks);

      const request = createRequest({ managerIds: [123456], gameweek: 20 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.gameweek).toBe(20);
      expect(data.rivalPicks).toHaveLength(1);
      expect(data.rivalPicks[0].managerId).toBe(123456);
      expect(data.rivalPicks[0].picks).toEqual(mockPicks);
      expect(data.stats.successfulPicks).toBe(1);
      expect(data.stats.failedPicks).toBe(0);
    });

    it("fetches picks for multiple managers in parallel", async () => {
      mockedFplClient.getManagerPicks.mockResolvedValue(mockPicks);

      const request = createRequest({
        managerIds: [111, 222, 333],
        gameweek: 20,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rivalPicks).toHaveLength(3);
      expect(mockedFplClient.getManagerPicks).toHaveBeenCalledTimes(3);
      expect(data.stats.successfulPicks).toBe(3);
    });

    it("includes chips when requested", async () => {
      mockedFplClient.getManagerPicks.mockResolvedValue(mockPicks);
      mockedFplClient.getManagerHistory.mockResolvedValue(mockHistory);

      const request = createRequest({
        managerIds: [123456],
        gameweek: 20,
        includeChips: true,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rivalChips).toBeDefined();
      expect(data.rivalChips).toHaveLength(1);
      expect(data.rivalChips[0].chips).toEqual(mockHistory.chips);
      expect(data.stats.successfulChips).toBe(1);
    });

    it("does not fetch chips when not requested", async () => {
      mockedFplClient.getManagerPicks.mockResolvedValue(mockPicks);

      const request = createRequest({
        managerIds: [123456],
        gameweek: 20,
        includeChips: false,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rivalChips).toBeUndefined();
      expect(mockedFplClient.getManagerHistory).not.toHaveBeenCalled();
    });

    it("returns fetchedAt timestamp", async () => {
      mockedFplClient.getManagerPicks.mockResolvedValue(mockPicks);

      const request = createRequest({ managerIds: [123456], gameweek: 20 });
      const response = await POST(request);
      const data = await response.json();

      expect(data.fetchedAt).toBeDefined();
      expect(new Date(data.fetchedAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });
  });

  describe("error handling", () => {
    it("handles partial failures gracefully", async () => {
      mockedFplClient.getManagerPicks
        .mockResolvedValueOnce(mockPicks)
        .mockRejectedValueOnce(new FPLApiError("Manager not found", 404))
        .mockResolvedValueOnce(mockPicks);

      const request = createRequest({
        managerIds: [111, 222, 333],
        gameweek: 20,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rivalPicks).toHaveLength(3);
      expect(data.rivalPicks[0].picks).toEqual(mockPicks);
      expect(data.rivalPicks[1].picks).toBeNull();
      expect(data.rivalPicks[1].error).toContain("not found");
      expect(data.rivalPicks[2].picks).toEqual(mockPicks);
      expect(data.stats.successfulPicks).toBe(2);
      expect(data.stats.failedPicks).toBe(1);
    });

    it("handles chip fetch failures independently", async () => {
      mockedFplClient.getManagerPicks.mockResolvedValue(mockPicks);
      mockedFplClient.getManagerHistory.mockRejectedValue(
        new FPLApiError("History not available", 404),
      );

      const request = createRequest({
        managerIds: [123456],
        gameweek: 20,
        includeChips: true,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rivalPicks[0].picks).toEqual(mockPicks);
      expect(data.rivalChips[0].chips).toEqual([]);
      expect(data.rivalChips[0].error).toContain("not available");
      expect(data.stats.failedChips).toBe(1);
    });

    it("handles generic errors", async () => {
      mockedFplClient.getManagerPicks.mockRejectedValue(
        new Error("Network error"),
      );

      const request = createRequest({ managerIds: [123456], gameweek: 20 });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.rivalPicks[0].picks).toBeNull();
      expect(data.rivalPicks[0].error).toBe("Failed to fetch picks");
    });
  });

  describe("caching", () => {
    it("returns Cache-Control header", async () => {
      mockedFplClient.getManagerPicks.mockResolvedValue(mockPicks);

      const request = createRequest({ managerIds: [123456], gameweek: 20 });
      const response = await POST(request);

      expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    });
  });
});
