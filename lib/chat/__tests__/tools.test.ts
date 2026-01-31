import { describe, it, expect } from "vitest";
import { chatTools, getToolDefinitions } from "../tools";

describe("chatTools", () => {
  it("should have 10 tools defined", () => {
    expect(chatTools).toHaveLength(10);
  });

  it("should include all expected tools", () => {
    const toolNames = chatTools.map((t) => t.name);
    expect(toolNames).toContain("get_my_squad");
    expect(toolNames).toContain("search_players");
    expect(toolNames).toContain("get_player_details");
    expect(toolNames).toContain("compare_players");
    expect(toolNames).toContain("get_fixtures");
    expect(toolNames).toContain("get_captain_recommendations");
    expect(toolNames).toContain("get_transfer_recommendations");
    expect(toolNames).toContain("get_price_changes");
    expect(toolNames).toContain("get_chip_advice");
    expect(toolNames).toContain("get_gameweek_info");
  });

  it("should have valid schemas for all tools", () => {
    for (const tool of chatTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe("object");
      expect(tool.input_schema.properties).toBeDefined();
    }
  });
});

describe("getToolDefinitions", () => {
  it("should return formatted tool definitions", () => {
    const definitions = getToolDefinitions();
    expect(definitions).toHaveLength(10);

    for (const def of definitions) {
      expect(def).toHaveProperty("name");
      expect(def).toHaveProperty("description");
      expect(def).toHaveProperty("input_schema");
    }
  });
});

describe("tool schema details", () => {
  it("search_players should have correct filter properties", () => {
    const searchTool = chatTools.find((t) => t.name === "search_players");
    expect(searchTool).toBeDefined();

    const props = searchTool!.input_schema.properties;
    expect(props.query).toBeDefined();
    expect(props.team).toBeDefined();
    expect(props.position).toBeDefined();
    expect(props.min_price).toBeDefined();
    expect(props.max_price).toBeDefined();
    expect(props.sort_by).toBeDefined();
    expect(props.limit).toBeDefined();

    expect(props.position.enum).toEqual(["GKP", "DEF", "MID", "FWD"]);
    expect(props.sort_by.enum).toContain("total_points");
    expect(props.sort_by.enum).toContain("form");
    expect(props.sort_by.enum).toContain("xgi");
  });

  it("compare_players should require player_names", () => {
    const compareTool = chatTools.find((t) => t.name === "compare_players");
    expect(compareTool).toBeDefined();
    expect(compareTool!.input_schema.required).toContain("player_names");
    expect(compareTool!.input_schema.properties.player_names.type).toBe(
      "array",
    );
  });

  it("get_price_changes should have direction enum", () => {
    const priceTool = chatTools.find((t) => t.name === "get_price_changes");
    expect(priceTool).toBeDefined();
    expect(priceTool!.input_schema.properties.direction.enum).toEqual([
      "rise",
      "fall",
      "both",
    ]);
  });

  it("get_chip_advice should have chip enum", () => {
    const chipTool = chatTools.find((t) => t.name === "get_chip_advice");
    expect(chipTool).toBeDefined();
    expect(chipTool!.input_schema.properties.chip.enum).toEqual([
      "wildcard",
      "freehit",
      "bboost",
      "3xc",
    ]);
  });
});
