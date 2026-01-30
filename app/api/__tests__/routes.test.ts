import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  getCurrentGameweek: vi.fn().mockReturnValue(20),
}));

// Import after mocking
import { fplClient, FPLApiError } from "@/lib/fpl/client";
import { GET as getBootstrapStatic } from "../fpl/bootstrap-static/route";
import { GET as getFixtures } from "../fpl/fixtures/route";

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

      const response = await getBootstrapStatic();
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

      const response = await getBootstrapStatic();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch bootstrap data");
    });

    it("returns correct status code for FPL API errors", async () => {
      mockedFplClient.getBootstrapStatic.mockRejectedValue(
        new FPLApiError("Service unavailable", 503),
      );

      const response = await getBootstrapStatic();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe("Service unavailable");
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
});
