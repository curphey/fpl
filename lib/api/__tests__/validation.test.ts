import { describe, it, expect } from "vitest";
import {
  FPL_CONSTANTS,
  gameweekSchema,
  managerIdSchema,
  playerIdSchema,
  teamIdSchema,
  leagueIdSchema,
  pageSchema,
  optimizeRequestSchema,
  notificationSendSchema,
  newsSearchSchema,
  validateRequest,
  validationErrorResponse,
} from "../validation";
import { z } from "zod";

describe("Validation Schemas", () => {
  describe("FPL_CONSTANTS", () => {
    it("has correct gameweek bounds", () => {
      expect(FPL_CONSTANTS.MIN_GAMEWEEK).toBe(1);
      expect(FPL_CONSTANTS.MAX_GAMEWEEK).toBe(38);
    });

    it("has correct team bounds", () => {
      expect(FPL_CONSTANTS.MIN_TEAM_ID).toBe(1);
      expect(FPL_CONSTANTS.MAX_TEAM_ID).toBe(20);
    });
  });

  describe("gameweekSchema", () => {
    it("accepts valid gameweeks", () => {
      expect(gameweekSchema.parse(1)).toBe(1);
      expect(gameweekSchema.parse(20)).toBe(20);
      expect(gameweekSchema.parse(38)).toBe(38);
    });

    it("coerces string to number", () => {
      expect(gameweekSchema.parse("15")).toBe(15);
    });

    it("rejects gameweek below 1", () => {
      expect(() => gameweekSchema.parse(0)).toThrow();
      expect(() => gameweekSchema.parse(-1)).toThrow();
    });

    it("rejects gameweek above 38", () => {
      expect(() => gameweekSchema.parse(39)).toThrow();
      expect(() => gameweekSchema.parse(100)).toThrow();
    });

    it("rejects non-integer values", () => {
      expect(() => gameweekSchema.parse(5.5)).toThrow();
    });

    it("rejects non-numeric strings", () => {
      expect(() => gameweekSchema.parse("abc")).toThrow();
    });
  });

  describe("managerIdSchema", () => {
    it("accepts valid manager IDs", () => {
      expect(managerIdSchema.parse(1)).toBe(1);
      expect(managerIdSchema.parse(123456)).toBe(123456);
      expect(managerIdSchema.parse(15_000_000)).toBe(15_000_000);
    });

    it("coerces string to number", () => {
      expect(managerIdSchema.parse("123456")).toBe(123456);
    });

    it("rejects zero", () => {
      expect(() => managerIdSchema.parse(0)).toThrow();
    });

    it("rejects negative IDs", () => {
      expect(() => managerIdSchema.parse(-1)).toThrow();
    });

    it("rejects IDs exceeding max", () => {
      expect(() => managerIdSchema.parse(15_000_001)).toThrow();
    });
  });

  describe("playerIdSchema", () => {
    it("accepts valid player IDs", () => {
      expect(playerIdSchema.parse(1)).toBe(1);
      expect(playerIdSchema.parse(500)).toBe(500);
      expect(playerIdSchema.parse(1000)).toBe(1000);
    });

    it("rejects IDs above 1000", () => {
      expect(() => playerIdSchema.parse(1001)).toThrow();
    });
  });

  describe("teamIdSchema", () => {
    it("accepts valid team IDs (1-20)", () => {
      expect(teamIdSchema.parse(1)).toBe(1);
      expect(teamIdSchema.parse(10)).toBe(10);
      expect(teamIdSchema.parse(20)).toBe(20);
    });

    it("rejects IDs below 1", () => {
      expect(() => teamIdSchema.parse(0)).toThrow();
    });

    it("rejects IDs above 20", () => {
      expect(() => teamIdSchema.parse(21)).toThrow();
    });
  });

  describe("leagueIdSchema", () => {
    it("accepts valid league IDs", () => {
      expect(leagueIdSchema.parse(1)).toBe(1);
      expect(leagueIdSchema.parse(314)).toBe(314);
      expect(leagueIdSchema.parse(1_000_000_000)).toBe(1_000_000_000);
    });

    it("rejects IDs exceeding max", () => {
      expect(() => leagueIdSchema.parse(1_000_000_001)).toThrow();
    });
  });

  describe("pageSchema", () => {
    it("accepts positive integers", () => {
      expect(pageSchema.parse(1)).toBe(1);
      expect(pageSchema.parse(100)).toBe(100);
    });

    it("defaults to 1 when undefined", () => {
      expect(pageSchema.parse(undefined)).toBe(1);
    });

    it("rejects zero", () => {
      expect(() => pageSchema.parse(0)).toThrow();
    });

    it("rejects negative values", () => {
      expect(() => pageSchema.parse(-1)).toThrow();
    });
  });

  describe("optimizeRequestSchema", () => {
    const validRequest = {
      type: "transfer" as const,
      query: "Who should I transfer in?",
    };

    it("accepts valid minimal request", () => {
      const result = optimizeRequestSchema.parse(validRequest);
      expect(result.type).toBe("transfer");
      expect(result.query).toBe("Who should I transfer in?");
    });

    it("accepts all valid types", () => {
      expect(
        optimizeRequestSchema.parse({ ...validRequest, type: "transfer" }),
      ).toBeDefined();
      expect(
        optimizeRequestSchema.parse({ ...validRequest, type: "chip" }),
      ).toBeDefined();
      expect(
        optimizeRequestSchema.parse({ ...validRequest, type: "wildcard" }),
      ).toBeDefined();
    });

    it("rejects invalid type", () => {
      expect(() =>
        optimizeRequestSchema.parse({ ...validRequest, type: "invalid" }),
      ).toThrow();
    });

    it("rejects empty query", () => {
      expect(() =>
        optimizeRequestSchema.parse({ type: "transfer", query: "" }),
      ).toThrow();
    });

    it("rejects query over 1000 characters", () => {
      expect(() =>
        optimizeRequestSchema.parse({
          type: "transfer",
          query: "a".repeat(1001),
        }),
      ).toThrow();
    });

    it("accepts optional constraints", () => {
      const result = optimizeRequestSchema.parse({
        ...validRequest,
        constraints: {
          budget: 100,
          maxTransfers: 2,
          positionNeeds: ["MID", "FWD"],
          excludePlayers: ["Haaland"],
          preferDifferentials: true,
        },
      });
      expect(result.constraints?.budget).toBe(100);
      expect(result.constraints?.positionNeeds).toEqual(["MID", "FWD"]);
    });

    it("validates constraint bounds", () => {
      expect(() =>
        optimizeRequestSchema.parse({
          ...validRequest,
          constraints: { budget: 201 }, // Max is 200
        }),
      ).toThrow();

      expect(() =>
        optimizeRequestSchema.parse({
          ...validRequest,
          constraints: { maxTransfers: 16 }, // Max is 15
        }),
      ).toThrow();
    });

    it("accepts optional currentTeam", () => {
      const result = optimizeRequestSchema.parse({
        ...validRequest,
        currentTeam: {
          players: [
            { id: 1, name: "Saka", position: "MID", team: "ARS", price: 10.0 },
          ],
          bank: 1.5,
          freeTransfers: 2,
          chipsUsed: ["wildcard"],
        },
      });
      expect(result.currentTeam?.bank).toBe(1.5);
    });
  });

  describe("notificationSendSchema", () => {
    const validNotification = {
      type: "deadline_reminder" as const,
      title: "Deadline Alert",
      body: "Gameweek deadline in 1 hour!",
    };

    it("accepts valid notification", () => {
      const result = notificationSendSchema.parse(validNotification);
      expect(result.type).toBe("deadline_reminder");
      expect(result.title).toBe("Deadline Alert");
    });

    it("accepts all valid types", () => {
      const types = [
        "deadline_reminder",
        "price_change",
        "injury_update",
        "league_update",
        "weekly_summary",
      ] as const;
      types.forEach((type) => {
        expect(
          notificationSendSchema.parse({ ...validNotification, type }),
        ).toBeDefined();
      });
    });

    it("rejects empty title", () => {
      expect(() =>
        notificationSendSchema.parse({ ...validNotification, title: "" }),
      ).toThrow();
    });

    it("rejects title over 100 characters", () => {
      expect(() =>
        notificationSendSchema.parse({
          ...validNotification,
          title: "a".repeat(101),
        }),
      ).toThrow();
    });

    it("rejects body over 500 characters", () => {
      expect(() =>
        notificationSendSchema.parse({
          ...validNotification,
          body: "a".repeat(501),
        }),
      ).toThrow();
    });

    it("accepts optional user_id as UUID", () => {
      const result = notificationSendSchema.parse({
        ...validNotification,
        user_id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.user_id).toBeDefined();
    });

    it("rejects invalid UUID format", () => {
      expect(() =>
        notificationSendSchema.parse({
          ...validNotification,
          user_id: "not-a-uuid",
        }),
      ).toThrow();
    });

    it("accepts optional URL", () => {
      const result = notificationSendSchema.parse({
        ...validNotification,
        url: "https://example.com/path",
      });
      expect(result.url).toBe("https://example.com/path");
    });

    it("rejects invalid URL", () => {
      expect(() =>
        notificationSendSchema.parse({
          ...validNotification,
          url: "not-a-valid-url",
        }),
      ).toThrow();
    });
  });

  describe("newsSearchSchema", () => {
    it("accepts empty object (all optional)", () => {
      const result = newsSearchSchema.parse({});
      expect(result.limit).toBe(10); // default value
    });

    it("accepts valid categories", () => {
      const result = newsSearchSchema.parse({
        categories: ["injury", "transfer", "team_news"],
      });
      expect(result.categories).toHaveLength(3);
    });

    it("rejects invalid categories", () => {
      expect(() =>
        newsSearchSchema.parse({ categories: ["invalid_category"] }),
      ).toThrow();
    });

    it("limits players array to 10", () => {
      expect(() =>
        newsSearchSchema.parse({
          players: Array(11).fill("Saka"),
        }),
      ).toThrow();
    });

    it("limits teams array to 20", () => {
      expect(() =>
        newsSearchSchema.parse({
          teams: Array(21).fill("Arsenal"),
        }),
      ).toThrow();
    });

    it("validates limit bounds", () => {
      expect(newsSearchSchema.parse({ limit: 1 }).limit).toBe(1);
      expect(newsSearchSchema.parse({ limit: 50 }).limit).toBe(50);
      expect(() => newsSearchSchema.parse({ limit: 0 })).toThrow();
      expect(() => newsSearchSchema.parse({ limit: 51 })).toThrow();
    });
  });

  describe("validateRequest", () => {
    it("returns parsed data for valid input", () => {
      const result = validateRequest(gameweekSchema, "20");
      expect(result).toBe(20);
    });

    it("throws error with code for invalid input", () => {
      try {
        validateRequest(gameweekSchema, "invalid");
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error & { code: string }).code).toBe(
          "VALIDATION_ERROR",
        );
      }
    });

    it("includes issues in error", () => {
      try {
        validateRequest(gameweekSchema, "invalid");
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error & { issues: unknown[] }).issues).toBeDefined();
        expect(
          (error as Error & { issues: unknown[] }).issues.length,
        ).toBeGreaterThan(0);
      }
    });
  });

  describe("validationErrorResponse", () => {
    it("formats validation error correctly", () => {
      const zodError = new z.ZodError([
        {
          code: "too_small",
          minimum: 1,
          type: "number",
          inclusive: true,
          exact: false,
          path: ["gameweek"],
          message: "Gameweek must be at least 1",
        },
      ]);

      const response = validationErrorResponse(zodError);

      expect(response.code).toBe("VALIDATION_ERROR");
      expect(response.error).toContain("gameweek");
      expect(response.error).toContain("Gameweek must be at least 1");
      expect(response.details).toHaveLength(1);
    });

    it("handles empty path", () => {
      const zodError = new z.ZodError([
        {
          code: "invalid_type",
          expected: "number",
          received: "string",
          path: [],
          message: "Invalid request",
        },
      ]);

      const response = validationErrorResponse(zodError);
      expect(response.error).toContain("request");
    });
  });
});
