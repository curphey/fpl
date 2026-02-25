import { describe, it, expect } from "vitest";
import { buildGwPlanPrompt, parseGwPlanResult } from "../gw-plan-client";
import type { GwPlanRequest } from "../gw-plan-client";

const baseRequest: GwPlanRequest = {
  gameweek: 28,
  squad: [
    {
      id: 1,
      name: "Salah",
      team: "LIV",
      position: "MID",
      predictedPtsNextGW: 9.2,
      predicted4GW: 32.1,
      form: "9.0",
      upcomingDifficulty: 2.0,
    },
  ],
  freeTransfers: 1,
  bank: 5, // £0.5m
  topTargets: [
    {
      id: 2,
      name: "Haaland",
      team: "MCI",
      position: "FWD",
      score: 8.5,
      predicted4GW: 28.0,
      form: "7.5",
      upcomingDifficulty: 2.5,
    },
  ],
  captainOptions: [
    {
      id: 1,
      name: "Salah",
      score: 9.1,
      opponentShortName: "PAL",
      isHome: true,
    },
  ],
};

describe("buildGwPlanPrompt", () => {
  it("includes gameweek number", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("GW28");
  });

  it("includes squad player name", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("Salah");
  });

  it("includes free transfers count", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("1");
  });

  it("includes top transfer target", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("Haaland");
  });

  it("includes captain option with opponent", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("PAL");
  });

  it("includes JSON schema instructions", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("predictedTeamPoints");
    expect(prompt).toContain("transfers");
  });
});

describe("parseGwPlanResult", () => {
  it("parses valid JSON response", () => {
    const json = JSON.stringify({
      predictedTeamPoints: 62,
      captain: { playerId: 1, name: "Salah", reasoning: "good fixtures" },
      transfers: [
        {
          playerOut: { id: 100, name: "Saka", predicted4GW: 18 },
          playerIn: { id: 200, name: "Palmer", predicted4GW: 26 },
          pointsGain: 8.0,
          reasoning: "Palmer in form",
        },
      ],
      notes: "No chip needed",
    });
    const result = parseGwPlanResult(json);
    expect(result.predictedTeamPoints).toBe(62);
    expect(result.captain.name).toBe("Salah");
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].pointsGain).toBe(8.0);
    expect(result.notes).toBe("No chip needed");
  });

  it("parses JSON wrapped in markdown code block", () => {
    const text =
      'Here is the plan:\n```json\n{"predictedTeamPoints":55,"captain":{"playerId":1,"name":"Haaland","reasoning":"top scorer"},"transfers":[],"notes":""}\n```';
    const result = parseGwPlanResult(text);
    expect(result.predictedTeamPoints).toBe(55);
    expect(result.captain.name).toBe("Haaland");
  });

  it("returns safe defaults on parse error", () => {
    const result = parseGwPlanResult("not valid json {{{");
    expect(result.predictedTeamPoints).toBe(0);
    expect(result.captain.name).toBe("Unknown");
    expect(result.transfers).toEqual([]);
    expect(result.notes).toContain("Parse error");
  });

  it("handles missing optional fields with defaults", () => {
    const result = parseGwPlanResult(
      JSON.stringify({ predictedTeamPoints: 50 }),
    );
    expect(result.transfers).toEqual([]);
    expect(result.notes).toBe("");
  });
});
