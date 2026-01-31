import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the rate limit to always allow requests
vi.mock("@/lib/api/rate-limit", () => ({
  withRateLimit: vi.fn().mockResolvedValue(null),
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: Date.now() + 60000,
  }),
}));

// Mock the FPL client
vi.mock("@/lib/fpl/client", () => ({
  fplClient: {
    getBootstrapStatic: vi.fn(),
    getFixtures: vi.fn(),
    getFixturesByGameweek: vi.fn(),
    getManager: vi.fn(),
    getManagerHistory: vi.fn(),
    getManagerPicks: vi.fn(),
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
  getCurrentGameweek: vi.fn().mockReturnValue(20),
}));

// Import after mocking
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import { GET as getBootstrapStatic } from "../fpl/bootstrap-static/route";
import { GET as getFixtures } from "../fpl/fixtures/route";
import { GET as getEntry } from "../fpl/entry/[id]/route";
import { GET as getEntryPicks } from "../fpl/entry/[id]/event/[gw]/picks/route";
import { GET as getEntryHistory } from "../fpl/entry/[id]/history/route";
import { GET as getElementSummary } from "../fpl/element-summary/[id]/route";
import { GET as getLiveGameweek } from "../fpl/event/[gw]/live/route";

// Type assertion for mocked functions
const mockedFplClient = fplClient as {
  getBootstrapStatic: ReturnType<typeof vi.fn>;
  getFixtures: ReturnType<typeof vi.fn>;
  getFixturesByGameweek: ReturnType<typeof vi.fn>;
  getManager: ReturnType<typeof vi.fn>;
  getManagerHistory: ReturnType<typeof vi.fn>;
  getManagerPicks: ReturnType<typeof vi.fn>;
  getPlayerSummary: ReturnType<typeof vi.fn>;
  getLiveGameweek: ReturnType<typeof vi.fn>;
  getLeagueStandings: ReturnType<typeof vi.fn>;
};

describe("API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("/api/fpl/bootstrap-static", () => {
    const mockBootstrapData = {
      events: [
        { id: 1, name: "Gameweek 1", is_current: false, finished: true },
        { id: 20, name: "Gameweek 20", is_current: true, finished: false },
      ],
      teams: [
        { id: 1, name: "Arsenal", short_name: "ARS" },
        { id: 2, name: "Aston Villa", short_name: "AVL" },
      ],
      elements: [
        {
          id: 1,
          web_name: "Saka",
          team: 1,
          element_type: 3,
          now_cost: 100,
          total_points: 150,
        },
      ],
      element_types: [
        { id: 1, singular_name: "Goalkeeper" },
        { id: 2, singular_name: "Defender" },
        { id: 3, singular_name: "Midfielder" },
        { id: 4, singular_name: "Forward" },
      ],
    };

    it("returns bootstrap data successfully", async () => {
      mockedFplClient.getBootstrapStatic.mockResolvedValue(mockBootstrapData);

      const request = new NextRequest(
        "http://localhost/api/fpl/bootstrap-static",
      );
      const response = await getBootstrapStatic(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(2);
      expect(data.teams).toHaveLength(2);
      expect(data.elements).toHaveLength(1);
    });

    it("returns 500 on API error", async () => {
      mockedFplClient.getBootstrapStatic.mockRejectedValue(
        new Error("Network error"),
      );

      const request = new NextRequest(
        "http://localhost/api/fpl/bootstrap-static",
      );
      const response = await getBootstrapStatic(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch bootstrap data");
    });

    it("returns correct status code for FPL API errors", async () => {
      mockedFplClient.getBootstrapStatic.mockRejectedValue(
        new FPLApiError("Service unavailable", 503),
      );

      const request = new NextRequest(
        "http://localhost/api/fpl/bootstrap-static",
      );
      const response = await getBootstrapStatic(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe("Service unavailable");
    });

    it("returns enriched data when enrich=true", async () => {
      const mockDataForEnrich = {
        events: [{ id: 1, name: "Gameweek 1", is_current: true }],
        teams: [{ id: 1, name: "Arsenal", short_name: "ARS" }],
        elements: [
          {
            id: 1,
            web_name: "Saka",
            team: 1,
            element_type: 3,
            now_cost: 100,
            total_points: 150,
            form: "7.5",
            points_per_game: "6.2",
            selected_by_percent: "35.5",
            expected_goals: "5.2",
            expected_assists: "3.1",
            expected_goal_involvements: "8.3",
            ict_index: "120.5",
          },
        ],
        element_types: [
          { id: 3, singular_name: "Midfielder", singular_name_short: "MID" },
        ],
      };
      mockedFplClient.getBootstrapStatic.mockResolvedValue(mockDataForEnrich);

      const request = new NextRequest(
        "http://localhost/api/fpl/bootstrap-static?enrich=true",
      );
      const response = await getBootstrapStatic(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enriched).toBe(true);
      expect(data.elements[0].team_name).toBe("Arsenal");
      expect(data.elements[0].team_short_name).toBe("ARS");
      expect(data.elements[0].position_name).toBe("Midfielder");
      expect(data.elements[0].form_value).toBeDefined();
    });

    it("returns non-enriched data by default", async () => {
      mockedFplClient.getBootstrapStatic.mockResolvedValue(mockBootstrapData);

      const request = new NextRequest(
        "http://localhost/api/fpl/bootstrap-static",
      );
      const response = await getBootstrapStatic(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.enriched).toBeUndefined();
      // Should not have enriched properties
      expect(data.elements[0].team_name).toBeUndefined();
    });
  });

  describe("/api/fpl/fixtures", () => {
    const mockFixtures = [
      {
        id: 1,
        event: 20,
        team_h: 1,
        team_a: 2,
        team_h_score: 2,
        team_a_score: 1,
        finished: true,
      },
      {
        id: 2,
        event: 20,
        team_h: 3,
        team_a: 4,
        team_h_score: null,
        team_a_score: null,
        finished: false,
      },
    ];

    it("returns all fixtures when no event parameter", async () => {
      mockedFplClient.getFixtures.mockResolvedValue(mockFixtures);

      const request = new NextRequest("http://localhost/api/fpl/fixtures");
      const response = await getFixtures(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockedFplClient.getFixtures).toHaveBeenCalled();
      expect(mockedFplClient.getFixturesByGameweek).not.toHaveBeenCalled();
    });

    it("returns fixtures for specific gameweek", async () => {
      mockedFplClient.getFixturesByGameweek.mockResolvedValue([
        mockFixtures[0],
      ]);

      const request = new NextRequest(
        "http://localhost/api/fpl/fixtures?event=20",
      );
      const response = await getFixtures(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(mockedFplClient.getFixturesByGameweek).toHaveBeenCalledWith(20);
    });

    it("returns 500 on error", async () => {
      mockedFplClient.getFixtures.mockRejectedValue(
        new Error("Database error"),
      );

      const request = new NextRequest("http://localhost/api/fpl/fixtures");
      const response = await getFixtures(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch fixtures");
    });
  });

  describe("/api/fpl/entry/[id]", () => {
    const mockManager = {
      id: 12345,
      player_first_name: "John",
      player_last_name: "Doe",
      name: "FC Test",
      summary_overall_points: 1500,
      summary_overall_rank: 50000,
      current_event: 20,
    };

    it("returns manager data for valid ID", async () => {
      mockedFplClient.getManager.mockResolvedValue(mockManager);

      const request = new NextRequest("http://localhost/api/fpl/entry/12345");
      const response = await getEntry(request, {
        params: Promise.resolve({ id: "12345" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("FC Test");
      expect(data.summary_overall_points).toBe(1500);
    });

    it("returns 400 for invalid manager ID", async () => {
      const request = new NextRequest("http://localhost/api/fpl/entry/abc");
      const response = await getEntry(request, {
        params: Promise.resolve({ id: "abc" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("returns 404 for non-existent manager", async () => {
      mockedFplClient.getManager.mockRejectedValue(
        new FPLApiError("Manager not found", 404),
      );

      const request = new NextRequest("http://localhost/api/fpl/entry/9999999");
      const response = await getEntry(request, {
        params: Promise.resolve({ id: "9999999" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  describe("/api/fpl/entry/[id]/history", () => {
    const mockHistory = {
      current: [
        { event: 1, points: 50, total_points: 50, rank: 100000 },
        { event: 2, points: 60, total_points: 110, rank: 80000 },
      ],
      past: [],
      chips: [{ name: "wildcard", event: 10 }],
    };

    it("returns manager history for valid ID", async () => {
      mockedFplClient.getManagerHistory.mockResolvedValue(mockHistory);

      const request = new NextRequest(
        "http://localhost/api/fpl/entry/12345/history",
      );
      const response = await getEntryHistory(request, {
        params: Promise.resolve({ id: "12345" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.current).toHaveLength(2);
      expect(data.chips).toHaveLength(1);
    });

    it("returns 400 for invalid manager ID", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/entry/invalid/history",
      );
      const response = await getEntryHistory(request, {
        params: Promise.resolve({ id: "invalid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("/api/fpl/entry/[id]/event/[gw]/picks", () => {
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

    it("returns picks for valid manager and gameweek", async () => {
      mockedFplClient.getManagerPicks.mockResolvedValue(mockPicks);

      const request = new NextRequest(
        "http://localhost/api/fpl/entry/12345/event/20/picks",
      );
      const response = await getEntryPicks(request, {
        params: Promise.resolve({ id: "12345", gw: "20" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.picks).toHaveLength(2);
      expect(data.picks[1].is_captain).toBe(true);
    });

    it("returns 400 for invalid gameweek", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/entry/12345/event/0/picks",
      );
      const response = await getEntryPicks(request, {
        params: Promise.resolve({ id: "12345", gw: "0" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("returns 400 for gameweek > 38", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/entry/12345/event/39/picks",
      );
      const response = await getEntryPicks(request, {
        params: Promise.resolve({ id: "12345", gw: "39" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe("/api/fpl/element-summary/[id]", () => {
    const mockSummary = {
      fixtures: [
        { id: 100, event: 21, team_h: 1, team_a: 2 },
        { id: 101, event: 22, team_h: 3, team_a: 1 },
      ],
      history: [
        { round: 1, total_points: 5 },
        { round: 2, total_points: 8 },
      ],
      history_past: [],
    };

    it("returns player summary for valid ID", async () => {
      mockedFplClient.getPlayerSummary.mockResolvedValue(mockSummary);

      const request = new NextRequest(
        "http://localhost/api/fpl/element-summary/1",
      );
      const response = await getElementSummary(request, {
        params: Promise.resolve({ id: "1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.fixtures).toHaveLength(2);
      expect(data.history).toHaveLength(2);
    });

    it("returns 400 for invalid player ID (non-numeric)", async () => {
      const request = new NextRequest(
        "http://localhost/api/fpl/element-summary/abc",
      );
      const response = await getElementSummary(request, {
        params: Promise.resolve({ id: "abc" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("returns 404 for non-existent player", async () => {
      mockedFplClient.getPlayerSummary.mockRejectedValue(
        new FPLApiError("Player not found", 404),
      );

      const request = new NextRequest(
        "http://localhost/api/fpl/element-summary/500",
      );
      const response = await getElementSummary(request, {
        params: Promise.resolve({ id: "500" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Player not found");
    });
  });

  describe("/api/fpl/event/[gw]/live", () => {
    const mockLiveData = {
      elements: [
        {
          id: 1,
          stats: {
            minutes: 90,
            goals_scored: 1,
            assists: 0,
            total_points: 9,
          },
        },
        {
          id: 2,
          stats: {
            minutes: 45,
            goals_scored: 0,
            assists: 1,
            total_points: 4,
          },
        },
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
      expect(data.elements).toHaveLength(2);
      expect(data.elements[0].stats.goals_scored).toBe(1);
    });

    it("returns 400 for invalid gameweek", async () => {
      const request = new NextRequest("http://localhost/api/fpl/event/0/live");
      const response = await getLiveGameweek(request, {
        params: Promise.resolve({ gw: "0" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("returns 400 for gameweek > 38", async () => {
      const request = new NextRequest("http://localhost/api/fpl/event/40/live");
      const response = await getLiveGameweek(request, {
        params: Promise.resolve({ gw: "40" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("handles FPL API errors", async () => {
      mockedFplClient.getLiveGameweek.mockRejectedValue(
        new FPLApiError("Gameweek not started", 404),
      );

      const request = new NextRequest("http://localhost/api/fpl/event/38/live");
      const response = await getLiveGameweek(request, {
        params: Promise.resolve({ gw: "38" }),
      });

      expect(response.status).toBe(404);
    });
  });
});
