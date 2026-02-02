import { db } from "./client";

const CACHE_TTL_MINUTES = 5;

export function getCachedManager<T = unknown>(managerId: number): T | null {
  const row = db
    .prepare(
      `
    SELECT data FROM manager_cache
    WHERE manager_id = ?
    AND cached_at > datetime('now', '-${CACHE_TTL_MINUTES} minutes')
  `,
    )
    .get(managerId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function setCachedManager(managerId: number, data: object) {
  db.prepare(
    `
    INSERT OR REPLACE INTO manager_cache (manager_id, data, cached_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `,
  ).run(managerId, JSON.stringify(data));
}

export function cleanupOldCache(hoursOld: number = 24) {
  db.prepare(
    'DELETE FROM manager_cache WHERE cached_at < datetime("now", ? || " hours")',
  ).run(-hoursOld);
}
