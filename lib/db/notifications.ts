import { db } from "./client";
import { v4 as uuid } from "uuid";

export interface NotificationPreference {
  id: string;
  session_id: string;
  email_enabled: boolean;
  email_address: string | null;
  email_deadline_reminder: boolean;
  email_deadline_hours: number;
  email_weekly_summary: boolean;
  email_transfer_recommendations: boolean;
  push_enabled: boolean;
  push_subscription: string | null;
  push_deadline_reminder: boolean;
  push_deadline_hours: number;
  push_price_changes: boolean;
  push_injury_news: boolean;
  push_league_updates: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationHistoryEntry {
  id: string;
  session_id: string;
  notification_type: string;
  channel: string;
  title: string;
  body: string | null;
  data: string | null;
  sent_at: string;
  read_at: string | null;
}

// SQLite stores booleans as integers, so we need to convert
function convertPreference(
  row: Record<string, unknown> | undefined,
): NotificationPreference | null {
  if (!row) return null;
  return {
    ...row,
    email_enabled: Boolean(row.email_enabled),
    email_deadline_reminder: Boolean(row.email_deadline_reminder),
    email_weekly_summary: Boolean(row.email_weekly_summary),
    email_transfer_recommendations: Boolean(row.email_transfer_recommendations),
    push_enabled: Boolean(row.push_enabled),
    push_deadline_reminder: Boolean(row.push_deadline_reminder),
    push_price_changes: Boolean(row.push_price_changes),
    push_injury_news: Boolean(row.push_injury_news),
    push_league_updates: Boolean(row.push_league_updates),
  } as NotificationPreference;
}

export function getPreferenceBySession(
  sessionId: string,
): NotificationPreference | null {
  const row = db
    .prepare("SELECT * FROM notification_preferences WHERE session_id = ?")
    .get(sessionId) as Record<string, unknown> | undefined;
  return convertPreference(row);
}

export function upsertPreference(
  sessionId: string,
  data: Partial<Omit<NotificationPreference, "id" | "session_id">>,
) {
  const existing = getPreferenceBySession(sessionId);
  if (existing) {
    // Update existing
    const fields = Object.keys(data);
    if (fields.length === 0) return;
    const sql = `UPDATE notification_preferences SET ${fields.map((f) => `${f} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`;
    db.prepare(sql).run(
      ...fields.map((f) => {
        const value = data[f as keyof typeof data];
        // Convert booleans to integers for SQLite
        if (typeof value === "boolean") return value ? 1 : 0;
        return value;
      }),
      sessionId,
    );
  } else {
    // Insert new with defaults
    const id = uuid();
    db.prepare(
      "INSERT INTO notification_preferences (id, session_id) VALUES (?, ?)",
    ).run(id, sessionId);
    // If we have data to set, recurse to update
    if (Object.keys(data).length > 0) {
      upsertPreference(sessionId, data);
    }
  }
}

export function getAllEnabledPushSubscriptions(): Array<
  NotificationPreference & { fpl_manager_id: number | null }
> {
  const rows = db
    .prepare(
      `
    SELECT np.*, s.fpl_manager_id
    FROM notification_preferences np
    JOIN sessions s ON np.session_id = s.id
    WHERE np.push_enabled = 1 AND np.push_subscription IS NOT NULL
  `,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    ...convertPreference(row)!,
    fpl_manager_id: row.fpl_manager_id as number | null,
  }));
}

export function getAllEnabledEmailSubscriptions(): Array<
  NotificationPreference & { fpl_manager_id: number | null }
> {
  const rows = db
    .prepare(
      `
    SELECT np.*, s.fpl_manager_id
    FROM notification_preferences np
    JOIN sessions s ON np.session_id = s.id
    WHERE np.email_enabled = 1 AND np.email_address IS NOT NULL
  `,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    ...convertPreference(row)!,
    fpl_manager_id: row.fpl_manager_id as number | null,
  }));
}

export function logNotification(
  sessionId: string,
  type: string,
  channel: string,
  title: string,
  body: string,
  data?: object,
) {
  db.prepare(
    "INSERT INTO notification_history (id, session_id, notification_type, channel, title, body, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    uuid(),
    sessionId,
    type,
    channel,
    title,
    body,
    data ? JSON.stringify(data) : null,
  );
}

export function getNotificationHistory(
  sessionId: string,
  limit: number = 50,
): NotificationHistoryEntry[] {
  return db
    .prepare(
      "SELECT * FROM notification_history WHERE session_id = ? ORDER BY sent_at DESC LIMIT ?",
    )
    .all(sessionId, limit) as NotificationHistoryEntry[];
}

export function markNotificationRead(id: string, sessionId: string) {
  db.prepare(
    "UPDATE notification_history SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND session_id = ?",
  ).run(id, sessionId);
}
