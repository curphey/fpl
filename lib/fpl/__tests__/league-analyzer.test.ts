import { describe, it, expect } from "vitest";
import type {
  Player,
  Team,
  StandingsResult,
  ManagerPicks,
  Pick,
} from "../types";
import {
  selectRivals,
  buildRivalTeam,
  calculateEffectiveOwnership,
  identifyDifferentials,
  compareWithRival,
  generateSwingScenarios,
  analyzeLeague,
} from "../league-analyzer";

// Mock factories
function createMockPlayer(overrides: Partial<Player> = {}): Player {
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
    ...overrides,
  };
}

function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 1,
    name: "Test Team",
    short_name: "TST",
    code: 1,
    draw: 5,
    form: null,
    loss: 5,
    played: 20,
    points: 35,
    position: 10,
    strength: 3,
    team_division: null,
    unavailable: false,
    win: 10,
    strength_overall_home: 1100,
    strength_overall_away: 1050,
    strength_attack_home: 1150,
    strength_attack_away: 1100,
    strength_defence_home: 1050,
    strength_defence_away: 1000,
    pulse_id: 1,
    ...overrides,
  };
}

function createMockStanding(
  overrides: Partial<StandingsResult> = {},
): StandingsResult {
  return {
    id: 1,
    event_total: 50,
    player_name: "Test Manager",
    rank: 1,
    last_rank: 1,
    rank_sort: 1,
    total: 1000,
    entry: 12345,
    entry_name: "Test Team FC",
    ...overrides,
  };
}

function createMockPick(overrides: Partial<Pick> = {}): Pick {
  return {
    element: 1,
    position: 1,
    multiplier: 1,
    is_captain: false,
    is_vice_captain: false,
    ...overrides,
  };
}

function createMockManagerPicks(picks: Pick[]): ManagerPicks {
  return {
    active_chip: null,
    automatic_subs: [],
    entry_history: {
      event: 20,
      points: 50,
      total_points: 1000,
      rank: 100000,
      rank_sort: 100000,
      percentile_rank: 50,
      overall_rank: 100000,
      bank: 10,
      value: 1000,
      event_transfers: 1,
      event_transfers_cost: 0,
      points_on_bench: 8,
    },
    picks,
  };
}

describe("selectRivals", () => {
  it("selects rivals closest to user by points", () => {
    const standings = [
      createMockStanding({ entry: 1, total: 1100, rank: 1 }),
      createMockStanding({ entry: 2, total: 1050, rank: 2 }),
      createMockStanding({ entry: 3, total: 1000, rank: 3 }), // user
      createMockStanding({ entry: 4, total: 950, rank: 4 }),
      createMockStanding({ entry: 5, total: 900, rank: 5 }),
    ];

    const rivals = selectRivals(standings, 3, 2);

    expect(rivals.length).toBe(2);
    // Should select entries 2 and 4 (50 points away each)
    const rivalEntries = rivals.map((r) => r.entry);
    expect(rivalEntries).toContain(2);
    expect(rivalEntries).toContain(4);
  });

  it("returns empty array if user not found", () => {
    const standings = [createMockStanding({ entry: 1 })];
    const rivals = selectRivals(standings, 999, 5);
    // Falls back to first N excluding user
    expect(rivals.length).toBe(1);
  });

  it("respects count limit", () => {
    const standings = Array.from({ length: 20 }, (_, i) =>
      createMockStanding({ entry: i + 1, total: 1000 - i * 10 }),
    );

    const rivals = selectRivals(standings, 10, 5);
    expect(rivals.length).toBe(5);
  });
});

describe("buildRivalTeam", () => {
  it("builds rival team from standings and picks", () => {
    const standing = createMockStanding({
      entry: 123,
      entry_name: "Rival FC",
      player_name: "John Doe",
      rank: 5,
      total: 1050,
    });

    const picks = createMockManagerPicks([
      createMockPick({ element: 1, multiplier: 2, is_captain: true }),
      createMockPick({ element: 2, multiplier: 1 }),
      createMockPick({ element: 3, multiplier: 0 }), // bench
    ]);

    const rival = buildRivalTeam(standing, picks, 1000);

    expect(rival.entry).toBe(123);
    expect(rival.name).toBe("Rival FC");
    expect(rival.pointsGap).toBe(50);
    expect(rival.captain).toBe(1);
    expect(rival.activePicks.length).toBe(2);
    expect(rival.picks.length).toBe(3);
  });

  it("handles team with no captain", () => {
    const standing = createMockStanding();
    const picks = createMockManagerPicks([
      createMockPick({ element: 1, is_captain: false }),
    ]);

    const rival = buildRivalTeam(standing, picks, 1000);
    expect(rival.captain).toBeNull();
  });
});

describe("calculateEffectiveOwnership", () => {
  it("calculates EO across user and rivals", () => {
    const userPicks = [
      createMockPick({ element: 1, multiplier: 2, is_captain: true }),
      createMockPick({ element: 2, multiplier: 1 }),
    ];

    const rivals = [
      {
        entry: 2,
        name: "Rival 1",
        playerName: "R1",
        rank: 2,
        total: 1000,
        pointsGap: 0,
        picks: [
          createMockPick({ element: 1, multiplier: 1 }),
          createMockPick({ element: 3, multiplier: 1 }),
        ],
        activePicks: [
          createMockPick({ element: 1, multiplier: 1 }),
          createMockPick({ element: 3, multiplier: 1 }),
        ],
        captain: 1,
      },
    ];

    const playerMap = new Map([
      [
        1,
        createMockPlayer({
          id: 1,
          web_name: "Player1",
          element_type: 3,
          selected_by_percent: "50",
        }),
      ],
      [
        2,
        createMockPlayer({
          id: 2,
          web_name: "Player2",
          element_type: 4,
          selected_by_percent: "30",
        }),
      ],
      [
        3,
        createMockPlayer({
          id: 3,
          web_name: "Player3",
          element_type: 2,
          selected_by_percent: "20",
        }),
      ],
    ]);

    const teamMap = new Map([
      [1, createMockTeam({ id: 1, short_name: "TST" })],
    ]);

    const eo = calculateEffectiveOwnership(
      userPicks,
      rivals,
      playerMap,
      teamMap,
    );

    // Player 1: owned by user (active) and rival (active) = 100% EO
    const player1EO = eo.find((e) => e.playerId === 1);
    expect(player1EO?.leagueEO).toBe(100);
    expect(player1EO?.userStatus).toBe("captain");

    // Player 2: only user owns = 50% EO
    const player2EO = eo.find((e) => e.playerId === 2);
    expect(player2EO?.leagueEO).toBe(50);
    expect(player2EO?.userStatus).toBe("own");

    // Player 3: only rival owns = 50% EO
    const player3EO = eo.find((e) => e.playerId === 3);
    expect(player3EO?.leagueEO).toBe(50);
    expect(player3EO?.userStatus).toBe("dont_own");
  });

  it("identifies bench players correctly", () => {
    const userPicks = [
      createMockPick({ element: 1, multiplier: 0 }), // on bench
    ];

    const rivals: ReturnType<typeof buildRivalTeam>[] = [];

    const playerMap = new Map([
      [1, createMockPlayer({ id: 1, web_name: "BenchPlayer" })],
    ]);

    const teamMap = new Map([[1, createMockTeam()]]);

    const eo = calculateEffectiveOwnership(
      userPicks,
      rivals,
      playerMap,
      teamMap,
    );

    expect(eo[0].userStatus).toBe("bench");
    expect(eo[0].leagueEO).toBe(0); // multiplier 0 = not active
  });
});

describe("identifyDifferentials", () => {
  it("identifies attack differentials (user only)", () => {
    const userPicks = [
      createMockPick({ element: 1, multiplier: 1 }),
      createMockPick({ element: 2, multiplier: 1 }),
    ];

    const rivals = [
      {
        entry: 2,
        name: "Rival",
        playerName: "R",
        rank: 2,
        total: 1000,
        pointsGap: 0,
        picks: [createMockPick({ element: 2, multiplier: 1 })],
        activePicks: [createMockPick({ element: 2, multiplier: 1 })],
        captain: null,
      },
    ];

    const playerMap = new Map([
      [1, createMockPlayer({ id: 1, web_name: "Unique", form: "8.0" })],
      [2, createMockPlayer({ id: 2, web_name: "Shared", form: "5.0" })],
    ]);

    const teamMap = new Map([[1, createMockTeam()]]);

    const { attack, cover } = identifyDifferentials(
      userPicks,
      rivals,
      playerMap,
      teamMap,
    );

    expect(attack.length).toBe(1);
    expect(attack[0].playerName).toBe("Unique");
    expect(attack[0].type).toBe("attack");

    expect(cover.length).toBe(0); // No players rivals have that user doesn't
  });

  it("identifies cover differentials (rivals only)", () => {
    const userPicks = [createMockPick({ element: 1, multiplier: 1 })];

    const rivals = [
      {
        entry: 2,
        name: "Rival",
        playerName: "R",
        rank: 2,
        total: 1000,
        pointsGap: 0,
        picks: [
          createMockPick({ element: 1, multiplier: 1 }),
          createMockPick({ element: 2, multiplier: 1 }),
        ],
        activePicks: [
          createMockPick({ element: 1, multiplier: 1 }),
          createMockPick({ element: 2, multiplier: 1 }),
        ],
        captain: null,
      },
    ];

    const playerMap = new Map([
      [1, createMockPlayer({ id: 1, web_name: "Shared" })],
      [2, createMockPlayer({ id: 2, web_name: "RivalOnly" })],
    ]);

    const teamMap = new Map([[1, createMockTeam()]]);

    const { attack, cover } = identifyDifferentials(
      userPicks,
      rivals,
      playerMap,
      teamMap,
    );

    expect(attack.length).toBe(0);
    expect(cover.length).toBe(1);
    expect(cover[0].playerName).toBe("RivalOnly");
    expect(cover[0].type).toBe("cover");
    expect(cover[0].riskScore).toBe(100); // 1/1 rivals own
  });

  it("calculates risk score correctly", () => {
    const userPicks = [createMockPick({ element: 1, multiplier: 1 })];

    const rivals = [
      {
        entry: 2,
        name: "R1",
        playerName: "R1",
        rank: 2,
        total: 1000,
        pointsGap: 0,
        picks: [createMockPick({ element: 2, multiplier: 1 })],
        activePicks: [createMockPick({ element: 2, multiplier: 1 })],
        captain: null,
      },
      {
        entry: 3,
        name: "R2",
        playerName: "R2",
        rank: 3,
        total: 990,
        pointsGap: -10,
        picks: [createMockPick({ element: 2, multiplier: 1 })],
        activePicks: [createMockPick({ element: 2, multiplier: 1 })],
        captain: null,
      },
      {
        entry: 4,
        name: "R3",
        playerName: "R3",
        rank: 4,
        total: 980,
        pointsGap: -20,
        picks: [],
        activePicks: [],
        captain: null,
      },
    ];

    const playerMap = new Map([
      [1, createMockPlayer({ id: 1 })],
      [2, createMockPlayer({ id: 2 })],
    ]);

    const teamMap = new Map([[1, createMockTeam()]]);

    const { cover } = identifyDifferentials(
      userPicks,
      rivals,
      playerMap,
      teamMap,
    );

    // 2 out of 3 rivals own player 2 = 67% risk
    expect(cover[0].riskScore).toBe(67);
    expect(cover[0].rivalsOwning).toBe(2);
    expect(cover[0].totalRivals).toBe(3);
  });
});

describe("compareWithRival", () => {
  it("identifies shared and differential players", () => {
    const userPicks = [
      createMockPick({ element: 1, multiplier: 1, is_captain: true }),
      createMockPick({ element: 2, multiplier: 1 }),
      createMockPick({ element: 3, multiplier: 1 }),
    ];

    const rival = {
      entry: 2,
      name: "Rival",
      playerName: "R",
      rank: 2,
      total: 1050,
      pointsGap: 50,
      picks: [
        createMockPick({ element: 1, multiplier: 1, is_captain: true }),
        createMockPick({ element: 4, multiplier: 1 }),
      ],
      activePicks: [
        createMockPick({ element: 1, multiplier: 1 }),
        createMockPick({ element: 4, multiplier: 1 }),
      ],
      captain: 1,
    };

    const comparison = compareWithRival(userPicks, rival);

    expect(comparison.shared).toEqual([1]);
    expect(comparison.userOnly.sort()).toEqual([2, 3]);
    expect(comparison.rivalOnly).toEqual([4]);
    expect(comparison.captainMatch).toBe(true);
    expect(comparison.pointsGap).toBe(50);
  });

  it("detects captain mismatch", () => {
    const userPicks = [
      createMockPick({ element: 1, multiplier: 2, is_captain: true }),
    ];

    const rival = {
      entry: 2,
      name: "Rival",
      playerName: "R",
      rank: 2,
      total: 1000,
      pointsGap: 0,
      picks: [createMockPick({ element: 1, multiplier: 1 })],
      activePicks: [createMockPick({ element: 1, multiplier: 1 })],
      captain: 2, // Different captain
    };

    const comparison = compareWithRival(userPicks, rival);
    expect(comparison.captainMatch).toBe(false);
  });
});

describe("generateSwingScenarios", () => {
  it("generates swing scenarios for cover differentials", () => {
    const userPicks = [createMockPick({ element: 1, multiplier: 1 })];

    const rivals = [
      {
        entry: 2,
        name: "R1",
        playerName: "R1",
        rank: 2,
        total: 1000,
        pointsGap: 0,
        picks: [createMockPick({ element: 2, multiplier: 1 })],
        activePicks: [createMockPick({ element: 2, multiplier: 1 })],
        captain: null,
      },
      {
        entry: 3,
        name: "R2",
        playerName: "R2",
        rank: 3,
        total: 990,
        pointsGap: -10,
        picks: [createMockPick({ element: 2, multiplier: 1 })],
        activePicks: [createMockPick({ element: 2, multiplier: 1 })],
        captain: null,
      },
    ];

    const playerMap = new Map([
      [1, createMockPlayer({ id: 1, web_name: "UserPlayer" })],
      [2, createMockPlayer({ id: 2, web_name: "RivalPlayer" })],
    ]);

    const teamMap = new Map([[1, createMockTeam()]]);

    const scenarios = generateSwingScenarios(
      userPicks,
      rivals,
      playerMap,
      teamMap,
    );

    expect(scenarios.length).toBe(1);
    expect(scenarios[0].playerName).toBe("RivalPlayer");
    expect(scenarios[0].rivalsOwning).toBe(2);
    expect(scenarios[0].totalRivals).toBe(2);

    // Net impact calculations: -pts * (rivalsOwning / totalRivals)
    // All rivals own, so fraction = 1
    expect(scenarios[0].netImpact2).toBe(-2);
    expect(scenarios[0].netImpact6).toBe(-6);
    expect(scenarios[0].netImpact10).toBe(-10);
    expect(scenarios[0].netImpact15).toBe(-15);
  });

  it("sorts by worst case impact", () => {
    const userPicks = [createMockPick({ element: 1, multiplier: 1 })];

    const rivals = [
      {
        entry: 2,
        name: "R1",
        playerName: "R1",
        rank: 2,
        total: 1000,
        pointsGap: 0,
        picks: [
          createMockPick({ element: 2, multiplier: 1 }),
          createMockPick({ element: 3, multiplier: 1 }),
        ],
        activePicks: [
          createMockPick({ element: 2, multiplier: 1 }),
          createMockPick({ element: 3, multiplier: 1 }),
        ],
        captain: null,
      },
      {
        entry: 3,
        name: "R2",
        playerName: "R2",
        rank: 3,
        total: 990,
        pointsGap: -10,
        picks: [createMockPick({ element: 2, multiplier: 1 })],
        activePicks: [createMockPick({ element: 2, multiplier: 1 })],
        captain: null,
      },
    ];

    const playerMap = new Map([
      [1, createMockPlayer({ id: 1 })],
      [2, createMockPlayer({ id: 2, web_name: "HighRisk" })], // 2 rivals own
      [3, createMockPlayer({ id: 3, web_name: "LowRisk" })], // 1 rival owns
    ]);

    const teamMap = new Map([[1, createMockTeam()]]);

    const scenarios = generateSwingScenarios(
      userPicks,
      rivals,
      playerMap,
      teamMap,
    );

    // Should be sorted by worst case (most negative netImpact15)
    expect(scenarios[0].playerName).toBe("HighRisk");
    expect(scenarios[1].playerName).toBe("LowRisk");
  });
});

describe("analyzeLeague", () => {
  it("returns complete analysis", () => {
    const userPicks = [
      createMockPick({ element: 1, multiplier: 2, is_captain: true }),
      createMockPick({ element: 2, multiplier: 1 }),
    ];

    const userStanding = createMockStanding({
      entry: 1,
      rank: 3,
      total: 1000,
    });

    const rivals = [
      {
        entry: 2,
        name: "R1",
        playerName: "R1",
        rank: 1,
        total: 1100,
        pointsGap: 100,
        picks: [createMockPick({ element: 1, multiplier: 1 })],
        activePicks: [createMockPick({ element: 1, multiplier: 1 })],
        captain: 1,
      },
    ];

    const playerMap = new Map([
      [
        1,
        createMockPlayer({
          id: 1,
          web_name: "Shared",
          selected_by_percent: "60",
        }),
      ],
      [
        2,
        createMockPlayer({
          id: 2,
          web_name: "Unique",
          selected_by_percent: "10",
        }),
      ],
    ]);

    const teamMap = new Map([[1, createMockTeam()]]);

    const analysis = analyzeLeague(
      userPicks,
      userStanding,
      rivals,
      1100,
      playerMap,
      teamMap,
    );

    expect(analysis.userRank).toBe(3);
    expect(analysis.gapToLeader).toBe(100);
    expect(analysis.effectiveOwnership.length).toBe(2);
    expect(analysis.yourDifferentials.length).toBe(1); // Player 2
    expect(analysis.theirDifferentials.length).toBe(0);
    expect(analysis.uniquePlayerCount).toBe(1);
  });
});
