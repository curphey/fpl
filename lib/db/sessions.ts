import { db } from "./client";
import { v4 as uuid } from "uuid";

export interface Session {
  id: string;
  fpl_manager_id: number | null;
  display_name: string | null;
  created_at: string;
  last_seen_at: string;
}

export function createSession(): Session {
  const id = uuid();
  db.prepare("INSERT INTO sessions (id) VALUES (?)").run(id);
  return getSession(id)!;
}

export function getSession(id: string): Session | null {
  return db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(id) as Session | null;
}

export function updateSession(
  id: string,
  data: { fpl_manager_id?: number | null; display_name?: string | null },
) {
  const updates: string[] = ["last_seen_at = CURRENT_TIMESTAMP"];
  const values: (string | number | null)[] = [];

  if (data.fpl_manager_id !== undefined) {
    updates.push("fpl_manager_id = ?");
    values.push(data.fpl_manager_id);
  }
  if (data.display_name !== undefined) {
    updates.push("display_name = ?");
    values.push(data.display_name);
  }
  values.push(id);

  db.prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`).run(
    ...values,
  );
}

export function touchSession(id: string) {
  db.prepare(
    "UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(id);
}

export function cleanupOldSessions(daysOld: number = 90) {
  db.prepare(
    'DELETE FROM sessions WHERE last_seen_at < datetime("now", ? || " days")',
  ).run(-daysOld);
}
