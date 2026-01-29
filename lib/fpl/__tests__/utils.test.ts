import { describe, it, expect } from "vitest";
import type { Player, Team, Gameweek, Fixture } from "../types";
import {
  getPlayerFullName,
  getPlayerDisplayName,
  getPlayerPrice,
  getPlayerPriceValue,
  getPositionName,
  getPositionShortName,
  getPlayerStatusInfo,
  getPlayerForm,
  getPlayerPointsPerGame,
  getPlayerValueScore,
  getPlayerXG,
  getPlayerXA,
  getPlayerXGI,
  getPlayerICT,
  getPlayerOwnership,
  getTeamShortName,
  buildTeamMap,
  buildPlayerMap,
  getFixtureDifficultyClass,
  formatKickoffTime,
  formatKickoffDate,
  getFixtureResult,
  isBlankFixture,
  getCurrentGameweek,
  getNextGameweek,
  getGameweekById,
  getTimeUntilDeadline,
  formatTimeUntilDeadline,
  sortPlayersByPoints,
  sortPlayersByForm,
  sortPlayersByPrice,
  sortPlayersByOwnership,
  filterPlayersByPosition,
  filterPlayersByTeam,
  filterPlayersByPriceRange,
  filterAvailablePlayers,
  searchPlayers,
  enrichPlayer,
} from "../utils";

// Mock player factory
function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    first_name: "Mohamed",
    second_name: "Salah",
    web_name: "Salah",
    team: 1,
    element_type: 3,
    now_cost: 130,
    total_points: 150,
    form: "8.5",
    points_per_game: "7.2",
    selected_by_percent: "45.5",
    expected_goals: "10.5",
    expected_assists: "5.2",
    ict_index: "250.5",
    status: "a",
    minutes: 1800,
    goals_scored: 12,
    assists: 8,
    clean_sheets: 5,
    goals_conceded: 10,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 2,
    red_cards: 0,
    saves: 0,
    bonus: 20,
    bps: 450,
    influence: "500",
    creativity: "400",
    threat: "600",
    starts: 20,
    chance_of_playing_next_round: 100,
    chance_of_playing_this_round: 100,
    code: 12345,
    cost_change_event: 0,
    cost_change_event_fall: 0,
    cost_change_start: 5,
    cost_change_start_fall: 0,
    dreamteam_count: 5,
    ep_next: "6.5",
    ep_this: "6.0",
    in_dreamteam: false,
    news: "",
    news_added: null,
    photo: "12345.jpg",
    special: false,
    squad_number: 11,
    team_code: 100,
    transfers_in: 50000,
    transfers_in_event: 5000,
    transfers_out: 20000,
    transfers_out_event: 2000,
    value_form: "0.7",
    value_season: "11.5",
    influence_rank: 5,
    influence_rank_type: 2,
    creativity_rank: 8,
    creativity_rank_type: 3,
    threat_rank: 3,
    threat_rank_type: 1,
    ict_index_rank: 4,
    ict_index_rank_type: 2,
    corners_and_indirect_freekicks_order: null,
    corners_and_indirect_freekicks_text: "",
    direct_freekicks_order: null,
    direct_freekicks_text: "",
    penalties_order: 1,
    penalties_text: "On pens",
    expected_goals_per_90: 0.5,
    saves_per_90: 0,
    expected_assists_per_90: 0.25,
    expected_goal_involvements_per_90: 0.75,
    expected_goals_conceded_per_90: 0,
    goals_conceded_per_90: 0.5,
    now_cost_rank: 3,
    now_cost_rank_type: 1,
    form_rank: 2,
    form_rank_type: 1,
    points_per_game_rank: 4,
    points_per_game_rank_type: 2,
    selected_rank: 1,
    selected_rank_type: 1,
    starts_per_90: 1,
    clean_sheets_per_90: 0.25,
    ...overrides,
  };
}

function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 1,
    name: "Liverpool",
    short_name: "LIV",
    code: 100,
    draw: 5,
    form: null,
    loss: 3,
    played: 20,
    points: 45,
    position: 3,
    strength: 5,
    team_division: null,
    unavailable: false,
    win: 12,
    strength_overall_home: 1300,
    strength_overall_away: 1250,
    strength_attack_home: 1350,
    strength_attack_away: 1300,
    strength_defence_home: 1250,
    strength_defence_away: 1200,
    pulse_id: 10,
    ...overrides,
  };
}

function createMockGameweek(overrides: Partial<Gameweek> = {}): Gameweek {
  return {
    id: 20,
    name: "Gameweek 20",
    deadline_time: "2024-01-15T11:30:00Z",
    deadline_time_epoch: 1705318200,
    deadline_time_game_offset: 0,
    release_time: null,
    average_entry_score: 50,
    finished: false,
    data_checked: true,
    highest_scoring_entry: null,
    highest_score: null,
    is_previous: false,
    is_current: true,
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

function createMockFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 1,
    code: 12345,
    event: 20,
    finished: false,
    finished_provisional: false,
    kickoff_time: "2024-01-15T15:00:00Z",
    minutes: 0,
    provisional_start_time: false,
    started: false,
    team_a: 2,
    team_a_score: null,
    team_h: 1,
    team_h_score: null,
    stats: [],
    team_h_difficulty: 3,
    team_a_difficulty: 4,
    pulse_id: 100,
    ...overrides,
  };
}

describe("Player Utilities", () => {
  describe("getPlayerFullName", () => {
    it("returns the full name", () => {
      const player = createMockPlayer();
      expect(getPlayerFullName(player)).toBe("Mohamed Salah");
    });
  });

  describe("getPlayerDisplayName", () => {
    it("returns the web_name", () => {
      const player = createMockPlayer();
      expect(getPlayerDisplayName(player)).toBe("Salah");
    });
  });

  describe("getPlayerPrice", () => {
    it("formats price correctly", () => {
      const player = createMockPlayer({ now_cost: 130 });
      expect(getPlayerPrice(player)).toBe("£13.0m");
    });

    it("handles decimal prices", () => {
      const player = createMockPlayer({ now_cost: 85 });
      expect(getPlayerPrice(player)).toBe("£8.5m");
    });
  });

  describe("getPlayerPriceValue", () => {
    it("converts cost to millions", () => {
      const player = createMockPlayer({ now_cost: 130 });
      expect(getPlayerPriceValue(player)).toBe(13);
    });
  });

  describe("getPositionName", () => {
    it("returns correct position names", () => {
      expect(getPositionName(1)).toBe("Goalkeeper");
      expect(getPositionName(2)).toBe("Defender");
      expect(getPositionName(3)).toBe("Midfielder");
      expect(getPositionName(4)).toBe("Forward");
    });
  });

  describe("getPositionShortName", () => {
    it("returns correct short names", () => {
      expect(getPositionShortName(1)).toBe("GK");
      expect(getPositionShortName(2)).toBe("DEF");
      expect(getPositionShortName(3)).toBe("MID");
      expect(getPositionShortName(4)).toBe("FWD");
    });
  });

  describe("getPlayerStatusInfo", () => {
    it("returns correct status info", () => {
      expect(getPlayerStatusInfo("a")).toEqual({
        label: "Available",
        severity: "available",
      });
      expect(getPlayerStatusInfo("d")).toEqual({
        label: "Doubtful",
        severity: "warning",
      });
      expect(getPlayerStatusInfo("i")).toEqual({
        label: "Injured",
        severity: "danger",
      });
      expect(getPlayerStatusInfo("s")).toEqual({
        label: "Suspended",
        severity: "danger",
      });
    });
  });

  describe("getPlayerForm", () => {
    it("parses form as number", () => {
      const player = createMockPlayer({ form: "8.5" });
      expect(getPlayerForm(player)).toBe(8.5);
    });

    it("returns 0 for invalid form", () => {
      const player = createMockPlayer({ form: "" });
      expect(getPlayerForm(player)).toBe(0);
    });
  });

  describe("getPlayerPointsPerGame", () => {
    it("parses ppg as number", () => {
      const player = createMockPlayer({ points_per_game: "7.2" });
      expect(getPlayerPointsPerGame(player)).toBe(7.2);
    });
  });

  describe("getPlayerValueScore", () => {
    it("calculates points per million", () => {
      const player = createMockPlayer({ total_points: 150, now_cost: 100 });
      expect(getPlayerValueScore(player)).toBe(15);
    });

    it("returns 0 for free players", () => {
      const player = createMockPlayer({ total_points: 50, now_cost: 0 });
      expect(getPlayerValueScore(player)).toBe(0);
    });
  });

  describe("getPlayerXG/XA/XGI", () => {
    it("parses expected stats correctly", () => {
      const player = createMockPlayer({
        expected_goals: "10.5",
        expected_assists: "5.2",
      });
      expect(getPlayerXG(player)).toBe(10.5);
      expect(getPlayerXA(player)).toBe(5.2);
      expect(getPlayerXGI(player)).toBe(15.7);
    });
  });

  describe("getPlayerICT", () => {
    it("parses ICT index", () => {
      const player = createMockPlayer({ ict_index: "250.5" });
      expect(getPlayerICT(player)).toBe(250.5);
    });
  });

  describe("getPlayerOwnership", () => {
    it("parses ownership percentage", () => {
      const player = createMockPlayer({ selected_by_percent: "45.5" });
      expect(getPlayerOwnership(player)).toBe(45.5);
    });
  });
});

describe("Team Utilities", () => {
  describe("getTeamShortName", () => {
    it("returns short name", () => {
      const team = createMockTeam();
      expect(getTeamShortName(team)).toBe("LIV");
    });
  });

  describe("buildTeamMap", () => {
    it("creates a map by team id", () => {
      const teams = [
        createMockTeam({ id: 1, short_name: "LIV" }),
        createMockTeam({ id: 2, short_name: "MCI" }),
      ];
      const map = buildTeamMap(teams);
      expect(map.get(1)?.short_name).toBe("LIV");
      expect(map.get(2)?.short_name).toBe("MCI");
      expect(map.size).toBe(2);
    });
  });

  describe("buildPlayerMap", () => {
    it("creates a map by player id", () => {
      const players = [
        createMockPlayer({ id: 1, web_name: "Salah" }),
        createMockPlayer({ id: 2, web_name: "Haaland" }),
      ];
      const map = buildPlayerMap(players);
      expect(map.get(1)?.web_name).toBe("Salah");
      expect(map.get(2)?.web_name).toBe("Haaland");
    });
  });
});

describe("Fixture Utilities", () => {
  describe("getFixtureDifficultyClass", () => {
    it("returns correct classes for each difficulty", () => {
      expect(getFixtureDifficultyClass(1)).toContain("bg-green-500");
      expect(getFixtureDifficultyClass(2)).toContain("bg-green-300");
      expect(getFixtureDifficultyClass(3)).toContain("bg-gray-300");
      expect(getFixtureDifficultyClass(4)).toContain("bg-red-300");
      expect(getFixtureDifficultyClass(5)).toContain("bg-red-500");
    });
  });

  describe("formatKickoffTime", () => {
    it("formats kickoff time", () => {
      const result = formatKickoffTime("2024-01-15T15:00:00Z");
      expect(result).toContain("15");
      expect(result).toContain("Jan");
    });

    it("returns TBD for null", () => {
      expect(formatKickoffTime(null)).toBe("TBD");
    });
  });

  describe("formatKickoffDate", () => {
    it("formats kickoff date only", () => {
      const result = formatKickoffDate("2024-01-15T15:00:00Z");
      expect(result).toContain("15");
      expect(result).toContain("Jan");
    });

    it("returns TBD for null", () => {
      expect(formatKickoffDate(null)).toBe("TBD");
    });
  });

  describe("getFixtureResult", () => {
    it("returns score for finished fixture", () => {
      const fixture = createMockFixture({
        finished: true,
        team_h_score: 2,
        team_a_score: 1,
      });
      expect(getFixtureResult(fixture)).toBe("2 - 1");
    });

    it("returns empty for unfinished fixture", () => {
      const fixture = createMockFixture({ finished: false });
      expect(getFixtureResult(fixture)).toBe("");
    });
  });

  describe("isBlankFixture", () => {
    it("returns true for null fixture", () => {
      expect(isBlankFixture(null)).toBe(true);
    });

    it("returns true for fixture with null event", () => {
      const fixture = createMockFixture({ event: null });
      expect(isBlankFixture(fixture)).toBe(true);
    });

    it("returns false for valid fixture", () => {
      const fixture = createMockFixture({ event: 20 });
      expect(isBlankFixture(fixture)).toBe(false);
    });
  });
});

describe("Gameweek Utilities", () => {
  describe("getCurrentGameweek", () => {
    it("finds the current gameweek", () => {
      const events = [
        createMockGameweek({ id: 19, is_current: false, is_next: false }),
        createMockGameweek({ id: 20, is_current: true, is_next: false }),
        createMockGameweek({ id: 21, is_current: false, is_next: true }),
      ];
      expect(getCurrentGameweek(events)?.id).toBe(20);
    });

    it("returns undefined if no current", () => {
      const events = [createMockGameweek({ is_current: false })];
      expect(getCurrentGameweek(events)).toBeUndefined();
    });
  });

  describe("getNextGameweek", () => {
    it("finds the next gameweek", () => {
      const events = [
        createMockGameweek({ id: 20, is_current: true, is_next: false }),
        createMockGameweek({ id: 21, is_current: false, is_next: true }),
      ];
      expect(getNextGameweek(events)?.id).toBe(21);
    });
  });

  describe("getGameweekById", () => {
    it("finds gameweek by id", () => {
      const events = [
        createMockGameweek({ id: 19 }),
        createMockGameweek({ id: 20 }),
      ];
      expect(getGameweekById(events, 20)?.id).toBe(20);
    });

    it("returns undefined for non-existent id", () => {
      const events = [createMockGameweek({ id: 20 })];
      expect(getGameweekById(events, 99)).toBeUndefined();
    });
  });

  describe("getTimeUntilDeadline", () => {
    it("returns isPast true for past deadline", () => {
      const pastDeadline = new Date(Date.now() - 60000).toISOString();
      const result = getTimeUntilDeadline(pastDeadline);
      expect(result.isPast).toBe(true);
    });

    it("calculates time correctly for future deadline", () => {
      const futureDeadline = new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const result = getTimeUntilDeadline(futureDeadline);
      expect(result.isPast).toBe(false);
      expect(result.days).toBeGreaterThanOrEqual(1);
    });
  });

  describe("formatTimeUntilDeadline", () => {
    it('returns "Deadline passed" for past deadline', () => {
      const pastDeadline = new Date(Date.now() - 60000).toISOString();
      expect(formatTimeUntilDeadline(pastDeadline)).toBe("Deadline passed");
    });
  });
});

describe("Sorting Functions", () => {
  const players = [
    createMockPlayer({
      id: 1,
      total_points: 100,
      form: "5.0",
      now_cost: 100,
      selected_by_percent: "30",
    }),
    createMockPlayer({
      id: 2,
      total_points: 150,
      form: "8.0",
      now_cost: 130,
      selected_by_percent: "50",
    }),
    createMockPlayer({
      id: 3,
      total_points: 80,
      form: "3.0",
      now_cost: 60,
      selected_by_percent: "10",
    }),
  ];

  describe("sortPlayersByPoints", () => {
    it("sorts by total points descending", () => {
      const sorted = sortPlayersByPoints(players);
      expect(sorted[0].total_points).toBe(150);
      expect(sorted[2].total_points).toBe(80);
    });

    it("does not mutate original array", () => {
      const original = [...players];
      sortPlayersByPoints(players);
      expect(players).toEqual(original);
    });
  });

  describe("sortPlayersByForm", () => {
    it("sorts by form descending", () => {
      const sorted = sortPlayersByForm(players);
      expect(sorted[0].form).toBe("8.0");
      expect(sorted[2].form).toBe("3.0");
    });
  });

  describe("sortPlayersByPrice", () => {
    it("sorts by price descending", () => {
      const sorted = sortPlayersByPrice(players);
      expect(sorted[0].now_cost).toBe(130);
      expect(sorted[2].now_cost).toBe(60);
    });
  });

  describe("sortPlayersByOwnership", () => {
    it("sorts by ownership descending", () => {
      const sorted = sortPlayersByOwnership(players);
      expect(sorted[0].selected_by_percent).toBe("50");
      expect(sorted[2].selected_by_percent).toBe("10");
    });
  });
});

describe("Filtering Functions", () => {
  const players = [
    createMockPlayer({
      id: 1,
      element_type: 1,
      team: 1,
      now_cost: 50,
      status: "a",
    }),
    createMockPlayer({
      id: 2,
      element_type: 2,
      team: 1,
      now_cost: 60,
      status: "a",
    }),
    createMockPlayer({
      id: 3,
      element_type: 3,
      team: 2,
      now_cost: 100,
      status: "i",
    }),
    createMockPlayer({
      id: 4,
      element_type: 4,
      team: 2,
      now_cost: 130,
      status: "a",
    }),
  ];

  describe("filterPlayersByPosition", () => {
    it("filters by position", () => {
      const mids = filterPlayersByPosition(players, 3);
      expect(mids.length).toBe(1);
      expect(mids[0].element_type).toBe(3);
    });
  });

  describe("filterPlayersByTeam", () => {
    it("filters by team", () => {
      const team1 = filterPlayersByTeam(players, 1);
      expect(team1.length).toBe(2);
    });
  });

  describe("filterPlayersByPriceRange", () => {
    it("filters by price range", () => {
      const midRange = filterPlayersByPriceRange(players, 5.5, 10.5);
      expect(midRange.length).toBe(2);
    });
  });

  describe("filterAvailablePlayers", () => {
    it("filters only available players", () => {
      const available = filterAvailablePlayers(players);
      expect(available.length).toBe(3);
      expect(available.every((p) => p.status === "a")).toBe(true);
    });
  });

  describe("searchPlayers", () => {
    it("searches by web_name", () => {
      const salahPlayers = [createMockPlayer({ web_name: "Salah" })];
      const results = searchPlayers(salahPlayers, "sal");
      expect(results.length).toBe(1);
    });

    it("searches case-insensitively", () => {
      const salahPlayers = [createMockPlayer({ web_name: "Salah" })];
      const results = searchPlayers(salahPlayers, "SALAH");
      expect(results.length).toBe(1);
    });
  });
});

describe("Data Enrichment", () => {
  describe("enrichPlayer", () => {
    it("enriches player with computed values", () => {
      const player = createMockPlayer({ team: 1 });
      const teamMap = new Map([
        [1, createMockTeam({ id: 1, name: "Liverpool", short_name: "LIV" })],
      ]);

      const enriched = enrichPlayer(player, teamMap);

      expect(enriched.team_name).toBe("Liverpool");
      expect(enriched.team_short_name).toBe("LIV");
      expect(enriched.position_name).toBe("Midfielder");
      expect(enriched.position_short).toBe("MID");
      expect(enriched.price_formatted).toBe("£13.0m");
      expect(enriched.form_value).toBe(8.5);
      expect(enriched.xgi_value).toBe(15.7);
    });

    it("handles unknown team", () => {
      const player = createMockPlayer({ team: 999 });
      const teamMap = new Map<number, Team>();

      const enriched = enrichPlayer(player, teamMap);

      expect(enriched.team_name).toBe("Unknown");
      expect(enriched.team_short_name).toBe("???");
    });
  });
});
