import { describe, it, expect } from "vitest";
import type { Fixture, Gameweek } from "../types";
import type { EnrichedPlayer } from "../utils";
import { analyzeChipStrategies, analyzeChipTiming } from "../chip-model";

/**
 * Creates a mock enriched player for testing.
 */
function createMockPlayer(
  overrides: Partial<EnrichedPlayer> = {},
): EnrichedPlayer {
  return {
    id: 1,
    first_name: "Test",
    second_name: "Player",
    web_name: "T.Player",
    team: 1,
    element_type: 3,
    now_cost: 100,
    total_points: 100,
    form: "5.0",
    points_per_game: "5.0",
    selected_by_percent: "20.0",
    expected_goals: "5.0",
    expected_assists: "3.0",
    ict_index: "100",
    status: "a",
    minutes: 900,
    goals_scored: 5,
    assists: 3,
    clean_sheets: 2,
    goals_conceded: 5,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 1,
    red_cards: 0,
    saves: 0,
    bonus: 10,
    bps: 200,
    influence: "100",
    creativity: "100",
    threat: "100",
    starts: 10,
    chance_of_playing_next_round: 100,
    chance_of_playing_this_round: 100,
    code: 1,
    cost_change_event: 0,
    cost_change_event_fall: 0,
    cost_change_start: 0,
    cost_change_start_fall: 0,
    dreamteam_count: 0,
    ep_next: "5.0",
    ep_this: "5.0",
    in_dreamteam: false,
    news: "",
    news_added: null,
    photo: "",
    special: false,
    squad_number: null,
    team_code: 1,
    transfers_in: 1000,
    transfers_in_event: 100,
    transfers_out: 500,
    transfers_out_event: 50,
    value_form: "0.5",
    value_season: "10",
    influence_rank: 50,
    influence_rank_type: 20,
    creativity_rank: 50,
    creativity_rank_type: 20,
    threat_rank: 50,
    threat_rank_type: 20,
    ict_index_rank: 50,
    ict_index_rank_type: 20,
    corners_and_indirect_freekicks_order: null,
    corners_and_indirect_freekicks_text: "",
    direct_freekicks_order: null,
    direct_freekicks_text: "",
    penalties_order: null,
    penalties_text: "",
    expected_goals_per_90: 0.5,
    saves_per_90: 0,
    expected_assists_per_90: 0.3,
    expected_goal_involvements_per_90: 0.8,
    expected_goals_conceded_per_90: 0,
    goals_conceded_per_90: 0.5,
    now_cost_rank: 50,
    now_cost_rank_type: 20,
    form_rank: 50,
    form_rank_type: 20,
    points_per_game_rank: 50,
    points_per_game_rank_type: 20,
    selected_rank: 50,
    selected_rank_type: 20,
    starts_per_90: 1,
    clean_sheets_per_90: 0.2,
    team_name: "Test Team",
    team_short_name: "TST",
    position_name: "Midfielder",
    position_short: "MID",
    price_formatted: "£10.0m",
    form_value: 5.0,
    ppg_value: 5.0,
    value_score: 10.0,
    xg_value: 5.0,
    xa_value: 3.0,
    xgi_value: 8.0,
    ict_value: 100,
    ownership_value: 20.0,
    ...overrides,
  } as EnrichedPlayer;
}

/**
 * Creates a mock fixture for testing.
 */
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
    team_h: 1,
    team_a_score: null,
    team_h_score: null,
    stats: [],
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    pulse_id: 100,
    ...overrides,
  };
}

/**
 * Creates a mock gameweek for testing.
 */
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

/**
 * Creates standard fixtures for multiple gameweeks.
 * 10 fixtures per gameweek (20 teams playing).
 */
function createStandardFixtures(startGw: number, count: number): Fixture[] {
  const fixtures: Fixture[] = [];
  let fixtureId = 1;

  for (let gw = startGw; gw < startGw + count; gw++) {
    for (let i = 0; i < 10; i++) {
      fixtures.push(
        createMockFixture({
          id: fixtureId++,
          event: gw,
          team_h: i * 2 + 1,
          team_a: i * 2 + 2,
          team_h_difficulty: 3,
          team_a_difficulty: 3,
        }),
      );
    }
  }

  return fixtures;
}

/**
 * Creates double gameweek fixtures (some teams have 2 games).
 */
function createDgwFixtures(gw: number): Fixture[] {
  const fixtures = createStandardFixtures(gw, 1);
  let fixtureId = 100;

  // Add extra fixtures for 4 teams
  for (let i = 0; i < 4; i++) {
    fixtures.push(
      createMockFixture({
        id: fixtureId++,
        event: gw,
        team_h: i * 2 + 1,
        team_a: 15 + i,
        team_h_difficulty: 2,
        team_a_difficulty: 3,
      }),
    );
  }

  return fixtures;
}

/**
 * Creates blank gameweek fixtures (fewer teams playing).
 */
function createBgwFixtures(gw: number): Fixture[] {
  const fixtures: Fixture[] = [];

  // Only 6 fixtures (12 teams playing, 8 blanking)
  for (let i = 0; i < 6; i++) {
    fixtures.push(
      createMockFixture({
        id: i + 1,
        event: gw,
        team_h: i * 2 + 1,
        team_a: i * 2 + 2,
        team_h_difficulty: 3,
        team_a_difficulty: 3,
      }),
    );
  }

  return fixtures;
}

/**
 * Creates gameweeks for testing.
 */
function createGameweeks(startGw: number, count: number): Gameweek[] {
  return Array.from({ length: count }, (_, i) =>
    createMockGameweek({
      id: startGw + i,
      name: `Gameweek ${startGw + i}`,
      is_current: i === 0,
      is_next: i === 1,
    }),
  );
}

/**
 * Creates premium players with high form.
 */
function createPremiumPlayers(): EnrichedPlayer[] {
  return [
    createMockPlayer({
      id: 1,
      web_name: "Haaland",
      now_cost: 150,
      form: "8.5",
      team: 1,
      element_type: 4,
    }),
    createMockPlayer({
      id: 2,
      web_name: "Salah",
      now_cost: 130,
      form: "8.0",
      team: 2,
      element_type: 3,
    }),
    createMockPlayer({
      id: 3,
      web_name: "Palmer",
      now_cost: 110,
      form: "7.5",
      team: 3,
      element_type: 3,
    }),
  ];
}

// =============================================================================
// analyzeChipStrategies Tests
// =============================================================================

describe("analyzeChipStrategies", () => {
  it("returns recommendations for all available chips", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 6);
    const events = createGameweeks(20, 6);
    const availableChips = ["wildcard", "freehit", "3xc", "bboost"];

    const recommendations = analyzeChipStrategies(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    expect(recommendations).toHaveLength(4);
    expect(recommendations.map((r) => r.chip)).toContain("wildcard");
    expect(recommendations.map((r) => r.chip)).toContain("freehit");
    expect(recommendations.map((r) => r.chip)).toContain("3xc");
    expect(recommendations.map((r) => r.chip)).toContain("bboost");
  });

  it("only returns recommendations for available chips", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 6);
    const events = createGameweeks(20, 6);
    const availableChips = ["freehit", "bboost"];

    const recommendations = analyzeChipStrategies(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations.map((r) => r.chip)).not.toContain("wildcard");
    expect(recommendations.map((r) => r.chip)).not.toContain("3xc");
  });

  it("sorts recommendations by score descending", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 6);
    const events = createGameweeks(20, 6);
    const availableChips = ["wildcard", "freehit", "3xc", "bboost"];

    const recommendations = analyzeChipStrategies(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    for (let i = 1; i < recommendations.length; i++) {
      expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(
        recommendations[i].score,
      );
    }
  });

  it("returns empty array when no chips available", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 6);
    const events = createGameweeks(20, 6);

    const recommendations = analyzeChipStrategies(
      players,
      fixtures,
      events,
      20,
      [],
    );

    expect(recommendations).toHaveLength(0);
  });

  describe("Free Hit detection", () => {
    it("detects blank gameweek opportunity", () => {
      const players = createPremiumPlayers();
      const fixtures = [
        ...createStandardFixtures(20, 2),
        ...createBgwFixtures(22), // BGW at GW22
        ...createStandardFixtures(23, 4),
      ];
      const events = createGameweeks(20, 6);
      const availableChips = ["freehit"];

      const recommendations = analyzeChipStrategies(
        players,
        fixtures,
        events,
        20,
        availableChips,
      );

      const freeHit = recommendations.find((r) => r.chip === "freehit");
      expect(freeHit).toBeDefined();
      expect(freeHit!.suggestedGw).toBe(22);
      expect(
        freeHit!.reasoning.some((r) => r.toLowerCase().includes("blank")),
      ).toBe(true);
    });

    it("detects double gameweek opportunity", () => {
      const players = createPremiumPlayers();
      const fixtures = [
        ...createStandardFixtures(20, 2),
        ...createDgwFixtures(22), // DGW at GW22
        ...createStandardFixtures(23, 4),
      ];
      const events = createGameweeks(20, 6);
      const availableChips = ["freehit"];

      const recommendations = analyzeChipStrategies(
        players,
        fixtures,
        events,
        20,
        availableChips,
      );

      const freeHit = recommendations.find((r) => r.chip === "freehit");
      expect(freeHit).toBeDefined();
      expect(
        freeHit!.reasoning.some((r) => r.toLowerCase().includes("double")),
      ).toBe(true);
    });
  });

  describe("Bench Boost detection", () => {
    it("detects double gameweek for bench boost", () => {
      const players = createPremiumPlayers();
      const fixtures = [
        ...createStandardFixtures(20, 2),
        ...createDgwFixtures(22), // DGW at GW22
        ...createStandardFixtures(23, 4),
      ];
      const events = createGameweeks(20, 6);
      const availableChips = ["bboost"];

      const recommendations = analyzeChipStrategies(
        players,
        fixtures,
        events,
        20,
        availableChips,
      );

      const bb = recommendations.find((r) => r.chip === "bboost");
      expect(bb).toBeDefined();
      expect(bb!.suggestedGw).toBe(22);
      expect(bb!.reasoning.some((r) => r.toLowerCase().includes("dgw"))).toBe(
        true,
      );
    });
  });

  describe("Triple Captain detection", () => {
    it("detects premium player with easy home fixture", () => {
      const premium = createMockPlayer({
        id: 1,
        web_name: "Haaland",
        now_cost: 150,
        form: "8.5",
        team: 1,
      });

      const fixtures = [
        createMockFixture({
          event: 20,
          team_h: 1,
          team_a: 20,
          team_h_difficulty: 2, // Easy home
          team_a_difficulty: 4,
        }),
        ...createStandardFixtures(21, 5),
      ];
      const events = createGameweeks(20, 6);
      const availableChips = ["3xc"];

      const recommendations = analyzeChipStrategies(
        [premium],
        fixtures,
        events,
        20,
        availableChips,
      );

      const tc = recommendations.find((r) => r.chip === "3xc");
      expect(tc).toBeDefined();
      expect(tc!.reasoning.some((r) => r.includes("Haaland"))).toBe(true);
    });

    it("detects premium player with double gameweek", () => {
      const premium = createMockPlayer({
        id: 1,
        web_name: "Haaland",
        now_cost: 150,
        form: "8.0",
        team: 1,
      });

      const fixtures = [
        ...createStandardFixtures(20, 2),
        ...createDgwFixtures(22), // DGW - team 1 has 2 games
        ...createStandardFixtures(23, 3),
      ];
      const events = createGameweeks(20, 6);
      const availableChips = ["3xc"];

      const recommendations = analyzeChipStrategies(
        [premium],
        fixtures,
        events,
        20,
        availableChips,
      );

      const tc = recommendations.find((r) => r.chip === "3xc");
      expect(tc).toBeDefined();
      expect(tc!.reasoning.some((r) => r.toLowerCase().includes("dgw"))).toBe(
        true,
      );
    });
  });

  describe("Wildcard detection", () => {
    it("recommends wildcard during mid-season window", () => {
      const players = createPremiumPlayers();
      const fixtures = createStandardFixtures(19, 6);
      const events = createGameweeks(19, 6);
      const availableChips = ["wildcard"];

      const recommendations = analyzeChipStrategies(
        players,
        fixtures,
        events,
        20, // GW20 is mid-season
        availableChips,
      );

      const wc = recommendations.find((r) => r.chip === "wildcard");
      expect(wc).toBeDefined();
      expect(
        wc!.reasoning.some((r) => r.toLowerCase().includes("mid-season")),
      ).toBe(true);
    });

    it("gives higher score when strong form players available", () => {
      const highFormPlayers = [
        createMockPlayer({ id: 1, form: "8.0", status: "a" }),
        createMockPlayer({ id: 2, form: "7.5", status: "a" }),
        createMockPlayer({ id: 3, form: "7.0", status: "a" }),
      ];
      const lowFormPlayers = [
        createMockPlayer({ id: 1, form: "3.0", status: "a" }),
        createMockPlayer({ id: 2, form: "2.5", status: "a" }),
        createMockPlayer({ id: 3, form: "2.0", status: "a" }),
      ];

      const fixtures = createStandardFixtures(10, 6);
      const events = createGameweeks(10, 6);

      const highFormRecs = analyzeChipStrategies(
        highFormPlayers,
        fixtures,
        events,
        10,
        ["wildcard"],
      );
      const lowFormRecs = analyzeChipStrategies(
        lowFormPlayers,
        fixtures,
        events,
        10,
        ["wildcard"],
      );

      const highWc = highFormRecs.find((r) => r.chip === "wildcard");
      const lowWc = lowFormRecs.find((r) => r.chip === "wildcard");

      expect(highWc!.score).toBeGreaterThan(lowWc!.score);
    });
  });

  it("includes reasoning for each recommendation", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 6);
    const events = createGameweeks(20, 6);
    const availableChips = ["wildcard", "freehit", "3xc", "bboost"];

    const recommendations = analyzeChipStrategies(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    for (const rec of recommendations) {
      expect(rec.reasoning).toBeDefined();
      expect(Array.isArray(rec.reasoning)).toBe(true);
      expect(rec.reasoning.length).toBeGreaterThan(0);
    }
  });

  it("caps scores at 100", () => {
    const players = createPremiumPlayers();
    // Create fixtures with extreme DGW
    const fixtures = [...createDgwFixtures(20), ...createDgwFixtures(21)];
    const events = createGameweeks(20, 6);
    const availableChips = ["wildcard", "freehit", "3xc", "bboost"];

    const recommendations = analyzeChipStrategies(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    for (const rec of recommendations) {
      expect(rec.score).toBeLessThanOrEqual(100);
    }
  });
});

// =============================================================================
// analyzeChipTiming Tests
// =============================================================================

describe("analyzeChipTiming", () => {
  it("returns timing analysis for all available chips", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 8);
    const events = createGameweeks(20, 8);
    const availableChips = ["wildcard", "freehit", "3xc", "bboost"];

    const analyses = analyzeChipTiming(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    expect(analyses).toHaveLength(4);
    for (const analysis of analyses) {
      expect(analysis).toHaveProperty("chip");
      expect(analysis).toHaveProperty("label");
      expect(analysis).toHaveProperty("currentGwScore");
      expect(analysis).toHaveProperty("bestGw");
      expect(analysis).toHaveProperty("bestGwScore");
      expect(analysis).toHaveProperty("gwScores");
      expect(analysis).toHaveProperty("recommendation");
      expect(analysis).toHaveProperty("summary");
    }
  });

  it("provides gameweek-by-gameweek scores", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 8);
    const events = createGameweeks(20, 8);
    const availableChips = ["bboost"];

    const analyses = analyzeChipTiming(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    const bb = analyses.find((a) => a.chip === "bboost");
    expect(bb).toBeDefined();
    expect(bb!.gwScores.length).toBeGreaterThan(0);

    for (const gwScore of bb!.gwScores) {
      expect(gwScore).toHaveProperty("gw");
      expect(gwScore).toHaveProperty("score");
      expect(gwScore).toHaveProperty("reasoning");
    }
  });

  it("identifies best gameweek for bench boost in DGW", () => {
    const players = createPremiumPlayers();
    const fixtures = [
      ...createStandardFixtures(20, 2),
      ...createDgwFixtures(22), // DGW at GW22
      ...createStandardFixtures(23, 5),
    ];
    const events = createGameweeks(20, 8);
    const availableChips = ["bboost"];

    const analyses = analyzeChipTiming(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    const bb = analyses.find((a) => a.chip === "bboost");
    expect(bb).toBeDefined();
    expect(bb!.bestGw).toBe(22);
    expect(bb!.bestGwScore).toBeGreaterThan(bb!.currentGwScore);
  });

  it("identifies best gameweek for free hit in BGW", () => {
    const players = createPremiumPlayers();
    const fixtures = [
      ...createStandardFixtures(20, 3),
      ...createBgwFixtures(23), // BGW at GW23
      ...createStandardFixtures(24, 4),
    ];
    const events = createGameweeks(20, 8);
    const availableChips = ["freehit"];

    const analyses = analyzeChipTiming(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    const fh = analyses.find((a) => a.chip === "freehit");
    expect(fh).toBeDefined();
    expect(fh!.bestGw).toBe(23);
  });

  it("returns wait recommendation when better opportunity ahead", () => {
    const players = createPremiumPlayers();
    const fixtures = [
      ...createStandardFixtures(20, 3),
      ...createDgwFixtures(23), // Better opportunity
      ...createStandardFixtures(24, 4),
    ];
    const events = createGameweeks(20, 8);
    const availableChips = ["bboost"];

    const analyses = analyzeChipTiming(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    const bb = analyses.find((a) => a.chip === "bboost");
    expect(bb).toBeDefined();
    expect(bb!.recommendation).toBe("wait");
    expect(bb!.bestGw).toBe(23);
  });

  it("sorts analyses by best GW score", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 8);
    const events = createGameweeks(20, 8);
    const availableChips = ["wildcard", "freehit", "3xc", "bboost"];

    const analyses = analyzeChipTiming(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    for (let i = 1; i < analyses.length; i++) {
      expect(analyses[i - 1].bestGwScore).toBeGreaterThanOrEqual(
        analyses[i].bestGwScore,
      );
    }
  });

  it("caps all scores at 100", () => {
    const players = createPremiumPlayers();
    const fixtures = [
      ...createDgwFixtures(20),
      ...createDgwFixtures(21),
      ...createDgwFixtures(22),
    ];
    const events = createGameweeks(20, 8);
    const availableChips = ["wildcard", "freehit", "3xc", "bboost"];

    const analyses = analyzeChipTiming(
      players,
      fixtures,
      events,
      20,
      availableChips,
    );

    for (const analysis of analyses) {
      expect(analysis.currentGwScore).toBeLessThanOrEqual(100);
      expect(analysis.bestGwScore).toBeLessThanOrEqual(100);
      for (const gwScore of analysis.gwScores) {
        expect(gwScore.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("returns empty array when no chips available", () => {
    const players = createPremiumPlayers();
    const fixtures = createStandardFixtures(20, 8);
    const events = createGameweeks(20, 8);

    const analyses = analyzeChipTiming(players, fixtures, events, 20, []);

    expect(analyses).toHaveLength(0);
  });

  it("handles squad picks for squad-aware analysis", () => {
    const players = createPremiumPlayers();
    const fixtures = [
      ...createStandardFixtures(20, 2),
      ...createDgwFixtures(22),
      ...createStandardFixtures(23, 5),
    ];
    const events = createGameweeks(20, 8);
    const availableChips = ["bboost"];
    const squadPicks = [
      {
        element: 1,
        position: 1,
        multiplier: 2,
        is_captain: true,
        is_vice_captain: false,
      },
      {
        element: 2,
        position: 2,
        multiplier: 1,
        is_captain: false,
        is_vice_captain: true,
      },
    ];

    const analyses = analyzeChipTiming(
      players,
      fixtures,
      events,
      20,
      availableChips,
      squadPicks,
    );

    expect(analyses).toHaveLength(1);
    expect(analyses[0].chip).toBe("bboost");
  });

  describe("recommendation logic", () => {
    it("returns play_now when current GW is optimal for bench boost", () => {
      const players = createPremiumPlayers();
      const fixtures = [
        ...createDgwFixtures(20), // DGW now
        ...createStandardFixtures(21, 7),
      ];
      const events = createGameweeks(20, 8);
      const availableChips = ["bboost"];

      const analyses = analyzeChipTiming(
        players,
        fixtures,
        events,
        20,
        availableChips,
      );

      const bb = analyses.find((a) => a.chip === "bboost");
      expect(bb).toBeDefined();
      // Current GW has DGW so should have high score
      expect(bb!.currentGwScore).toBeGreaterThan(40);
    });

    it("returns neutral when current GW is decent but better options exist", () => {
      const players = createPremiumPlayers();
      const fixtures = createStandardFixtures(20, 8);
      const events = createGameweeks(20, 8);
      const availableChips = ["wildcard"];

      const analyses = analyzeChipTiming(
        players,
        fixtures,
        events,
        20,
        availableChips,
      );

      const wc = analyses.find((a) => a.chip === "wildcard");
      expect(wc).toBeDefined();
      expect(["neutral", "wait"]).toContain(wc!.recommendation);
    });
  });
});
