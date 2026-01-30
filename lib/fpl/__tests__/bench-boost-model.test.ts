import { describe, it, expect } from "vitest";
import {
  analyzeBenchHistory,
  getBenchBoostRecommendations,
  getFDRColorClass,
  getFDRBgClass,
} from "../bench-boost-model";
import type { ManagerHistory, Fixture, Gameweek, Team } from "../types";
import type { EnrichedPlayer } from "../utils";

// Mock manager history
function createMockHistory(
  overrides: Partial<ManagerHistory> = {},
): ManagerHistory {
  return {
    current: [
      {
        event: 1,
        points: 50,
        points_on_bench: 8,
        overall_rank: 100000,
        bank: 0,
        value: 1000,
        event_transfers: 0,
        event_transfers_cost: 0,
      },
      {
        event: 2,
        points: 65,
        points_on_bench: 12,
        overall_rank: 90000,
        bank: 0,
        value: 1000,
        event_transfers: 1,
        event_transfers_cost: 0,
      },
      {
        event: 3,
        points: 55,
        points_on_bench: 5,
        overall_rank: 85000,
        bank: 0,
        value: 1000,
        event_transfers: 0,
        event_transfers_cost: 0,
      },
      {
        event: 4,
        points: 70,
        points_on_bench: 18,
        overall_rank: 70000,
        bank: 0,
        value: 1000,
        event_transfers: 0,
        event_transfers_cost: 0,
      },
      {
        event: 5,
        points: 45,
        points_on_bench: 3,
        overall_rank: 75000,
        bank: 0,
        value: 1000,
        event_transfers: 1,
        event_transfers_cost: 0,
      },
    ],
    past: [],
    chips: [],
    ...overrides,
  } as ManagerHistory;
}

// Mock fixtures
function createMockFixtures(): Fixture[] {
  return [
    {
      id: 1,
      event: 6,
      team_h: 1,
      team_a: 2,
      team_h_difficulty: 2,
      team_a_difficulty: 3,
    } as Fixture,
    {
      id: 2,
      event: 6,
      team_h: 3,
      team_a: 4,
      team_h_difficulty: 3,
      team_a_difficulty: 2,
    } as Fixture,
    {
      id: 3,
      event: 7,
      team_h: 1,
      team_a: 5,
      team_h_difficulty: 4,
      team_a_difficulty: 2,
    } as Fixture,
    {
      id: 4,
      event: 7,
      team_h: 2,
      team_a: 3,
      team_h_difficulty: 3,
      team_a_difficulty: 3,
    } as Fixture,
  ];
}

// Mock events
function createMockEvents(): Gameweek[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `Gameweek ${i + 1}`,
    deadline_time: new Date().toISOString(),
    finished: i < 5,
    is_current: i === 5,
    is_next: i === 6,
  })) as Gameweek[];
}

// Mock teams
function createMockTeams(): Team[] {
  return [
    { id: 1, name: "Team A", short_name: "TMA" },
    { id: 2, name: "Team B", short_name: "TMB" },
    { id: 3, name: "Team C", short_name: "TMC" },
    { id: 4, name: "Team D", short_name: "TMD" },
    { id: 5, name: "Team E", short_name: "TME" },
  ] as Team[];
}

// Mock bench players
function createMockBenchPlayers(): EnrichedPlayer[] {
  return [
    { id: 1, web_name: "Player1", team: 1, element_type: 2, form: "5.0" },
    { id: 2, web_name: "Player2", team: 2, element_type: 3, form: "4.5" },
    { id: 3, web_name: "Player3", team: 3, element_type: 3, form: "6.0" },
    { id: 4, web_name: "Player4", team: 4, element_type: 4, form: "3.5" },
  ] as EnrichedPlayer[];
}

describe("analyzeBenchHistory", () => {
  it("calculates total bench points correctly", () => {
    const history = createMockHistory();
    const result = analyzeBenchHistory(history);

    expect(result.totalBenchPoints).toBe(46); // 8 + 12 + 5 + 18 + 3
  });

  it("calculates average bench points correctly", () => {
    const history = createMockHistory();
    const result = analyzeBenchHistory(history);

    expect(result.avgBenchPoints).toBe(9.2); // 46 / 5
  });

  it("identifies best historical gameweek", () => {
    const history = createMockHistory();
    const result = analyzeBenchHistory(history);

    expect(result.bestHistoricalGW).not.toBeNull();
    expect(result.bestHistoricalGW?.gameweek).toBe(4);
    expect(result.bestHistoricalGW?.pointsOnBench).toBe(18);
  });

  it("correctly tracks bench boost usage", () => {
    const historyWithBB = createMockHistory({
      chips: [{ name: "bboost", event: 4, time: "" }],
    });
    const result = analyzeBenchHistory(historyWithBB);

    expect(result.benchBoostUsed).toBe(true);
    expect(result.benchBoostGW).toBe(4);
  });

  it("handles no bench boost used", () => {
    const history = createMockHistory();
    const result = analyzeBenchHistory(history);

    expect(result.benchBoostUsed).toBe(false);
    expect(result.benchBoostGW).toBeNull();
  });

  it("handles empty history", () => {
    const history = createMockHistory({ current: [], chips: [] });
    const result = analyzeBenchHistory(history);

    expect(result.totalBenchPoints).toBe(0);
    expect(result.avgBenchPoints).toBe(0);
    expect(result.bestHistoricalGW).toBeNull();
  });

  it("returns correct history array", () => {
    const history = createMockHistory();
    const result = analyzeBenchHistory(history);

    expect(result.history).toHaveLength(5);
    expect(result.history[0].gameweek).toBe(1);
    expect(result.history[0].pointsOnBench).toBe(8);
  });
});

describe("getBenchBoostRecommendations", () => {
  it("returns recommendations for upcoming gameweeks", () => {
    const fixtures = createMockFixtures();
    const events = createMockEvents();
    const teams = createMockTeams();
    const benchPlayers = createMockBenchPlayers();

    const result = getBenchBoostRecommendations(
      fixtures,
      events,
      teams,
      benchPlayers,
      6,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].gameweek).toBeGreaterThanOrEqual(6);
  });

  it("calculates FDR correctly", () => {
    const fixtures = createMockFixtures();
    const events = createMockEvents();
    const teams = createMockTeams();
    const benchPlayers = createMockBenchPlayers();

    const result = getBenchBoostRecommendations(
      fixtures,
      events,
      teams,
      benchPlayers,
      6,
    );

    // All recommendations should have FDR between 1-5
    result.forEach((rec) => {
      expect(rec.avgBenchFDR).toBeGreaterThanOrEqual(1);
      expect(rec.avgBenchFDR).toBeLessThanOrEqual(5);
    });
  });

  it("sorts recommendations by score", () => {
    const fixtures = createMockFixtures();
    const events = createMockEvents();
    const teams = createMockTeams();
    const benchPlayers = createMockBenchPlayers();

    const result = getBenchBoostRecommendations(
      fixtures,
      events,
      teams,
      benchPlayers,
      6,
    );

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("assigns confidence levels", () => {
    const fixtures = createMockFixtures();
    const events = createMockEvents();
    const teams = createMockTeams();
    const benchPlayers = createMockBenchPlayers();

    const result = getBenchBoostRecommendations(
      fixtures,
      events,
      teams,
      benchPlayers,
      6,
    );

    result.forEach((rec) => {
      expect(["high", "medium", "low"]).toContain(rec.confidence);
    });
  });

  it("handles empty bench players", () => {
    const fixtures = createMockFixtures();
    const events = createMockEvents();
    const teams = createMockTeams();

    const result = getBenchBoostRecommendations(fixtures, events, teams, [], 6);

    // Should still return recommendations but with default FDR
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getFDRColorClass", () => {
  it("returns green for low FDR", () => {
    expect(getFDRColorClass(1)).toBe("text-fpl-green");
    expect(getFDRColorClass(2)).toBe("text-fpl-green");
  });

  it("returns muted for medium FDR", () => {
    expect(getFDRColorClass(3)).toBe("text-fpl-muted");
  });

  it("returns orange for high FDR", () => {
    expect(getFDRColorClass(4)).toBe("text-orange-400");
  });

  it("returns danger for very high FDR", () => {
    expect(getFDRColorClass(5)).toBe("text-fpl-danger");
  });
});

describe("getFDRBgClass", () => {
  it("returns green background for low FDR", () => {
    expect(getFDRBgClass(1)).toBe("bg-fpl-green/20");
    expect(getFDRBgClass(2)).toBe("bg-fpl-green/20");
  });

  it("returns purple background for medium FDR", () => {
    expect(getFDRBgClass(3)).toBe("bg-fpl-purple-light");
  });

  it("returns orange background for high FDR", () => {
    expect(getFDRBgClass(4)).toBe("bg-orange-400/20");
  });

  it("returns danger background for very high FDR", () => {
    expect(getFDRBgClass(5)).toBe("bg-fpl-danger/20");
  });
});
