import { describe, it, expect } from "vitest";
import {
  buildGwPlanPrompt,
  parseGwPlanResult,
  GW_PLAN_SYSTEM_PROMPT,
} from "../gw-plan-client";
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
      sellingPrice: 12.5,
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
      cost: 14.0,
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

  it("includes squad player selling price", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("£12.5m");
  });

  it("includes transfer target cost", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("£14.0m");
  });

  it("includes squad player id so Claude echoes real FPL element IDs", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("[1]"); // Salah's id
  });

  it("includes transfer target id so Claude echoes real FPL element IDs", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("[2]"); // Haaland's id
  });

  it("includes captain option id so Claude echoes real FPL element IDs", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    // captain options section should reference player id 1
    expect(prompt).toMatch(/\[1\].*Salah/);
  });

  it("includes budget affordability guidance", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("affordable");
  });

  it("explains the points hit mechanic", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("4 points");
  });

  it("includes hitCost in the JSON schema", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("hitCost");
  });

  it("mentions multi-transfer budget strategy", () => {
    const prompt = buildGwPlanPrompt(baseRequest);
    expect(prompt).toContain("multiple");
  });
});

describe("GW_PLAN_SYSTEM_PROMPT", () => {
  it("enforces same-position-only transfers (GK→GK, DEF→DEF, MID→MID, FWD→FWD)", () => {
    expect(GW_PLAN_SYSTEM_PROMPT).toMatch(
      /GK.*GK|DEF.*DEF|same.*position|position.*same/i,
    );
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
          hitCost: 0,
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
    expect(result.transfers[0].hitCost).toBe(0);
    expect(result.notes).toBe("No chip needed");
  });

  it("parses hitCost on transfers that take a hit", () => {
    const json = JSON.stringify({
      predictedTeamPoints: 55,
      captain: { playerId: 1, name: "Salah", reasoning: "" },
      transfers: [
        {
          playerOut: { id: 1, name: "A", predicted4GW: 10 },
          playerIn: { id: 2, name: "B", predicted4GW: 18 },
          pointsGain: 4.0,
          hitCost: 4,
          reasoning: "Worth the hit",
        },
      ],
      notes: "",
    });
    const result = parseGwPlanResult(json);
    expect(result.transfers[0].hitCost).toBe(4);
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
