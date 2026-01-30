/**
 * Runtime type guards for FPL API responses.
 * Provides validation for external API data to catch malformed responses early.
 */

import type {
  BootstrapStatic,
  Gameweek,
  Team,
  Player,
  Fixture,
  ManagerEntry,
  ManagerHistory,
  ManagerPicks,
  LiveGameweek,
  ElementSummary,
} from "./types";

/**
 * Check if a value is a non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Check if a value is a number.
 */
function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Check if a value is a string.
 */
function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Check if a value is an array.
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard for Gameweek.
 */
export function isGameweek(value: unknown): value is Gameweek {
  if (!isObject(value)) return false;
  return (
    isNumber(value.id) &&
    isString(value.name) &&
    isString(value.deadline_time) &&
    typeof value.finished === "boolean" &&
    typeof value.is_current === "boolean" &&
    typeof value.is_next === "boolean"
  );
}

/**
 * Type guard for Team.
 */
export function isTeam(value: unknown): value is Team {
  if (!isObject(value)) return false;
  return (
    isNumber(value.id) &&
    isString(value.name) &&
    isString(value.short_name) &&
    isNumber(value.strength)
  );
}

/**
 * Type guard for Player.
 */
export function isPlayer(value: unknown): value is Player {
  if (!isObject(value)) return false;
  return (
    isNumber(value.id) &&
    isString(value.web_name) &&
    isNumber(value.team) &&
    isNumber(value.element_type) &&
    isNumber(value.now_cost) &&
    isNumber(value.total_points)
  );
}

/**
 * Type guard for BootstrapStatic.
 */
export function isBootstrapStatic(value: unknown): value is BootstrapStatic {
  if (!isObject(value)) return false;
  if (
    !isArray(value.events) ||
    !isArray(value.teams) ||
    !isArray(value.elements)
  ) {
    return false;
  }
  // Validate at least first item of each array
  if (value.events.length > 0 && !isGameweek(value.events[0])) return false;
  if (value.teams.length > 0 && !isTeam(value.teams[0])) return false;
  if (value.elements.length > 0 && !isPlayer(value.elements[0])) return false;
  return true;
}

/**
 * Type guard for Fixture.
 */
export function isFixture(value: unknown): value is Fixture {
  if (!isObject(value)) return false;
  return (
    isNumber(value.id) &&
    isNumber(value.team_h) &&
    isNumber(value.team_a) &&
    isNumber(value.team_h_difficulty) &&
    isNumber(value.team_a_difficulty)
  );
}

/**
 * Type guard for Fixture array.
 */
export function isFixtureArray(value: unknown): value is Fixture[] {
  if (!isArray(value)) return false;
  if (value.length === 0) return true;
  return isFixture(value[0]);
}

/**
 * Type guard for ManagerEntry.
 */
export function isManagerEntry(value: unknown): value is ManagerEntry {
  if (!isObject(value)) return false;
  return (
    isNumber(value.id) &&
    isString(value.player_first_name) &&
    isString(value.player_last_name) &&
    isString(value.name)
  );
}

/**
 * Type guard for ManagerHistory.
 */
export function isManagerHistory(value: unknown): value is ManagerHistory {
  if (!isObject(value)) return false;
  return isArray(value.current) && isArray(value.past) && isArray(value.chips);
}

/**
 * Type guard for ManagerPicks.
 */
export function isManagerPicks(value: unknown): value is ManagerPicks {
  if (!isObject(value)) return false;
  if (!isArray(value.picks)) return false;
  if (value.picks.length > 0) {
    const firstPick = value.picks[0] as Record<string, unknown>;
    if (!isNumber(firstPick.element) || !isNumber(firstPick.position)) {
      return false;
    }
  }
  return true;
}

/**
 * Type guard for LiveGameweek.
 */
export function isLiveGameweek(value: unknown): value is LiveGameweek {
  if (!isObject(value)) return false;
  return isArray(value.elements);
}

/**
 * Type guard for ElementSummary.
 */
export function isElementSummary(value: unknown): value is ElementSummary {
  if (!isObject(value)) return false;
  return isArray(value.fixtures) && isArray(value.history);
}

/**
 * Validate and return typed data, or throw an error.
 */
export function assertBootstrapStatic(value: unknown): BootstrapStatic {
  if (!isBootstrapStatic(value)) {
    throw new Error("Invalid BootstrapStatic response from FPL API");
  }
  return value;
}

/**
 * Validate and return typed fixture array, or throw an error.
 */
export function assertFixtureArray(value: unknown): Fixture[] {
  if (!isFixtureArray(value)) {
    throw new Error("Invalid Fixture array response from FPL API");
  }
  return value;
}

/**
 * Validate and return typed manager entry, or throw an error.
 */
export function assertManagerEntry(value: unknown): ManagerEntry {
  if (!isManagerEntry(value)) {
    throw new Error("Invalid ManagerEntry response from FPL API");
  }
  return value;
}

/**
 * Validate and return typed manager history, or throw an error.
 */
export function assertManagerHistory(value: unknown): ManagerHistory {
  if (!isManagerHistory(value)) {
    throw new Error("Invalid ManagerHistory response from FPL API");
  }
  return value;
}

/**
 * Validate and return typed manager picks, or throw an error.
 */
export function assertManagerPicks(value: unknown): ManagerPicks {
  if (!isManagerPicks(value)) {
    throw new Error("Invalid ManagerPicks response from FPL API");
  }
  return value;
}

/**
 * Validate and return typed live gameweek, or throw an error.
 */
export function assertLiveGameweek(value: unknown): LiveGameweek {
  if (!isLiveGameweek(value)) {
    throw new Error("Invalid LiveGameweek response from FPL API");
  }
  return value;
}

/**
 * Validate and return typed element summary, or throw an error.
 */
export function assertElementSummary(value: unknown): ElementSummary {
  if (!isElementSummary(value)) {
    throw new Error("Invalid ElementSummary response from FPL API");
  }
  return value;
}
