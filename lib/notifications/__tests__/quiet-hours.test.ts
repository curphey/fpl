import { describe, it, expect } from "vitest";
import type { NotificationPreferences, NotificationType } from "../types";
import {
  isInQuietHours,
  shouldRespectQuietHours,
  filterByQuietHours,
  getNextSendTime,
} from "../quiet-hours";

/**
 * Creates a mock notification preferences object for testing.
 */
function createMockPreferences(
  overrides: Partial<NotificationPreferences> = {},
): NotificationPreferences {
  return {
    id: "test-id",
    user_id: "user-123",
    email_enabled: true,
    email_address: "test@example.com",
    email_deadline_reminder: true,
    email_deadline_hours: 24,
    email_weekly_summary: true,
    email_transfer_recommendations: true,
    push_enabled: true,
    push_subscription: null,
    push_deadline_reminder: true,
    push_deadline_hours: 1,
    push_price_changes: true,
    push_injury_news: true,
    push_league_updates: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: "UTC",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// isInQuietHours Tests
// =============================================================================

describe("isInQuietHours", () => {
  describe("when quiet hours not configured", () => {
    it("returns false when start is null", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: null,
        quiet_hours_end: 8,
      });

      expect(isInQuietHours(prefs)).toBe(false);
    });

    it("returns false when end is null", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: null,
      });

      expect(isInQuietHours(prefs)).toBe(false);
    });

    it("returns false when both are null", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: null,
        quiet_hours_end: null,
      });

      expect(isInQuietHours(prefs)).toBe(false);
    });
  });

  describe("same-day range (e.g., 00:00 to 08:00)", () => {
    it("returns true during quiet hours", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 0,
        quiet_hours_end: 8,
        timezone: "UTC",
      });

      // 3:00 AM UTC
      const now = new Date("2024-01-15T03:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });

    it("returns false outside quiet hours", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 0,
        quiet_hours_end: 8,
        timezone: "UTC",
      });

      // 10:00 AM UTC
      const now = new Date("2024-01-15T10:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(false);
    });

    it("returns true at exact start time", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 0,
        quiet_hours_end: 8,
        timezone: "UTC",
      });

      const now = new Date("2024-01-15T00:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });

    it("returns false at exact end time (end is exclusive)", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 0,
        quiet_hours_end: 8,
        timezone: "UTC",
      });

      const now = new Date("2024-01-15T08:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(false);
    });

    it("returns true one minute before end", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 0,
        quiet_hours_end: 8,
        timezone: "UTC",
      });

      const now = new Date("2024-01-15T07:59:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });
  });

  describe("overnight range (e.g., 22:00 to 07:00)", () => {
    it("returns true during late evening", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "UTC",
      });

      // 23:00 UTC
      const now = new Date("2024-01-15T23:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });

    it("returns true during early morning", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "UTC",
      });

      // 03:00 UTC
      const now = new Date("2024-01-15T03:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });

    it("returns false during daytime", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "UTC",
      });

      // 10:00 UTC
      const now = new Date("2024-01-15T10:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(false);
    });

    it("returns true at exact start time (22:00)", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "UTC",
      });

      const now = new Date("2024-01-15T22:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });

    it("returns false at exact end time (07:00)", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "UTC",
      });

      const now = new Date("2024-01-15T07:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(false);
    });

    it("returns false at 21:00 (before start)", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "UTC",
      });

      const now = new Date("2024-01-15T21:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(false);
    });

    it("returns false at 08:00 (after end)", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "UTC",
      });

      const now = new Date("2024-01-15T08:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(false);
    });
  });

  describe("timezone handling", () => {
    it("handles different timezones correctly", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "America/New_York",
      });

      // 4:00 AM UTC = 11:00 PM EST (previous day) = in quiet hours
      const now = new Date("2024-01-15T04:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);

      // 1:00 PM UTC = 8:00 AM EST = outside quiet hours
      const now2 = new Date("2024-01-15T13:00:00Z");
      expect(isInQuietHours(prefs, now2)).toBe(false);
    });

    it("falls back to UTC for invalid timezone", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 0,
        quiet_hours_end: 8,
        timezone: "Invalid/Timezone",
      });

      // 3:00 AM UTC - should be in quiet hours using UTC fallback
      const now = new Date("2024-01-15T03:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });

    it("handles empty timezone string", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 0,
        quiet_hours_end: 8,
        timezone: "",
      });

      // Should fall back to UTC
      const now = new Date("2024-01-15T03:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles midnight exactly", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 22,
        quiet_hours_end: 7,
        timezone: "UTC",
      });

      const now = new Date("2024-01-15T00:00:00Z");
      expect(isInQuietHours(prefs, now)).toBe(true);
    });

    it("handles 1-hour quiet window", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 3,
        quiet_hours_end: 4,
        timezone: "UTC",
      });

      expect(isInQuietHours(prefs, new Date("2024-01-15T03:30:00Z"))).toBe(
        true,
      );
      expect(isInQuietHours(prefs, new Date("2024-01-15T04:00:00Z"))).toBe(
        false,
      );
    });

    it("handles same start and end (should be false)", () => {
      const prefs = createMockPreferences({
        quiet_hours_start: 8,
        quiet_hours_end: 8,
        timezone: "UTC",
      });

      // When start equals end, the range is empty
      expect(isInQuietHours(prefs, new Date("2024-01-15T08:00:00Z"))).toBe(
        false,
      );
    });
  });
});

// =============================================================================
// shouldRespectQuietHours Tests
// =============================================================================

describe("shouldRespectQuietHours", () => {
  describe("urgent notification types", () => {
    it("returns false for deadline notifications", () => {
      expect(shouldRespectQuietHours("deadline")).toBe(false);
    });
  });

  describe("non-urgent notification types", () => {
    it("returns true for price_change notifications", () => {
      expect(shouldRespectQuietHours("price_change")).toBe(true);
    });

    it("returns true for injury notifications", () => {
      expect(shouldRespectQuietHours("injury")).toBe(true);
    });

    it("returns true for league_update notifications", () => {
      expect(shouldRespectQuietHours("league_update")).toBe(true);
    });

    it("returns true for transfer_rec notifications", () => {
      expect(shouldRespectQuietHours("transfer_rec")).toBe(true);
    });

    it("returns true for weekly_summary notifications", () => {
      expect(shouldRespectQuietHours("weekly_summary")).toBe(true);
    });
  });
});

// =============================================================================
// filterByQuietHours Tests
// =============================================================================

describe("filterByQuietHours", () => {
  it("returns all users for deadline notifications (bypass)", () => {
    const users = [
      {
        id: 1,
        preferences: createMockPreferences({
          quiet_hours_start: 0,
          quiet_hours_end: 8,
        }),
      },
      {
        id: 2,
        preferences: createMockPreferences({
          quiet_hours_start: 22,
          quiet_hours_end: 7,
        }),
      },
    ];

    // 3:00 AM UTC - both users are in quiet hours
    const now = new Date("2024-01-15T03:00:00Z");
    const filtered = filterByQuietHours(users, "deadline", now);

    // But deadline bypasses quiet hours, so all users returned
    expect(filtered).toHaveLength(2);
  });

  it("filters out users in quiet hours for price_change", () => {
    const users = [
      {
        id: 1,
        preferences: createMockPreferences({
          quiet_hours_start: 0,
          quiet_hours_end: 8,
          timezone: "UTC",
        }),
      },
      {
        id: 2,
        preferences: createMockPreferences({
          quiet_hours_start: null,
          quiet_hours_end: null,
        }),
      },
    ];

    // 3:00 AM UTC - user 1 is in quiet hours, user 2 has no quiet hours
    const now = new Date("2024-01-15T03:00:00Z");
    const filtered = filterByQuietHours(users, "price_change", now);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });

  it("returns all users when none are in quiet hours", () => {
    const users = [
      {
        id: 1,
        preferences: createMockPreferences({
          quiet_hours_start: 22,
          quiet_hours_end: 6,
          timezone: "UTC",
        }),
      },
      {
        id: 2,
        preferences: createMockPreferences({
          quiet_hours_start: 23,
          quiet_hours_end: 5,
          timezone: "UTC",
        }),
      },
    ];

    // 12:00 PM UTC - both users are outside quiet hours
    const now = new Date("2024-01-15T12:00:00Z");
    const filtered = filterByQuietHours(users, "price_change", now);

    expect(filtered).toHaveLength(2);
  });

  it("returns empty array when all users in quiet hours", () => {
    const users = [
      {
        id: 1,
        preferences: createMockPreferences({
          quiet_hours_start: 0,
          quiet_hours_end: 8,
          timezone: "UTC",
        }),
      },
      {
        id: 2,
        preferences: createMockPreferences({
          quiet_hours_start: 22,
          quiet_hours_end: 7,
          timezone: "UTC",
        }),
      },
    ];

    // 3:00 AM UTC - both users in quiet hours
    const now = new Date("2024-01-15T03:00:00Z");
    const filtered = filterByQuietHours(users, "injury", now);

    expect(filtered).toHaveLength(0);
  });

  it("handles mixed timezone users", () => {
    const users = [
      {
        id: 1,
        preferences: createMockPreferences({
          quiet_hours_start: 22,
          quiet_hours_end: 7,
          timezone: "UTC",
        }),
      },
      {
        id: 2,
        preferences: createMockPreferences({
          quiet_hours_start: 22,
          quiet_hours_end: 7,
          timezone: "America/Los_Angeles", // PST is UTC-8
        }),
      },
    ];

    // 15:00 UTC = 7:00 AM PST
    // User 1 (UTC): 15:00 is outside 22:00-07:00
    // User 2 (PST): 07:00 is at end of quiet hours (excluded)
    const now = new Date("2024-01-15T15:00:00Z");
    const filtered = filterByQuietHours(users, "league_update", now);

    expect(filtered).toHaveLength(2);
  });

  it("handles empty users array", () => {
    const filtered = filterByQuietHours([], "price_change");
    expect(filtered).toHaveLength(0);
  });
});

// =============================================================================
// getNextSendTime Tests
// =============================================================================

describe("getNextSendTime", () => {
  it("returns null when not in quiet hours", () => {
    const prefs = createMockPreferences({
      quiet_hours_start: 22,
      quiet_hours_end: 7,
      timezone: "UTC",
    });

    // 12:00 PM UTC - outside quiet hours
    const now = new Date("2024-01-15T12:00:00Z");
    expect(getNextSendTime(prefs, now)).toBeNull();
  });

  it("returns null when quiet hours not configured", () => {
    const prefs = createMockPreferences({
      quiet_hours_start: null,
      quiet_hours_end: null,
    });

    const now = new Date("2024-01-15T03:00:00Z");
    expect(getNextSendTime(prefs, now)).toBeNull();
  });

  it("returns null when only start is configured", () => {
    const prefs = createMockPreferences({
      quiet_hours_start: 22,
      quiet_hours_end: null,
    });

    const now = new Date("2024-01-15T23:00:00Z");
    expect(getNextSendTime(prefs, now)).toBeNull();
  });

  it("returns next send time for same-day quiet hours", () => {
    const prefs = createMockPreferences({
      quiet_hours_start: 0,
      quiet_hours_end: 8,
      timezone: "UTC",
    });

    // 3:00 AM UTC - 5 hours until quiet hours end
    const now = new Date("2024-01-15T03:00:00Z");
    const nextSend = getNextSendTime(prefs, now);

    expect(nextSend).not.toBeNull();
    expect(nextSend!.getUTCHours()).toBe(8);
  });

  it("returns next send time for overnight quiet hours (late evening)", () => {
    const prefs = createMockPreferences({
      quiet_hours_start: 22,
      quiet_hours_end: 7,
      timezone: "UTC",
    });

    // 23:00 UTC - 8 hours until quiet hours end at 07:00
    const now = new Date("2024-01-15T23:00:00Z");
    const nextSend = getNextSendTime(prefs, now);

    expect(nextSend).not.toBeNull();
    const diffHours = (nextSend!.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(8, 0);
  });

  it("returns next send time for overnight quiet hours (early morning)", () => {
    const prefs = createMockPreferences({
      quiet_hours_start: 22,
      quiet_hours_end: 7,
      timezone: "UTC",
    });

    // 03:00 UTC - 4 hours until quiet hours end at 07:00
    const now = new Date("2024-01-15T03:00:00Z");
    const nextSend = getNextSendTime(prefs, now);

    expect(nextSend).not.toBeNull();
    const diffHours = (nextSend!.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(4, 0);
  });

  it("sets minutes and seconds to zero", () => {
    const prefs = createMockPreferences({
      quiet_hours_start: 0,
      quiet_hours_end: 8,
      timezone: "UTC",
    });

    const now = new Date("2024-01-15T03:45:30.123Z");
    const nextSend = getNextSendTime(prefs, now);

    expect(nextSend).not.toBeNull();
    expect(nextSend!.getMinutes()).toBe(0);
    expect(nextSend!.getSeconds()).toBe(0);
    expect(nextSend!.getMilliseconds()).toBe(0);
  });
});
