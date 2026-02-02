import { db } from "./client";

export function getSetting(key: string): string | null {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null): void {
  if (value === null) {
    db.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
  } else {
    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
    ).run(key, value, value);
  }
}

export function getAllSettings(): Record<string, string> {
  const rows = db
    .prepare("SELECT key, value FROM app_settings")
    .all() as Array<{
    key: string;
    value: string;
  }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Convenience functions for specific settings
export function getAnthropicApiKey(): string | null {
  // Check database first, then fall back to environment variable
  const dbKey = getSetting("anthropic_api_key");
  if (dbKey) return dbKey;
  return process.env.ANTHROPIC_API_KEY || null;
}

export function setAnthropicApiKey(key: string | null): void {
  setSetting("anthropic_api_key", key);
}

export function hasAnthropicApiKey(): boolean {
  return getAnthropicApiKey() !== null;
}
