import { describe, it, expect } from "vitest";

describe("current squad score calculation", () => {
  it("sums predicted points across multiple gameweeks for current squad players", () => {
    const mockPlayers = [
      { id: 1, predictedPoints: 5.0 },
      { id: 2, predictedPoints: 4.0 },
      { id: 3, predictedPoints: 6.0 },
    ];

    const currentSquadIds = [1, 2, 3];
    const gwPredictionMaps = [
      new Map(mockPlayers.map((p) => [p.id, p])),
      new Map(
        mockPlayers.map((p) => [
          p.id,
          { ...p, predictedPoints: p.predictedPoints + 1 },
        ]),
      ),
    ];

    const total = currentSquadIds.reduce((squadSum, playerId) => {
      const playerGwSum = gwPredictionMaps.reduce((gwSum, map) => {
        const p = map.get(playerId);
        return gwSum + (p?.predictedPoints ?? 0);
      }, 0);
      return squadSum + playerGwSum;
    }, 0);

    // GW1: 5+4+6=15, GW2: 6+5+7=18, total=33
    expect(total).toBe(33);
  });

  it("handles missing players in prediction maps gracefully", () => {
    const gwPredictionMaps = [
      new Map([[1, { id: 1, predictedPoints: 5.0 }]]),
      new Map([[1, { id: 1, predictedPoints: 6.0 }]]),
    ];

    const currentSquadIds = [1, 99]; // player 99 not in maps

    const total = currentSquadIds.reduce((squadSum, playerId) => {
      const playerGwSum = gwPredictionMaps.reduce((gwSum, map) => {
        const p = map.get(playerId);
        return gwSum + (p?.predictedPoints ?? 0);
      }, 0);
      return squadSum + playerGwSum;
    }, 0);

    // Only player 1 contributes: 5+6=11, player 99 contributes 0
    expect(total).toBe(11);
  });
});
