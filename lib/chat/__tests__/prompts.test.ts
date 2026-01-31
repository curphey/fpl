import { describe, it, expect } from "vitest";
import { buildChatSystemPrompt } from "../prompts";

describe("buildChatSystemPrompt", () => {
  it("should include FPL assistant context", () => {
    const prompt = buildChatSystemPrompt(false);
    expect(prompt).toContain("Fantasy Premier League");
    expect(prompt).toContain("FPL");
    expect(prompt).toContain("assistant");
  });

  it("should note when manager ID is connected", () => {
    const prompt = buildChatSystemPrompt(true);
    expect(prompt).toContain("connected their FPL manager ID");
    expect(prompt).toContain("personalized recommendations");
  });

  it("should note when manager ID is NOT connected", () => {
    const prompt = buildChatSystemPrompt(false);
    expect(prompt).toContain("NOT connected their FPL manager ID");
    expect(prompt).toContain("connect their manager ID");
  });

  it("should include tool capabilities", () => {
    const prompt = buildChatSystemPrompt(true);
    expect(prompt).toContain("Search for players");
    expect(prompt).toContain("Compare players");
    expect(prompt).toContain("captain recommendations");
    expect(prompt).toContain("transfer targets");
    expect(prompt).toContain("price change predictions");
    expect(prompt).toContain("chip timing");
  });

  it("should include FPL domain knowledge", () => {
    const prompt = buildChatSystemPrompt(true);
    expect(prompt).toContain("Gameweeks");
    expect(prompt).toContain("Price changes");
    expect(prompt).toContain("Chips");
    expect(prompt).toContain("Wildcard");
    expect(prompt).toContain("Free Hit");
    expect(prompt).toContain("Bench Boost");
    expect(prompt).toContain("Triple Captain");
    expect(prompt).toContain("FDR");
    expect(prompt).toContain("Form");
    expect(prompt).toContain("xGI");
  });

  it("should include response guidelines", () => {
    const prompt = buildChatSystemPrompt(false);
    expect(prompt).toContain("Response Guidelines");
    expect(prompt).toContain("captain picks");
    expect(prompt).toContain("transfers");
    expect(prompt).toContain("comparing players");
    expect(prompt).toContain("fixture analysis");
    expect(prompt).toContain("chip advice");
  });

  it("should include communication style guidelines", () => {
    const prompt = buildChatSystemPrompt(true);
    expect(prompt).toContain("concise");
    expect(prompt).toContain("data");
    expect(prompt).toContain("markdown");
  });
});
