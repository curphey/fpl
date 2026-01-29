import { describe, it, expect } from "vitest";
import type { Team, Fixture, Gameweek } from "../types";
import {
  buildFixtureGrid,
  sortByEasiestFixtures,
  getFDRColorClass,
  findSpecialGameweeks,
} from "../fixture-planner";

// Mock factories
function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 1,
    name: "Test Team",
    short_name: "TST",
    code: 1,
    draw: 0,
    form: null,
    loss: 0,
    played: 0,
    points: 0,
    position: 1,
    strength: 3,
    team_division: null,
    unavailable: false,
    win: 0,
    strength_overall_home: 1000,
    strength_overall_away: 1000,
    strength_attack_home: 1000,
    strength_attack_away: 1000,
    strength_defence_home: 1000,
    strength_defence_away: 1000,
    pulse_id: 1,
    ...overrides,
  };
}

function createMockFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 1,
    event: 1,
    team_h: 1,
    team_a: 2,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    team_h_score: null,
    team_a_score: null,
    finished: false,
    finished_provisional: false,
    kickoff_time: "2024-01-15T15:00:00Z",
    minutes: 0,
    provisional_start_time: false,
    started: false,
    code: 1,
    stats: [],
    pulse_id: 1,
    ...overrides,
  };
}

function createMockGameweek(overrides: Partial<Gameweek> = {}): Gameweek {
  return {
    id: 1,
    name: "Gameweek 1",
    deadline_time: "2024-01-15T11:30:00Z",
    release_time: null,
    average_entry_score: 0,
    finished: false,
    data_checked: false,
    highest_scoring_entry: null,
    deadline_time_epoch: 1705315800,
    deadline_time_game_offset: 0,
    highest_score: null,
    is_previous: false,
    is_current: false,
    is_next: false,
    cup_leagues_created: false,
    h2h_ko_matches_created: false,
    ranked_count: 0,
    chip_plays: [],
    most_selected: null,
    most_transferred_in: null,
    top_element: null,
    top_element_info: null,
    transfers_made: 0,
    most_captained: null,
    most_vice_captained: null,
    ...overrides,
  };
}

describe("Fixture Planner", () => {
  describe("buildFixtureGrid", () => {
    it("builds correct grid for single gameweek range", () => {
      const teams = [
        createMockTeam({ id: 1, name: "Liverpool", short_name: "LIV" }),
        createMockTeam({ id: 2, name: "Man City", short_name: "MCI" }),
      ];
      const fixtures = [
        createMockFixture({
          id: 1,
          event: 1,
          team_h: 1,
          team_a: 2,
          team_h_difficulty: 4,
          team_a_difficulty: 4,
        }),
      ];

      const grid = buildFixtureGrid(teams, fixtures, 1, 1);

      expect(grid.length).toBe(2);

      // Liverpool (home)
      const livRow = grid.find((r) => r.team.id === 1);
      expect(livRow).toBeDefined();
      const livCells = livRow!.fixtures.get(1);
      expect(livCells?.length).toBe(1);
      expect(livCells?.[0].opponent.id).toBe(2);
      expect(livCells?.[0].isHome).toBe(true);
      expect(livCells?.[0].difficulty).toBe(4);

      // Man City (away)
      const mciRow = grid.find((r) => r.team.id === 2);
      expect(mciRow).toBeDefined();
      const mciCells = mciRow!.fixtures.get(1);
      expect(mciCells?.length).toBe(1);
      expect(mciCells?.[0].opponent.id).toBe(1);
      expect(mciCells?.[0].isHome).toBe(false);
    });

    it("handles multiple fixtures per team (DGW)", () => {
      const teams = [
        createMockTeam({ id: 1, name: "Liverpool", short_name: "LIV" }),
        createMockTeam({ id: 2, name: "Man City", short_name: "MCI" }),
        createMockTeam({ id: 3, name: "Arsenal", short_name: "ARS" }),
      ];
      const fixtures = [
        createMockFixture({ id: 1, event: 1, team_h: 1, team_a: 2 }),
        createMockFixture({ id: 2, event: 1, team_h: 1, team_a: 3 }), // Liverpool DGW
      ];

      const grid = buildFixtureGrid(teams, fixtures, 1, 1);
      const livRow = grid.find((r) => r.team.id === 1);

      const livCells = livRow!.fixtures.get(1);
      expect(livCells?.length).toBe(2);
    });

    it("excludes fixtures outside GW range", () => {
      const teams = [createMockTeam({ id: 1 }), createMockTeam({ id: 2 })];
      const fixtures = [
        createMockFixture({ id: 1, event: 1, team_h: 1, team_a: 2 }),
        createMockFixture({ id: 2, event: 5, team_h: 1, team_a: 2 }), // Outside range
      ];

      const grid = buildFixtureGrid(teams, fixtures, 1, 3);
      const row = grid.find((r) => r.team.id === 1);

      expect(row!.fixtures.get(1)?.length).toBe(1);
      expect(row!.fixtures.get(5)).toBeUndefined();
    });

    it("handles teams with missing fixtures (null event)", () => {
      const teams = [createMockTeam({ id: 1 }), createMockTeam({ id: 2 })];
      const fixtures = [
        createMockFixture({ id: 1, event: null, team_h: 1, team_a: 2 }),
      ];

      const grid = buildFixtureGrid(teams, fixtures, 1, 5);
      const row = grid.find((r) => r.team.id === 1);

      expect(row!.totalDifficulty).toBe(0);
    });

    it("calculates totalDifficulty correctly", () => {
      const teams = [createMockTeam({ id: 1 }), createMockTeam({ id: 2 })];
      const fixtures = [
        createMockFixture({
          id: 1,
          event: 1,
          team_h: 1,
          team_a: 2,
          team_h_difficulty: 2,
          team_a_difficulty: 4,
        }),
        createMockFixture({
          id: 2,
          event: 2,
          team_h: 2,
          team_a: 1,
          team_h_difficulty: 3,
          team_a_difficulty: 3,
        }),
      ];

      const grid = buildFixtureGrid(teams, fixtures, 1, 2);

      const team1Row = grid.find((r) => r.team.id === 1);
      expect(team1Row!.totalDifficulty).toBe(5); // 2 (home GW1) + 3 (away GW2)

      const team2Row = grid.find((r) => r.team.id === 2);
      expect(team2Row!.totalDifficulty).toBe(7); // 4 (away GW1) + 3 (home GW2)
    });
  });

  describe("sortByEasiestFixtures", () => {
    it("sorts teams by average difficulty (lowest first)", () => {
      const teams = [
        createMockTeam({ id: 1, name: "Hard" }),
        createMockTeam({ id: 2, name: "Easy" }),
      ];
      const fixtures = [
        createMockFixture({
          event: 1,
          team_h: 1,
          team_a: 2,
          team_h_difficulty: 5,
          team_a_difficulty: 2,
        }),
      ];

      const grid = buildFixtureGrid(teams, fixtures, 1, 1);
      const sorted = sortByEasiestFixtures(grid);

      expect(sorted[0].team.id).toBe(2); // Easy team first
      expect(sorted[1].team.id).toBe(1); // Hard team second
    });

    it("breaks ties by fixture count (more fixtures first)", () => {
      const teams = [
        createMockTeam({ id: 1, name: "One fixture" }),
        createMockTeam({ id: 2, name: "Two fixtures" }),
        createMockTeam({ id: 3, name: "Opponent" }),
      ];
      const fixtures = [
        createMockFixture({
          id: 1,
          event: 1,
          team_h: 1,
          team_a: 3,
          team_h_difficulty: 2,
          team_a_difficulty: 2,
        }),
        createMockFixture({
          id: 2,
          event: 1,
          team_h: 2,
          team_a: 3,
          team_h_difficulty: 2,
          team_a_difficulty: 2,
        }),
        createMockFixture({
          id: 3,
          event: 2,
          team_h: 2,
          team_a: 3,
          team_h_difficulty: 2,
          team_a_difficulty: 2,
        }),
      ];

      const grid = buildFixtureGrid(teams, fixtures, 1, 2);
      const sorted = sortByEasiestFixtures(grid);

      // Team 2 has same avg difficulty but more fixtures
      const team2Index = sorted.findIndex((r) => r.team.id === 2);
      const team1Index = sorted.findIndex((r) => r.team.id === 1);
      expect(team2Index).toBeLessThan(team1Index);
    });

    it("handles teams with no fixtures (penalized with 999)", () => {
      const teams = [
        createMockTeam({ id: 1, name: "Has fixtures" }),
        createMockTeam({ id: 2, name: "No fixtures" }),
        createMockTeam({ id: 3, name: "Opponent" }),
      ];
      const fixtures = [
        createMockFixture({
          event: 1,
          team_h: 1,
          team_a: 3,
          team_h_difficulty: 5,
          team_a_difficulty: 5,
        }),
      ];

      const grid = buildFixtureGrid(teams, fixtures, 1, 1);
      const sorted = sortByEasiestFixtures(grid);

      // Team 2 (no fixtures) should be last
      expect(sorted[sorted.length - 1].team.id).toBe(2);
    });

    it("does not mutate original array", () => {
      const teams = [createMockTeam({ id: 1 }), createMockTeam({ id: 2 })];
      const fixtures = [createMockFixture({ event: 1, team_h: 1, team_a: 2 })];

      const grid = buildFixtureGrid(teams, fixtures, 1, 1);
      const originalOrder = grid.map((r) => r.team.id);
      sortByEasiestFixtures(grid);

      expect(grid.map((r) => r.team.id)).toEqual(originalOrder);
    });
  });

  describe("getFDRColorClass", () => {
    it("returns correct class for difficulty 1 (very easy)", () => {
      expect(getFDRColorClass(1)).toBe("bg-emerald-600 text-white");
    });

    it("returns correct class for difficulty 2 (easy)", () => {
      expect(getFDRColorClass(2)).toBe("bg-emerald-400/80 text-gray-900");
    });

    it("returns correct class for difficulty 3 (medium)", () => {
      expect(getFDRColorClass(3)).toBe("bg-gray-400/80 text-gray-900");
    });

    it("returns correct class for difficulty 4 (hard)", () => {
      expect(getFDRColorClass(4)).toBe("bg-orange-500/80 text-white");
    });

    it("returns correct class for difficulty 5 (very hard)", () => {
      expect(getFDRColorClass(5)).toBe("bg-red-600 text-white");
    });

    it("returns default class for invalid difficulty", () => {
      expect(getFDRColorClass(0)).toBe("bg-fpl-purple-light text-fpl-muted");
      expect(getFDRColorClass(6)).toBe("bg-fpl-purple-light text-fpl-muted");
    });
  });

  describe("findSpecialGameweeks", () => {
    it("identifies DGW teams correctly (2+ fixtures)", () => {
      const teams = [
        createMockTeam({ id: 1 }),
        createMockTeam({ id: 2 }),
        createMockTeam({ id: 3 }),
      ];
      const events = [createMockGameweek({ id: 1 })];
      const fixtures = [
        createMockFixture({ event: 1, team_h: 1, team_a: 2 }),
        createMockFixture({ event: 1, team_h: 1, team_a: 3 }), // Team 1 has DGW
      ];

      const { dgws, bgws } = findSpecialGameweeks(fixtures, teams, events);

      expect(dgws.get(1)).toContain(1);
      expect(dgws.get(1)?.length).toBe(1);
    });

    it("identifies BGW teams correctly (0 fixtures)", () => {
      const teams = [
        createMockTeam({ id: 1 }),
        createMockTeam({ id: 2 }),
        createMockTeam({ id: 3 }), // No fixture
      ];
      const events = [createMockGameweek({ id: 1 })];
      const fixtures = [createMockFixture({ event: 1, team_h: 1, team_a: 2 })];

      const { dgws, bgws } = findSpecialGameweeks(fixtures, teams, events);

      expect(bgws.get(1)).toContain(3);
    });

    it("handles gameweek with no special conditions", () => {
      const teams = [createMockTeam({ id: 1 }), createMockTeam({ id: 2 })];
      const events = [createMockGameweek({ id: 1 })];
      const fixtures = [createMockFixture({ event: 1, team_h: 1, team_a: 2 })];

      const { dgws, bgws } = findSpecialGameweeks(fixtures, teams, events);

      expect(dgws.has(1)).toBe(false);
      expect(bgws.has(1)).toBe(false);
    });

    it("handles mixed DGW/BGW in same gameweek", () => {
      const teams = [
        createMockTeam({ id: 1 }),
        createMockTeam({ id: 2 }),
        createMockTeam({ id: 3 }),
        createMockTeam({ id: 4 }), // BGW
      ];
      const events = [createMockGameweek({ id: 1 })];
      const fixtures = [
        createMockFixture({ event: 1, team_h: 1, team_a: 2 }),
        createMockFixture({ event: 1, team_h: 1, team_a: 3 }), // Team 1 DGW
      ];

      const { dgws, bgws } = findSpecialGameweeks(fixtures, teams, events);

      expect(dgws.get(1)).toContain(1);
      expect(bgws.get(1)).toContain(4);
    });
  });
});
