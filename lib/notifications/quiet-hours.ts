import type { NotificationPreferences, NotificationType } from "./types";

/**
 * Check if current time is within quiet hours for a user
 */
export function isInQuietHours(
  preferences: NotificationPreferences,
  now: Date = new Date(),
): boolean {
  const { quiet_hours_start, quiet_hours_end, timezone } = preferences;

  // No quiet hours configured
  if (quiet_hours_start === null || quiet_hours_end === null) {
    return false;
  }

  // Get current hour in user's timezone
  let currentHour: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone || "UTC",
    });
    currentHour = parseInt(formatter.format(now), 10);
  } catch {
    // Invalid timezone, fall back to UTC
    currentHour = now.getUTCHours();
  }

  // Handle quiet hours that span midnight (e.g., 22:00 to 07:00)
  if (quiet_hours_start > quiet_hours_end) {
    // Quiet if current hour is >= start OR < end
    return currentHour >= quiet_hours_start || currentHour < quiet_hours_end;
  }

  // Normal range (e.g., 00:00 to 08:00)
  return currentHour >= quiet_hours_start && currentHour < quiet_hours_end;
}

/**
 * Notification types that should respect quiet hours
 */
const QUIET_HOURS_TYPES: NotificationType[] = [
  "price_change",
  "injury",
  "league_update",
  "transfer_rec",
  "weekly_summary",
];

/**
 * Notification types that bypass quiet hours (urgent)
 */
const BYPASS_QUIET_HOURS_TYPES: NotificationType[] = [
  "deadline", // Deadline reminders are always urgent
];

/**
 * Check if a notification type should respect quiet hours
 */
export function shouldRespectQuietHours(type: NotificationType): boolean {
  if (BYPASS_QUIET_HOURS_TYPES.includes(type)) {
    return false;
  }
  return QUIET_HOURS_TYPES.includes(type);
}

/**
 * Filter users who are not in quiet hours
 */
export function filterByQuietHours<
  T extends { preferences: NotificationPreferences },
>(users: T[], type: NotificationType, now: Date = new Date()): T[] {
  // If this notification type bypasses quiet hours, return all users
  if (!shouldRespectQuietHours(type)) {
    return users;
  }

  return users.filter((user) => !isInQuietHours(user.preferences, now));
}

/**
 * Get next send time for a user (after quiet hours end)
 */
export function getNextSendTime(
  preferences: NotificationPreferences,
  now: Date = new Date(),
): Date | null {
  if (!isInQuietHours(preferences, now)) {
    return null; // Not in quiet hours, can send now
  }

  const { quiet_hours_end, timezone } = preferences;
  if (quiet_hours_end === null) {
    return null;
  }

  // Create a date for the next time quiet hours end
  const nextSend = new Date(now);

  // Get the target hour in the user's timezone
  let currentHour: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone || "UTC",
    });
    currentHour = parseInt(formatter.format(now), 10);
  } catch {
    currentHour = now.getUTCHours();
  }

  // Calculate hours until quiet hours end
  let hoursUntilEnd: number;
  if (currentHour >= quiet_hours_end) {
    // Quiet hours end tomorrow
    hoursUntilEnd = 24 - currentHour + quiet_hours_end;
  } else {
    hoursUntilEnd = quiet_hours_end - currentHour;
  }

  nextSend.setHours(nextSend.getHours() + hoursUntilEnd);
  nextSend.setMinutes(0);
  nextSend.setSeconds(0);
  nextSend.setMilliseconds(0);

  return nextSend;
}
