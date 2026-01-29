import { describe, it, expect } from "vitest";
import type { EnrichedPlayer } from "../utils";
import type { Pick } from "../types";
import {
  predictPriceChanges,
  getSquadPriceAlerts,
  calculateTransferTiming,
  type PriceChangeCandidate,
} from "../price-model";

// Mock enriched player factory
function createMockEnrichedPlayer(
  overrides: Partial<EnrichedPlayer> = {},
): EnrichedPlayer {
  return {
    id: 1,
    first_name: "Mo",
    second_name: "Salah",
    web_name: "Salah",
    element_type: 3,
    team: 1,
    now_cost: 130,
    total_points: 150,
    form: "8.5",
    status: "a",
    chance_of_playing_this_round: 100,
    chance_of_playing_next_round: 100,
    selected_by_percent: "50.0",
    transfers_in_event: 10000,
    transfers_out_event: 5000,
    cost_change_event: 0,
    cost_change_start: 0,
    goals_scored: 10,
    assists: 8,
    clean_sheets: 5,
    saves: 0,
    bonus: 20,
    bps: 500,
    minutes: 1500,
    ict_index: "250.5",
    expected_goals: "12.5",
    expected_assists: "7.5",
    expected_goal_involvements: "20.0",
    points_per_game: "6.5",
    value_form: "0.7",
    value_season: "1.2",
    news: "",
    news_added: null,
    squad_number: null,
    photo: "salah.jpg",
    code: 1,
    ep_next: "5.0",
    ep_this: "5.0",
    event_points: 10,
    goals_conceded: 5,
    in_dreamteam: false,
    influence: "100.0",
    creativity: "100.0",
    threat: "50.0",
    own_goals: 0,
    penalties_missed: 0,
    penalties_saved: 0,
    red_cards: 0,
    starts: 15,
    yellow_cards: 2,
    transfers_in: 500000,
    transfers_out: 200000,
    region: null,
    corners_and_indirect_freekicks_order: null,
    corners_and_indirect_freekicks_text: "",
    direct_freekicks_order: null,
    direct_freekicks_text: "",
    penalties_order: 1,
    penalties_text: "On pens",
    expected_goals_per_90: 0.5,
    expected_assists_per_90: 0.3,
    expected_goal_involvements_per_90: 0.8,
    goals_conceded_per_90: 0.3,
    saves_per_90: 0,
    starts_per_90: 1,
    clean_sheets_per_90: 0.3,
    now_cost_rank: 5,
    now_cost_rank_type: 2,
    form_rank: 3,
    form_rank_type: 1,
    points_per_game_rank: 4,
    points_per_game_rank_type: 2,
    selected_rank: 2,
    selected_rank_type: 1,
    dreamteam_count: 5,
    team_name: "Liverpool",
    team_short_name: "LIV",
    position_name: "Midfielder",
    position_short: "MID",
    price_formatted: "£13.0m",
    form_value: 8.5,
    xgi_value: 20.0,
    ...overrides,
  };
}

describe("Price Model", () => {
  describe("predictPriceChanges", () => {
    it("identifies players likely to rise based on net transfers", () => {
      const players = [
        createMockEnrichedPlayer({
          id: 1,
          web_name: "Riser",
          selected_by_percent: "10.0",
          transfers_in_event: 50000,
          transfers_out_event: 5000,
          cost_change_event: 0,
        }),
      ];

      const { risers, fallers } = predictPriceChanges(players);

      expect(risers.length).toBeGreaterThan(0);
      expect(risers[0].direction).toBe("rise");
      expect(risers[0].netTransfers).toBe(45000);
    });

    it("identifies players likely to fall based on net transfers", () => {
      const players = [
        createMockEnrichedPlayer({
          id: 1,
          web_name: "Faller",
          selected_by_percent: "10.0",
          transfers_in_event: 5000,
          transfers_out_event: 50000,
          cost_change_event: 0,
        }),
      ];

      const { risers, fallers } = predictPriceChanges(players);

      expect(fallers.length).toBeGreaterThan(0);
      expect(fallers[0].direction).toBe("fall");
      expect(fallers[0].netTransfers).toBe(-45000);
    });

    it("skips players with very low ownership (<0.1%)", () => {
      const players = [
        createMockEnrichedPlayer({
          id: 1,
          selected_by_percent: "0.05",
          transfers_in_event: 50000,
          transfers_out_event: 5000,
        }),
      ];

      const { risers, fallers } = predictPriceChanges(players);

      expect(risers.length).toBe(0);
      expect(fallers.length).toBe(0);
    });

    it("skips players with zero transfers", () => {
      const players = [
        createMockEnrichedPlayer({
          id: 1,
          selected_by_percent: "10.0",
          transfers_in_event: 0,
          transfers_out_event: 0,
        }),
      ];

      const { risers, fallers } = predictPriceChanges(players);

      expect(risers.length).toBe(0);
      expect(fallers.length).toBe(0);
    });

    it("calculates probability with momentum boost", () => {
      const playerWithMomentum = createMockEnrichedPlayer({
        id: 1,
        selected_by_percent: "10.0",
        transfers_in_event: 30000,
        transfers_out_event: 5000,
        cost_change_event: 1, // Already rose this GW
      });
      const playerWithoutMomentum = createMockEnrichedPlayer({
        id: 2,
        selected_by_percent: "10.0",
        transfers_in_event: 30000,
        transfers_out_event: 5000,
        cost_change_event: 0,
      });

      const { risers: risersWithMom } = predictPriceChanges([
        playerWithMomentum,
      ]);
      const { risers: risersNoMom } = predictPriceChanges([
        playerWithoutMomentum,
      ]);

      // Momentum should boost probability
      if (risersWithMom.length > 0 && risersNoMom.length > 0) {
        expect(risersWithMom[0].probability).toBeGreaterThanOrEqual(
          risersNoMom[0].probability,
        );
      }
    });

    it("caps probability at 0.95", () => {
      const players = [
        createMockEnrichedPlayer({
          id: 1,
          selected_by_percent: "1.0", // Low ownership
          transfers_in_event: 500000, // Massive transfers
          transfers_out_event: 0,
          cost_change_event: 1,
        }),
      ];

      const { risers } = predictPriceChanges(players);

      if (risers.length > 0) {
        expect(risers[0].probability).toBeLessThanOrEqual(0.95);
      }
    });

    it("limits results to top 20 risers and fallers", () => {
      const players = Array.from({ length: 30 }, (_, i) =>
        createMockEnrichedPlayer({
          id: i + 1,
          selected_by_percent: "5.0",
          transfers_in_event: 20000 + i * 1000,
          transfers_out_event: 1000,
        }),
      );

      const { risers } = predictPriceChanges(players);

      expect(risers.length).toBeLessThanOrEqual(20);
    });

    it("sorts by probability descending", () => {
      const players = [
        createMockEnrichedPlayer({
          id: 1,
          selected_by_percent: "5.0",
          transfers_in_event: 10000,
          transfers_out_event: 1000,
        }),
        createMockEnrichedPlayer({
          id: 2,
          selected_by_percent: "5.0",
          transfers_in_event: 50000,
          transfers_out_event: 1000,
        }),
      ];

      const { risers } = predictPriceChanges(players);

      if (risers.length >= 2) {
        expect(risers[0].probability).toBeGreaterThanOrEqual(
          risers[1].probability,
        );
      }
    });
  });

  describe("getSquadPriceAlerts", () => {
    it("returns fallers in user squad above threshold", () => {
      const picks: Pick[] = [
        {
          element: 1,
          position: 1,
          is_captain: false,
          is_vice_captain: false,
          multiplier: 1,
        },
        {
          element: 2,
          position: 2,
          is_captain: false,
          is_vice_captain: false,
          multiplier: 1,
        },
      ];
      const priceChanges = {
        risers: [],
        fallers: [
          {
            player: createMockEnrichedPlayer({ id: 1 }),
            direction: "fall" as const,
            probability: 0.5,
            netTransfers: -50000,
            transferRatio: -0.05,
            costChangeMomentum: 0,
          },
          {
            player: createMockEnrichedPlayer({ id: 3 }), // Not in squad
            direction: "fall" as const,
            probability: 0.5,
            netTransfers: -50000,
            transferRatio: -0.05,
            costChangeMomentum: 0,
          },
        ],
      };

      const alerts = getSquadPriceAlerts(picks, priceChanges);

      expect(alerts.fallers.length).toBe(1);
      expect(alerts.fallers[0].player.id).toBe(1);
      expect(alerts.atRisk).toBe(1);
    });

    it("respects probability threshold parameter", () => {
      const picks: Pick[] = [
        {
          element: 1,
          position: 1,
          is_captain: false,
          is_vice_captain: false,
          multiplier: 1,
        },
      ];
      const priceChanges = {
        risers: [],
        fallers: [
          {
            player: createMockEnrichedPlayer({ id: 1 }),
            direction: "fall" as const,
            probability: 0.25, // Below 0.3 threshold
            netTransfers: -30000,
            transferRatio: -0.03,
            costChangeMomentum: 0,
          },
        ],
      };

      const alerts = getSquadPriceAlerts(picks, priceChanges, 0.3);

      expect(alerts.fallers.length).toBe(0);
      expect(alerts.atRisk).toBe(0);
    });

    it("returns empty array when no squad players are falling", () => {
      const picks: Pick[] = [
        {
          element: 1,
          position: 1,
          is_captain: false,
          is_vice_captain: false,
          multiplier: 1,
        },
      ];
      const priceChanges = {
        risers: [],
        fallers: [
          {
            player: createMockEnrichedPlayer({ id: 99 }), // Not in squad
            direction: "fall" as const,
            probability: 0.8,
            netTransfers: -100000,
            transferRatio: -0.1,
            costChangeMomentum: 0,
          },
        ],
      };

      const alerts = getSquadPriceAlerts(picks, priceChanges);

      expect(alerts.fallers.length).toBe(0);
    });
  });

  describe("calculateTransferTiming", () => {
    it("recommends buy_now for high probability risers (>=50%)", () => {
      const candidate: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "rise",
        probability: 0.6,
        netTransfers: 50000,
        transferRatio: 0.05,
        costChangeMomentum: 0,
      };

      const advice = calculateTransferTiming(candidate);

      expect(advice.recommendation).toBe("buy_now");
      expect(advice.expectedCost).toBe(10.1); // Current price + 0.1
      expect(advice.urgencyScore).toBeGreaterThan(50);
    });

    it("recommends wait for high probability fallers (>=50%)", () => {
      const candidate: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "fall",
        probability: 0.6,
        netTransfers: -50000,
        transferRatio: -0.05,
        costChangeMomentum: 0,
      };

      const advice = calculateTransferTiming(candidate);

      expect(advice.recommendation).toBe("wait");
      expect(advice.expectedCost).toBe(9.9); // Current price - 0.1
      expect(advice.urgencyScore).toBe(0);
    });

    it("returns neutral for moderate probability", () => {
      const candidate: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "rise",
        probability: 0.35,
        netTransfers: 20000,
        transferRatio: 0.02,
        costChangeMomentum: 0,
      };

      const advice = calculateTransferTiming(candidate);

      expect(advice.recommendation).toBe("neutral");
    });

    it("boosts urgency when momentum already started", () => {
      const withMomentum: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "rise",
        probability: 0.6,
        netTransfers: 50000,
        transferRatio: 0.05,
        costChangeMomentum: 1, // Price already rose
      };
      const withoutMomentum: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "rise",
        probability: 0.6,
        netTransfers: 50000,
        transferRatio: 0.05,
        costChangeMomentum: 0,
      };

      const adviceWithMom = calculateTransferTiming(withMomentum);
      const adviceNoMom = calculateTransferTiming(withoutMomentum);

      expect(adviceWithMom.urgencyScore).toBeGreaterThan(
        adviceNoMom.urgencyScore,
      );
      expect(adviceWithMom.reasoning).toContain("already moved");
    });

    it("boosts urgency for very high transfer volume (>100k)", () => {
      const highVolume: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "rise",
        probability: 0.6,
        netTransfers: 150000,
        transferRatio: 0.15,
        costChangeMomentum: 0,
      };
      const lowVolume: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "rise",
        probability: 0.6,
        netTransfers: 50000,
        transferRatio: 0.05,
        costChangeMomentum: 0,
      };

      const adviceHigh = calculateTransferTiming(highVolume);
      const adviceLow = calculateTransferTiming(lowVolume);

      expect(adviceHigh.urgencyScore).toBeGreaterThan(adviceLow.urgencyScore);
    });

    it("recommends wait for low probability risers (<30%)", () => {
      const candidate: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "rise",
        probability: 0.2,
        netTransfers: 10000,
        transferRatio: 0.01,
        costChangeMomentum: 0,
      };

      const advice = calculateTransferTiming(candidate);

      expect(advice.recommendation).toBe("wait");
      expect(advice.reasoning).toContain("Low probability");
      expect(advice.reasoning).toContain("Safe to wait");
    });

    it("returns neutral for moderate probability fallers (30-50%)", () => {
      const candidate: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "fall",
        probability: 0.4,
        netTransfers: -30000,
        transferRatio: -0.03,
        costChangeMomentum: 0,
      };

      const advice = calculateTransferTiming(candidate);

      expect(advice.recommendation).toBe("neutral");
      expect(advice.reasoning).toContain("Moderate chance");
      expect(advice.reasoning).toContain("Could wait for discount");
      expect(advice.urgencyScore).toBe(20);
    });

    it("returns neutral for low probability fallers (<30%)", () => {
      const candidate: PriceChangeCandidate = {
        player: createMockEnrichedPlayer({ now_cost: 100 }),
        direction: "fall",
        probability: 0.15,
        netTransfers: -5000,
        transferRatio: -0.005,
        costChangeMomentum: 0,
      };

      const advice = calculateTransferTiming(candidate);

      expect(advice.recommendation).toBe("neutral");
      expect(advice.reasoning).toContain("Low probability");
      expect(advice.reasoning).toContain("Price likely stable");
      expect(advice.urgencyScore).toBe(30);
    });
  });
});
