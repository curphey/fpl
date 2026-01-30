/**
 * Zod validation schemas for API routes.
 * Provides runtime type validation for all API inputs.
 */

import { z } from "zod";

/**
 * FPL API validation constants
 */
export const FPL_CONSTANTS = {
  MIN_GAMEWEEK: 1,
  MAX_GAMEWEEK: 38,
  MIN_MANAGER_ID: 1,
  MAX_MANAGER_ID: 15_000_000, // Reasonable upper bound
  MIN_PLAYER_ID: 1,
  MAX_PLAYER_ID: 1000,
  MIN_TEAM_ID: 1,
  MAX_TEAM_ID: 20,
  MIN_LEAGUE_ID: 1,
  MAX_LEAGUE_ID: 1_000_000_000,
} as const;

/**
 * Gameweek parameter validation (1-38)
 */
export const gameweekSchema = z.coerce
  .number()
  .int()
  .min(FPL_CONSTANTS.MIN_GAMEWEEK, "Gameweek must be at least 1")
  .max(FPL_CONSTANTS.MAX_GAMEWEEK, "Gameweek must be at most 38");

/**
 * Manager ID parameter validation
 */
export const managerIdSchema = z.coerce
  .number()
  .int()
  .positive("Manager ID must be positive")
  .max(FPL_CONSTANTS.MAX_MANAGER_ID, "Invalid manager ID");

/**
 * Player ID parameter validation
 */
export const playerIdSchema = z.coerce
  .number()
  .int()
  .positive("Player ID must be positive")
  .max(FPL_CONSTANTS.MAX_PLAYER_ID, "Invalid player ID");

/**
 * Team ID parameter validation (1-20)
 */
export const teamIdSchema = z.coerce
  .number()
  .int()
  .min(FPL_CONSTANTS.MIN_TEAM_ID, "Team ID must be at least 1")
  .max(FPL_CONSTANTS.MAX_TEAM_ID, "Team ID must be at most 20");

/**
 * League ID parameter validation
 */
export const leagueIdSchema = z.coerce
  .number()
  .int()
  .positive("League ID must be positive")
  .max(FPL_CONSTANTS.MAX_LEAGUE_ID, "Invalid league ID");

/**
 * Pagination page parameter validation
 */
export const pageSchema = z.coerce
  .number()
  .int()
  .positive("Page must be positive")
  .default(1);

/**
 * Optimization request validation
 */
export const optimizeRequestSchema = z.object({
  type: z.enum(["transfer", "chip", "wildcard"], {
    message: "Type must be transfer, chip, or wildcard",
  }),
  query: z
    .string()
    .min(1, "Query is required")
    .max(1000, "Query must be under 1000 characters"),
  constraints: z
    .object({
      budget: z.number().min(0).max(200).optional(),
      maxTransfers: z.number().int().min(1).max(15).optional(),
      positionNeeds: z.array(z.enum(["GK", "DEF", "MID", "FWD"])).optional(),
      excludePlayers: z.array(z.string()).optional(),
      mustInclude: z.array(z.string()).optional(),
      preferDifferentials: z.boolean().optional(),
      lookAheadWeeks: z.number().int().min(1).max(10).optional(),
    })
    .optional(),
  currentTeam: z
    .object({
      players: z.array(
        z.object({
          id: z.number().int().positive(),
          name: z.string(),
          position: z.string(),
          team: z.string(),
          price: z.number(),
        }),
      ),
      bank: z.number().min(0),
      freeTransfers: z.number().int().min(0).max(5),
      chipsUsed: z.array(z.string()),
    })
    .optional(),
  leagueContext: z
    .object({
      rank: z.number().int().positive(),
      totalManagers: z.number().int().positive(),
      gapToLeader: z.number().int(),
      gameweeksRemaining: z.number().int().min(0).max(38),
    })
    .optional(),
});

/**
 * Notification send request validation (for push notifications API)
 */
export const notificationSendSchema = z.object({
  user_id: z.string().uuid().optional(),
  type: z.enum([
    "deadline_reminder",
    "price_change",
    "injury_update",
    "league_update",
    "weekly_summary",
  ]),
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  body: z.string().min(1, "Body is required").max(500, "Body too long"),
  url: z.string().url().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  criteria: z
    .object({
      push_enabled: z.boolean().optional(),
      push_price_changes: z.boolean().optional(),
      push_injury_news: z.boolean().optional(),
      push_deadline_reminder: z.boolean().optional(),
      push_league_updates: z.boolean().optional(),
    })
    .optional(),
});

/**
 * News search request validation
 */
export const newsSearchSchema = z.object({
  query: z.string().max(500).optional(),
  categories: z
    .array(
      z.enum([
        "injury",
        "transfer",
        "team_news",
        "press_conference",
        "suspension",
        "general",
      ]),
    )
    .optional(),
  players: z.array(z.string()).max(10).optional(),
  teams: z.array(z.string()).max(20).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

/**
 * Validation error response type
 */
export interface ValidationError {
  error: string;
  code: "VALIDATION_ERROR";
  details?: z.ZodIssue[];
}

/**
 * Validate request data against a schema.
 * Returns parsed data or throws validation error.
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const error = new Error("Validation failed") as Error & {
      code: string;
      issues: z.ZodIssue[];
    };
    error.code = "VALIDATION_ERROR";
    error.issues = result.error.issues;
    throw error;
  }
  return result.data;
}

/**
 * Create a validation error response.
 */
export function validationErrorResponse(error: z.ZodError): ValidationError {
  const firstIssue = error.issues[0];
  const path = firstIssue?.path.join(".") || "request";
  const message = firstIssue?.message || "Invalid request";

  return {
    error: `${path}: ${message}`,
    code: "VALIDATION_ERROR",
    details: error.issues,
  };
}
