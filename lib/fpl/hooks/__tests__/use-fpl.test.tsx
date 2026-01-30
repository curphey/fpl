import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useBootstrapStatic,
  useFixtures,
  useGameweekFixtures,
  usePlayerSummary,
  useLiveGameweek,
  useManager,
  useManagerHistory,
  useManagerPicks,
  useLeagueStandings,
} from "../use-fpl";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("FPL Data Hooks", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("useBootstrapStatic", () => {
    const mockBootstrapData = {
      events: [{ id: 1, name: "Gameweek 1" }],
      teams: [{ id: 1, name: "Arsenal" }],
      elements: [{ id: 1, web_name: "Saka" }],
    };

    it("fetches bootstrap data successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBootstrapData,
      });

      const { result } = renderHook(() => useBootstrapStatic());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockBootstrapData);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith("/api/fpl/bootstrap-static");
    });

    it("handles fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useBootstrapStatic());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain("500");
    });

    it("handles network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failed"));

      const { result } = renderHook(() => useBootstrapStatic());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error?.message).toBe("Network failed");
    });

    it("provides refetch function", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBootstrapData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockBootstrapData, events: [{ id: 2 }] }),
        });

      const { result } = renderHook(() => useBootstrapStatic());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("useFixtures", () => {
    const mockFixtures = [
      { id: 1, event: 20, team_h: 1, team_a: 2 },
      { id: 2, event: 20, team_h: 3, team_a: 4 },
    ];

    it("fetches fixtures successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFixtures,
      });

      const { result } = renderHook(() => useFixtures());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockFixtures);
      expect(mockFetch).toHaveBeenCalledWith("/api/fpl/fixtures");
    });
  });

  describe("useGameweekFixtures", () => {
    const mockFixtures = [{ id: 1, event: 15 }];

    it("fetches fixtures for specific gameweek", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFixtures,
      });

      const { result } = renderHook(() => useGameweekFixtures(15));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockFixtures);
      expect(mockFetch).toHaveBeenCalledWith("/api/fpl/fixtures?event=15");
    });

    it("does not fetch for invalid gameweek (0)", async () => {
      const { result } = renderHook(() => useGameweekFixtures(0));

      // Should not start loading for invalid gameweek
      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not fetch for gameweek > 38", async () => {
      const { result } = renderHook(() => useGameweekFixtures(39));

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("usePlayerSummary", () => {
    const mockPlayerSummary = {
      fixtures: [],
      history: [{ round: 1, total_points: 10 }],
      history_past: [],
    };

    it("fetches player summary for valid ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlayerSummary,
      });

      const { result } = renderHook(() => usePlayerSummary(100));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockPlayerSummary);
      expect(mockFetch).toHaveBeenCalledWith("/api/fpl/element-summary/100");
    });

    it("does not fetch for null player ID", async () => {
      const { result } = renderHook(() => usePlayerSummary(null));

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not fetch for zero player ID", async () => {
      const { result } = renderHook(() => usePlayerSummary(0));

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("useLiveGameweek", () => {
    const mockLiveData = {
      elements: [{ id: 1, stats: { total_points: 10 } }],
    };

    it("fetches live data for valid gameweek", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLiveData,
      });

      const { result } = renderHook(() => useLiveGameweek(20));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockLiveData);
      expect(mockFetch).toHaveBeenCalledWith("/api/fpl/event/20/live");
    });
  });

  describe("useManager", () => {
    const mockManager = {
      id: 123456,
      player_first_name: "John",
      player_last_name: "Doe",
      name: "FC Test",
      summary_overall_points: 1500,
    };

    it("fetches manager data for valid ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockManager,
      });

      const { result } = renderHook(() => useManager(123456));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockManager);
      expect(mockFetch).toHaveBeenCalledWith("/api/fpl/entry/123456");
    });

    it("does not fetch for null manager ID", async () => {
      const { result } = renderHook(() => useManager(null));

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("useManagerHistory", () => {
    const mockHistory = {
      current: [{ event: 1, points: 50, overall_rank: 100000 }],
      past: [],
      chips: [],
    };

    it("fetches manager history for valid ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      });

      const { result } = renderHook(() => useManagerHistory(123456));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockHistory);
      expect(mockFetch).toHaveBeenCalledWith("/api/fpl/entry/123456/history");
    });
  });

  describe("useManagerPicks", () => {
    const mockPicks = {
      active_chip: null,
      automatic_subs: [],
      entry_history: { event: 20, points: 60 },
      picks: [{ element: 1, position: 1, is_captain: false, multiplier: 1 }],
    };

    it("fetches picks for valid manager and gameweek", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockPicks,
      });

      const { result } = renderHook(() => useManagerPicks(123456, 20));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockPicks);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/fpl/entry/123456/event/20/picks",
      );
    });

    it("does not fetch for null manager ID", async () => {
      const { result } = renderHook(() => useManagerPicks(null, 20));

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not fetch for invalid gameweek", async () => {
      const { result } = renderHook(() => useManagerPicks(123456, 0));

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("useLeagueStandings", () => {
    const mockStandings = {
      league: { id: 314, name: "Overall" },
      standings: {
        results: [{ id: 1, entry_name: "FC Test", total: 1500 }],
        has_next: false,
        page: 1,
      },
    };

    it("fetches standings for valid league ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStandings,
      });

      const { result } = renderHook(() => useLeagueStandings(314));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockStandings);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/fpl/leagues-classic/314/standings?page=1",
      );
    });

    it("fetches with custom page number", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStandings,
      });

      const { result } = renderHook(() => useLeagueStandings(314, 3));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/fpl/leagues-classic/314/standings?page=3",
      );
    });

    it("does not fetch for null league ID", async () => {
      const { result } = renderHook(() => useLeagueStandings(null));

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
