import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the FPL client
vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getManager: vi.fn(),
    getPlayerSummary: vi.fn(),
    getLiveGameweek: vi.fn(),
    getLeagueStandings: vi.fn(),
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
import { GET as getManager } from "../fpl/entry/[id]/route";
import { GET as getPlayerSummary } from "../fpl/element-summary/[id]/route";
import { GET as getLiveGameweek } from "../fpl/event/[gw]/live/route";
import { GET as getLeagueStandings } from "../fpl/leagues-classic/[id]/standings/route";

const mockedFplClient = fplClient as {
  getManager: ReturnType<typeof vi.fn>;
  getPlayerSummary: ReturnType<typeof vi.fn>;
  getLiveGameweek: ReturnType<typeof vi.fn>;
  getLeagueStandings: ReturnType<typeof vi.fn>;
};

describe("API Route Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("/api/fpl/entry/[id]", () => {
    const mockManager = {
      id: 123456,
      player_first_name: "John",
      player_last_name: "Doe",
      name: "FC Test",
      summary_overall_points: 1500,
      summary_overall_rank: 50000,
    };

    it("returns manager data for valid ID", async () => {
      mockedFplClient.getManager.mockResolvedValue(mockManager);

      const request = new NextRequest("http://localhost/api/fpl/entry/123456");
      const response = await getManager(request, {
        params: Promise.resolve({ id: "123456" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(123456);
      expect(mockedFplClient.getManager).toHaveBeenCalledWith(123456);
    });

    it("returns 400 for invalid manager ID", async () => {
      const request = new NextRequest("http://localhost/api/fpl/entry/abc");
      const response = await getManager(request, {
        params: Promise.resolve({ id: "abc" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for negative manager ID", async () => {
      const request = new NextRequest("http://localhost/api/fpl/entry/-1");
      const response = await getManager(request, {
        params: Promise.resolve({ id: "-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for manager ID exceeding max", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/entry/999999999999",
      );
      const response = await getManager(request, {
        params: Promise.resolve({ id: "999999999999" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns FPL API error status for not found", async () => {
      mockedFplClient.getManager.mockRejectedValue(
        new FPLApiError("Manager not found", 404),
      );

      const request = new NextRequest("http://localhost/api/fpl/entry/123456");
      const response = await getManager(request, {
        params: Promise.resolve({ id: "123456" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  describe("/api/fpl/element-summary/[id]", () => {
    const mockPlayerSummary = {
      fixtures: [],
      history: [],
      history_past: [],
    };

    it("returns player summary for valid ID", async () => {
      mockedFplClient.getPlayerSummary.mockResolvedValue(mockPlayerSummary);

      const request = new NextRequest(
        "http://localhost/api/fpl/element-summary/100",
      );
      const response = await getPlayerSummary(request, {
        params: Promise.resolve({ id: "100" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockedFplClient.getPlayerSummary).toHaveBeenCalledWith(100);
    });

    it("returns 400 for invalid player ID", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/element-summary/notanumber",
      );
      const response = await getPlayerSummary(request, {
        params: Promise.resolve({ id: "notanumber" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for player ID exceeding max", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/element-summary/5000",
      );
      const response = await getPlayerSummary(request, {
        params: Promise.resolve({ id: "5000" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("/api/fpl/event/[gw]/live", () => {
    const mockLiveData = {
      elements: [
        { id: 1, stats: { total_points: 10 } },
        { id: 2, stats: { total_points: 6 } },
      ],
    };

    it("returns live data for valid gameweek", async () => {
      mockedFplClient.getLiveGameweek.mockResolvedValue(mockLiveData);

      const request = new NextRequest("http://localhost/api/fpl/event/20/live");
      const response = await getLiveGameweek(request, {
        params: Promise.resolve({ gw: "20" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockedFplClient.getLiveGameweek).toHaveBeenCalledWith(20);
    });

    it("returns 400 for gameweek below 1", async () => {
      const request = new NextRequest("http://localhost/api/fpl/event/0/live");
      const response = await getLiveGameweek(request, {
        params: Promise.resolve({ gw: "0" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("Gameweek must be at least 1");
    });

    it("returns 400 for gameweek above 38", async () => {
      const request = new NextRequest("http://localhost/api/fpl/event/39/live");
      const response = await getLiveGameweek(request, {
        params: Promise.resolve({ gw: "39" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("Gameweek must be at most 38");
    });

    it("returns 400 for non-numeric gameweek", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/event/abc/live",
      );
      const response = await getLiveGameweek(request, {
        params: Promise.resolve({ gw: "abc" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("/api/fpl/leagues-classic/[id]/standings", () => {
    const mockStandings = {
      league: { id: 123, name: "Test League" },
      standings: {
        results: [{ id: 1, entry_name: "FC Team", total: 1500, rank: 1 }],
        has_next: false,
        page: 1,
      },
    };

    it("returns standings for valid league ID", async () => {
      mockedFplClient.getLeagueStandings.mockResolvedValue(mockStandings);

      const request = new NextRequest(
        "http://localhost/api/fpl/leagues-classic/123/standings",
      );
      const response = await getLeagueStandings(request, {
        params: Promise.resolve({ id: "123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockedFplClient.getLeagueStandings).toHaveBeenCalledWith(123, 1);
    });

    it("passes page parameter correctly", async () => {
      mockedFplClient.getLeagueStandings.mockResolvedValue(mockStandings);

      const request = new NextRequest(
        "http://localhost/api/fpl/leagues-classic/123/standings?page=2",
      );
      const response = await getLeagueStandings(request, {
        params: Promise.resolve({ id: "123" }),
      });

      expect(response.status).toBe(200);
      expect(mockedFplClient.getLeagueStandings).toHaveBeenCalledWith(123, 2);
    });

    it("returns 400 for invalid league ID", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/leagues-classic/invalid/standings",
      );
      const response = await getLeagueStandings(request, {
        params: Promise.resolve({ id: "invalid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for negative league ID", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/leagues-classic/-5/standings",
      );
      const response = await getLeagueStandings(request, {
        params: Promise.resolve({ id: "-5" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("defaults to page 1 for invalid page parameter", async () => {
      mockedFplClient.getLeagueStandings.mockResolvedValue(mockStandings);

      const request = new NextRequest(
        "http://localhost/api/fpl/leagues-classic/123/standings?page=abc",
      );
      const response = await getLeagueStandings(request, {
        params: Promise.resolve({ id: "123" }),
      });

      expect(response.status).toBe(200);
      expect(mockedFplClient.getLeagueStandings).toHaveBeenCalledWith(123, 1);
    });
  });
});
