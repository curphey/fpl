import { describe, it, expect } from "vitest";
import type { EnrichedPlayer } from "../utils";
import type { DraftPlayer, DraftState, DraftSettings } from "../draft-types";
import {
  calculateEstimatedADP,
  getSnakeDraftSuggestions,
  getAuctionBidSuggestion,
  analyzeKeeperValue,
  analyzeKeeperOptions,
  createInitialDraftState,
  initializeDraftBoard,
  markUserPicks,
  getUserPickInRound,
  getManagerForPick,
  isUserTurn,
  makeDraftPick,
  getAvailablePlayers,
  getAuctionValueTargets,
  ADP_TIER_BOUNDARIES,
} from "../draft-model";

function createMockEnrichedPlayer(
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
    expected_goal_involvements: "8.0",
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
    event_points: 0,
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
    expected_goals_conceded: "0",
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
  };
}

function createMockDraftPlayer(
  overrides: Partial<DraftPlayer> = {},
): DraftPlayer {
  return {
    id: 1,
    name: "T.Player",
    fullName: "Test Player",
    team: "Test Team",
    teamShort: "TST",
    positionId: 3,
    position: "MID",
    price: 10.0,
    totalPoints: 100,
    form: 5.0,
    ownership: 20.0,
    xgi: 8.0,
    minutes: 900,
    status: "a",
    estimatedADP: 50,
    adpTier: "mid",
    valueVsADP: 5,
    positionScarcity: 0.6,
    keeperValue: 50,
    suggestedBidPercent: 5,
    ...overrides,
  };
}

function createMockDraftState(overrides: Partial<DraftState> = {}): DraftState {
  return {
    mode: "snake",
    totalManagers: 10,
    userPosition: 1,
    currentRound: 1,
    currentPick: 1,
    draftedPlayers: new Set(),
    userRoster: [
      { position: "GK", playerId: null, player: null },
      { position: "GK", playerId: null, player: null },
      { position: "DEF", playerId: null, player: null },
      { position: "DEF", playerId: null, player: null },
      { position: "DEF", playerId: null, player: null },
      { position: "DEF", playerId: null, player: null },
      { position: "DEF", playerId: null, player: null },
      { position: "MID", playerId: null, player: null },
      { position: "MID", playerId: null, player: null },
      { position: "MID", playerId: null, player: null },
      { position: "MID", playerId: null, player: null },
      { position: "MID", playerId: null, player: null },
      { position: "FWD", playerId: null, player: null },
      { position: "FWD", playerId: null, player: null },
      { position: "FWD", playerId: null, player: null },
    ],
    isComplete: false,
    ...overrides,
  };
}

// =============================================================================
// ADP Calculation Tests
// =============================================================================

describe("calculateEstimatedADP", () => {
  it("returns empty array for empty input", () => {
    const result = calculateEstimatedADP([]);
    expect(result).toEqual([]);
  });

  it("filters out unavailable players", () => {
    const players = [
      createMockEnrichedPlayer({ id: 1, status: "a", minutes: 900 }),
      createMockEnrichedPlayer({ id: 2, status: "i", minutes: 900 }), // Injured
    ];

    const result = calculateEstimatedADP(players);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });

  it("filters out players with insufficient minutes", () => {
    const players = [
      createMockEnrichedPlayer({ id: 1, minutes: 900 }),
      createMockEnrichedPlayer({ id: 2, minutes: 45 }), // Less than 90
    ];

    const result = calculateEstimatedADP(players);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });

  it("assigns ADP based on weighted score", () => {
    const players = [
      createMockEnrichedPlayer({
        id: 1,
        ownership_value: 10,
        total_points: 50,
        form_value: 3.0,
        xgi_value: 3.0,
      }),
      createMockEnrichedPlayer({
        id: 2,
        ownership_value: 50,
        total_points: 150,
        form_value: 8.0,
        xgi_value: 12.0,
      }),
    ];

    const result = calculateEstimatedADP(players);

    // Player 2 should have lower ADP (drafted earlier) due to better stats
    const player1 = result.find((p) => p.id === 1);
    const player2 = result.find((p) => p.id === 2);

    expect(player2?.estimatedADP).toBeLessThan(player1?.estimatedADP ?? 999);
  });

  it("assigns correct ADP tiers", () => {
    // Create enough players to test tier boundaries
    const players = Array.from({ length: 200 }, (_, i) =>
      createMockEnrichedPlayer({
        id: i + 1,
        ownership_value: 100 - i * 0.5, // Decreasing ownership
        total_points: 200 - i,
        form_value: Math.max(1, 8 - i * 0.04),
        xgi_value: Math.max(0.5, 15 - i * 0.07),
      }),
    );

    const result = calculateEstimatedADP(players);

    // Check tier assignments match boundaries
    const elitePlayers = result.filter((p) => p.adpTier === "elite");
    const premiumPlayers = result.filter((p) => p.adpTier === "premium");

    expect(elitePlayers.length).toBe(ADP_TIER_BOUNDARIES.ELITE);
    expect(premiumPlayers.length).toBe(
      ADP_TIER_BOUNDARIES.PREMIUM - ADP_TIER_BOUNDARIES.ELITE,
    );
  });

  it("includes position adjustment in ADP", () => {
    const players = [
      createMockEnrichedPlayer({
        id: 1,
        element_type: 4, // FWD - should be drafted earlier
        position_short: "FWD",
        ownership_value: 20,
        total_points: 100,
        form_value: 5.0,
        xgi_value: 8.0,
      }),
      createMockEnrichedPlayer({
        id: 2,
        element_type: 1, // GK - should be drafted later
        position_short: "GK",
        ownership_value: 20,
        total_points: 100,
        form_value: 5.0,
        xgi_value: 8.0,
      }),
    ];

    const result = calculateEstimatedADP(players);
    const fwd = result.find((p) => p.id === 1);
    const gk = result.find((p) => p.id === 2);

    // FWD should have lower ADP (drafted earlier) than GK
    expect(fwd?.estimatedADP).toBeLessThan(gk?.estimatedADP ?? 999);
  });

  it("calculates valueVsADP correctly", () => {
    const players = [
      createMockEnrichedPlayer({
        id: 1,
        ownership_value: 50, // High ownership should make expected rank higher
        total_points: 100,
        form_value: 5.0,
        xgi_value: 8.0,
      }),
    ];

    const result = calculateEstimatedADP(players);
    expect(result[0]).toHaveProperty("valueVsADP");
    expect(typeof result[0].valueVsADP).toBe("number");
  });
});

// =============================================================================
// Snake Draft Suggestions Tests
// =============================================================================

describe("getSnakeDraftSuggestions", () => {
  it("returns empty array for no available players", () => {
    const state = createMockDraftState();
    const result = getSnakeDraftSuggestions([], state);
    expect(result).toEqual([]);
  });

  it("returns requested number of suggestions", () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      createMockDraftPlayer({ id: i + 1, estimatedADP: i + 1 }),
    );
    const state = createMockDraftState();

    const result = getSnakeDraftSuggestions(players, state, 5);
    expect(result.length).toBe(5);
  });

  it("ranks suggestions by combined score", () => {
    const players = [
      createMockDraftPlayer({
        id: 1,
        estimatedADP: 1,
        position: "MID",
        positionScarcity: 0.6,
        valueVsADP: 5,
      }),
      createMockDraftPlayer({
        id: 2,
        estimatedADP: 50,
        position: "MID",
        positionScarcity: 0.6,
        valueVsADP: -5,
      }),
    ];
    const state = createMockDraftState();

    const result = getSnakeDraftSuggestions(players, state, 2);

    // Player with better ADP should rank higher
    expect(result[0].player.id).toBe(1);
    expect(result[0].valueScore).toBeGreaterThan(result[1].valueScore);
  });

  it("includes positional need in ranking", () => {
    const players = [
      createMockDraftPlayer({
        id: 1,
        position: "GK",
        positionId: 1,
        estimatedADP: 100,
      }),
      createMockDraftPlayer({
        id: 2,
        position: "FWD",
        positionId: 4,
        estimatedADP: 100,
      }),
    ];

    // State with all GK slots filled but no FWD
    const roster = createMockDraftState().userRoster.map((slot) =>
      slot.position === "GK"
        ? { ...slot, playerId: 999, player: createMockDraftPlayer() }
        : slot,
    );

    const state = createMockDraftState({ userRoster: roster });

    const result = getSnakeDraftSuggestions(players, state, 2);

    // FWD should be ranked higher due to positional need
    const fwdSuggestion = result.find((s) => s.player.position === "FWD");
    const gkSuggestion = result.find((s) => s.player.position === "GK");

    expect(fwdSuggestion?.positionalNeed).toBe("critical");
    expect(gkSuggestion?.positionalNeed).toBe("low");
  });

  it("includes value indicators", () => {
    const players = [
      createMockDraftPlayer({ id: 1, valueVsADP: 15 }), // Value pick
      createMockDraftPlayer({ id: 2, valueVsADP: -15 }), // Reach
    ];
    const state = createMockDraftState();

    const result = getSnakeDraftSuggestions(players, state, 2);

    const valuePick = result.find((s) => s.player.id === 1);
    const reachPick = result.find((s) => s.player.id === 2);

    expect(valuePick?.isValue).toBe(true);
    expect(reachPick?.isReach).toBe(true);
  });

  it("includes reasoning for picks", () => {
    const players = [createMockDraftPlayer()];
    const state = createMockDraftState();

    const result = getSnakeDraftSuggestions(players, state, 1);

    expect(result[0].reasoning).toBeTruthy();
    expect(typeof result[0].reasoning).toBe("string");
  });
});

// =============================================================================
// Auction Bid Suggestion Tests
// =============================================================================

describe("getAuctionBidSuggestion", () => {
  it("returns bid suggestion with min/recommended/max", () => {
    const player = createMockDraftPlayer({ suggestedBidPercent: 10 });
    const state = createMockDraftState({
      mode: "auction",
      budgetRemaining: 200,
      initialBudget: 200,
    });

    const result = getAuctionBidSuggestion(player, state, [player]);

    expect(result.minBid).toBeGreaterThan(0);
    expect(result.recommendedBid).toBeGreaterThanOrEqual(result.minBid);
    expect(result.maxBid).toBeGreaterThanOrEqual(result.recommendedBid);
  });

  it("adjusts bids based on positional need", () => {
    const player = createMockDraftPlayer({ position: "FWD", positionId: 4 });

    const baseState = createMockDraftState({
      mode: "auction",
      budgetRemaining: 200,
      initialBudget: 200,
    });

    // State with FWD need
    const result1 = getAuctionBidSuggestion(player, baseState, [player]);

    // State with all FWD slots filled
    const filledRoster = baseState.userRoster.map((slot) =>
      slot.position === "FWD"
        ? { ...slot, playerId: 999, player: createMockDraftPlayer() }
        : slot,
    );
    const filledState = { ...baseState, userRoster: filledRoster };
    const result2 = getAuctionBidSuggestion(player, filledState, [player]);

    // Bid should be higher when position is needed
    expect(result1.recommendedBid).toBeGreaterThanOrEqual(
      result2.recommendedBid,
    );
  });

  it("respects budget constraints", () => {
    const player = createMockDraftPlayer({ suggestedBidPercent: 50 });
    const state = createMockDraftState({
      mode: "auction",
      budgetRemaining: 20,
      initialBudget: 200,
    });

    const result = getAuctionBidSuggestion(player, state, [player]);

    expect(result.maxBid).toBeLessThanOrEqual(state.budgetRemaining!);
  });

  it("includes reasoning", () => {
    const player = createMockDraftPlayer();
    const state = createMockDraftState({
      mode: "auction",
      budgetRemaining: 200,
    });

    const result = getAuctionBidSuggestion(player, state, [player]);

    expect(result.reasoning).toBeTruthy();
  });

  it("indicates shouldPursue for critical needs", () => {
    const player = createMockDraftPlayer({ position: "FWD", positionId: 4 });
    const state = createMockDraftState({
      mode: "auction",
      budgetRemaining: 200,
    });

    const result = getAuctionBidSuggestion(player, state, [player]);

    expect(result.positionalNeed).toBe("critical");
    expect(result.shouldPursue).toBe(true);
  });
});

describe("getAuctionValueTargets", () => {
  it("returns players with positive valueVsADP for needed positions", () => {
    const players = [
      createMockDraftPlayer({ id: 1, position: "MID", valueVsADP: 10 }),
      createMockDraftPlayer({ id: 2, position: "MID", valueVsADP: -5 }),
      createMockDraftPlayer({
        id: 3,
        position: "FWD",
        positionId: 4,
        valueVsADP: 15,
      }),
    ];
    const state = createMockDraftState();

    const result = getAuctionValueTargets(players, state, 5);

    // Should only include players with positive value for needed positions
    expect(result.every((p) => p.valueVsADP > 0)).toBe(true);
  });

  it("sorts by valueVsADP descending", () => {
    const players = [
      createMockDraftPlayer({ id: 1, position: "MID", valueVsADP: 5 }),
      createMockDraftPlayer({ id: 2, position: "MID", valueVsADP: 15 }),
      createMockDraftPlayer({ id: 3, position: "MID", valueVsADP: 10 }),
    ];
    const state = createMockDraftState();

    const result = getAuctionValueTargets(players, state, 3);

    expect(result[0].valueVsADP).toBeGreaterThanOrEqual(result[1].valueVsADP);
    expect(result[1].valueVsADP).toBeGreaterThanOrEqual(result[2].valueVsADP);
  });
});

// =============================================================================
// Keeper Analysis Tests
// =============================================================================

describe("analyzeKeeperValue", () => {
  it("returns keeper analysis with score and recommendation", () => {
    const player = createMockDraftPlayer({
      totalPoints: 150,
      form: 7.0,
      xgi: 12.0,
      minutes: 2500,
    });

    const result = analyzeKeeperValue(player);

    expect(result.keeperScore).toBeGreaterThanOrEqual(0);
    expect(result.keeperScore).toBeLessThanOrEqual(100);
    expect(["must-keep", "keep", "consider", "drop"]).toContain(
      result.recommendation,
    );
    expect(result.reasoning).toBeTruthy();
  });

  it("includes factor breakdown", () => {
    const player = createMockDraftPlayer();
    const result = analyzeKeeperValue(player);

    expect(result.factors).toHaveProperty("consistency");
    expect(result.factors).toHaveProperty("upside");
    expect(result.factors).toHaveProperty("positionValue");
    expect(result.factors).toHaveProperty("trajectory");
  });

  it("assigns higher score to FWD position", () => {
    const fwd = createMockDraftPlayer({
      id: 1,
      position: "FWD",
      positionId: 4,
      totalPoints: 100,
      form: 5.0,
    });
    const gk = createMockDraftPlayer({
      id: 2,
      position: "GK",
      positionId: 1,
      totalPoints: 100,
      form: 5.0,
    });

    const fwdResult = analyzeKeeperValue(fwd);
    const gkResult = analyzeKeeperValue(gk);

    expect(fwdResult.factors.positionValue).toBeGreaterThan(
      gkResult.factors.positionValue,
    );
  });

  it("assigns must-keep for high scores", () => {
    const elitePlayer = createMockDraftPlayer({
      totalPoints: 200,
      form: 8.0,
      xgi: 15.0,
      minutes: 2800,
      position: "FWD",
      positionId: 4,
    });

    const result = analyzeKeeperValue(elitePlayer);

    expect(result.keeperScore).toBeGreaterThanOrEqual(75);
    expect(result.recommendation).toBe("must-keep");
  });
});

describe("analyzeKeeperOptions", () => {
  it("returns sorted array by keeper score", () => {
    const players = [
      createMockDraftPlayer({ id: 1, totalPoints: 50, form: 3.0 }),
      createMockDraftPlayer({ id: 2, totalPoints: 150, form: 8.0 }),
      createMockDraftPlayer({ id: 3, totalPoints: 100, form: 5.0 }),
    ];

    const result = analyzeKeeperOptions(players);

    expect(result[0].keeperScore).toBeGreaterThanOrEqual(result[1].keeperScore);
    expect(result[1].keeperScore).toBeGreaterThanOrEqual(result[2].keeperScore);
  });
});

// =============================================================================
// Draft State Management Tests
// =============================================================================

describe("createInitialDraftState", () => {
  it("creates snake draft state correctly", () => {
    const settings: DraftSettings = {
      mode: "snake",
      leagueSize: 10,
      userDraftPosition: 5,
    };

    const result = createInitialDraftState(settings);

    expect(result.mode).toBe("snake");
    expect(result.totalManagers).toBe(10);
    expect(result.userPosition).toBe(5);
    expect(result.currentRound).toBe(1);
    expect(result.currentPick).toBe(1);
    expect(result.draftedPlayers.size).toBe(0);
    expect(result.userRoster.length).toBe(15);
    expect(result.isComplete).toBe(false);
    expect(result.budgetRemaining).toBeUndefined();
  });

  it("creates auction draft state with budget", () => {
    const settings: DraftSettings = {
      mode: "auction",
      leagueSize: 8,
      userDraftPosition: 1,
      auctionBudget: 250,
    };

    const result = createInitialDraftState(settings);

    expect(result.mode).toBe("auction");
    expect(result.budgetRemaining).toBe(250);
    expect(result.initialBudget).toBe(250);
  });

  it("creates correct roster slots", () => {
    const settings: DraftSettings = {
      mode: "snake",
      leagueSize: 10,
      userDraftPosition: 1,
    };

    const result = createInitialDraftState(settings);

    const gkSlots = result.userRoster.filter((s) => s.position === "GK");
    const defSlots = result.userRoster.filter((s) => s.position === "DEF");
    const midSlots = result.userRoster.filter((s) => s.position === "MID");
    const fwdSlots = result.userRoster.filter((s) => s.position === "FWD");

    expect(gkSlots.length).toBe(2);
    expect(defSlots.length).toBe(5);
    expect(midSlots.length).toBe(5);
    expect(fwdSlots.length).toBe(3);
  });
});

describe("isUserTurn", () => {
  it("returns true for snake draft when user's pick", () => {
    const state = createMockDraftState({
      currentPick: 1,
      userPosition: 1,
      totalManagers: 10,
    });

    expect(isUserTurn(state)).toBe(true);
  });

  it("returns false for snake draft when not user's pick", () => {
    const state = createMockDraftState({
      currentPick: 2,
      userPosition: 1,
      totalManagers: 10,
    });

    expect(isUserTurn(state)).toBe(false);
  });

  it("returns true for auction mode always", () => {
    const state = createMockDraftState({
      mode: "auction",
      currentPick: 50,
      userPosition: 1,
    });

    expect(isUserTurn(state)).toBe(true);
  });
});

describe("makeDraftPick", () => {
  it("adds player to drafted set", () => {
    const state = createMockDraftState();
    const player = createMockDraftPlayer({ id: 123, position: "MID" });

    const result = makeDraftPick(state, player);

    expect(result.draftedPlayers.has(123)).toBe(true);
  });

  it("adds player to roster slot", () => {
    const state = createMockDraftState();
    const player = createMockDraftPlayer({ id: 123, position: "MID" });

    const result = makeDraftPick(state, player);

    const filledSlot = result.userRoster.find(
      (s) => s.position === "MID" && s.playerId === 123,
    );
    expect(filledSlot).toBeDefined();
    expect(filledSlot?.player?.id).toBe(123);
  });

  it("increments pick number and round", () => {
    const state = createMockDraftState({
      currentPick: 10,
      currentRound: 1,
      totalManagers: 10,
    });
    const player = createMockDraftPlayer();

    const result = makeDraftPick(state, player);

    expect(result.currentPick).toBe(11);
    expect(result.currentRound).toBe(2);
  });

  it("deducts budget in auction mode", () => {
    const state = createMockDraftState({
      mode: "auction",
      budgetRemaining: 200,
    });
    const player = createMockDraftPlayer({ position: "MID" });

    const result = makeDraftPick(state, player, 25);

    expect(result.budgetRemaining).toBe(175);
  });

  it("marks draft as complete when all picks made", () => {
    const state = createMockDraftState({
      currentPick: 150, // Last pick in 10-manager draft
      totalManagers: 10,
    });
    const player = createMockDraftPlayer({ position: "MID" });

    const result = makeDraftPick(state, player);

    expect(result.isComplete).toBe(true);
  });
});

describe("getAvailablePlayers", () => {
  it("filters out drafted players", () => {
    const players = [
      createMockDraftPlayer({ id: 1 }),
      createMockDraftPlayer({ id: 2 }),
      createMockDraftPlayer({ id: 3 }),
    ];
    const draftedIds = new Set([2]);

    const result = getAvailablePlayers(players, draftedIds);

    expect(result.length).toBe(2);
    expect(result.map((p) => p.id)).toEqual([1, 3]);
  });
});

// =============================================================================
// Draft Board Tests
// =============================================================================

describe("initializeDraftBoard", () => {
  it("creates board with correct dimensions", () => {
    const board = initializeDraftBoard(10, 15);

    expect(board.totalRounds).toBe(15);
    expect(board.totalManagers).toBe(10);
    expect(board.cells.length).toBe(15);
    expect(board.cells[0].length).toBe(10);
  });

  it("assigns correct pick numbers", () => {
    const board = initializeDraftBoard(10, 15);

    // First round: picks 1-10
    expect(board.cells[0][0].pickNumber).toBe(1);
    expect(board.cells[0][9].pickNumber).toBe(10);

    // Total picks should be rounds * managers
    const lastRound = board.cells[14];
    const maxPick = Math.max(...lastRound.map((c) => c.pickNumber));
    expect(maxPick).toBe(150);
  });

  it("sets snake directions correctly", () => {
    const board = initializeDraftBoard(10, 15);

    expect(board.snakeDirections[0]).toBe(true); // Round 1: left to right
    expect(board.snakeDirections[1]).toBe(false); // Round 2: right to left
    expect(board.snakeDirections[2]).toBe(true); // Round 3: left to right
  });
});

describe("markUserPicks", () => {
  it("marks user picks correctly", () => {
    const board = initializeDraftBoard(10, 15);
    const result = markUserPicks(board, 3);

    // Check that position 3 is marked as user pick in all rounds
    for (const round of result.cells) {
      const userCell = round.find((c) => c.managerPosition === 3);
      expect(userCell?.isUserPick).toBe(true);

      const otherCell = round.find((c) => c.managerPosition !== 3);
      expect(otherCell?.isUserPick).toBe(false);
    }
  });
});

describe("getUserPickInRound", () => {
  it("calculates correct pick for odd rounds (left to right)", () => {
    // Round 1, position 3 in 10-team league = pick 3
    expect(getUserPickInRound(1, 3, 10)).toBe(3);

    // Round 3, position 5 in 10-team league = pick 25
    expect(getUserPickInRound(3, 5, 10)).toBe(25);
  });

  it("calculates correct pick for even rounds (right to left)", () => {
    // Round 2, position 3 in 10-team league = pick 18 (10 + 8)
    expect(getUserPickInRound(2, 3, 10)).toBe(18);

    // Round 2, position 10 in 10-team league = pick 11
    expect(getUserPickInRound(2, 10, 10)).toBe(11);
  });
});

describe("getManagerForPick", () => {
  it("returns correct manager for picks in round 1", () => {
    expect(getManagerForPick(1, 10)).toEqual({ round: 1, managerPosition: 1 });
    expect(getManagerForPick(5, 10)).toEqual({ round: 1, managerPosition: 5 });
    expect(getManagerForPick(10, 10)).toEqual({
      round: 1,
      managerPosition: 10,
    });
  });

  it("returns correct manager for snake in round 2", () => {
    // Round 2 reverses: pick 11 = position 10, pick 20 = position 1
    expect(getManagerForPick(11, 10)).toEqual({
      round: 2,
      managerPosition: 10,
    });
    expect(getManagerForPick(15, 10)).toEqual({ round: 2, managerPosition: 6 });
    expect(getManagerForPick(20, 10)).toEqual({ round: 2, managerPosition: 1 });
  });
});
