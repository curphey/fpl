import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "fpl.db");

// Create database connection
export const db = new Database(dbPath);

// Retry for up to 10s before failing with SQLITE_BUSY (needed for concurrent Next.js build workers)
db.pragma("busy_timeout = 10000");

// Enable WAL mode for better concurrent access
db.pragma("journal_mode = WAL");

// Initialize all tables
db.exec(`
  -- Sessions: Track browser sessions with their FPL manager ID
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    fpl_manager_id INTEGER,
    display_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Manager cache: Cache FPL manager data to reduce API calls
  CREATE TABLE IF NOT EXISTS manager_cache (
    manager_id INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    cached_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Notification preferences: Per-session notification settings
  CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    email_enabled INTEGER DEFAULT 0,
    email_address TEXT,
    email_deadline_reminder INTEGER DEFAULT 1,
    email_deadline_hours INTEGER DEFAULT 24,
    email_weekly_summary INTEGER DEFAULT 1,
    email_transfer_recommendations INTEGER DEFAULT 0,
    push_enabled INTEGER DEFAULT 0,
    push_subscription TEXT,
    push_deadline_reminder INTEGER DEFAULT 1,
    push_deadline_hours INTEGER DEFAULT 1,
    push_price_changes INTEGER DEFAULT 1,
    push_injury_news INTEGER DEFAULT 1,
    push_league_updates INTEGER DEFAULT 0,
    quiet_hours_start INTEGER,
    quiet_hours_end INTEGER,
    timezone TEXT DEFAULT 'Europe/London',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- Notification history: Log of sent notifications
  CREATE TABLE IF NOT EXISTS notification_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data TEXT,
    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- App settings: Global application settings (API keys, etc.)
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_sessions_manager ON sessions(fpl_manager_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_session ON notification_preferences(session_id);
  CREATE INDEX IF NOT EXISTS idx_history_session ON notification_history(session_id, sent_at DESC);
  CREATE INDEX IF NOT EXISTS idx_manager_cache_time ON manager_cache(cached_at);

  -- GW plans: Cached Claude-generated gameweek plans
  CREATE TABLE IF NOT EXISTS gw_plans (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    gameweek INTEGER NOT NULL,
    plan_json TEXT NOT NULL,
    thinking TEXT,
    generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_gw_plans_session_gw ON gw_plans(session_id, gameweek);

  -- Transfer predictions: Per-transfer tracking (predicted vs actual over 4 GWs)
  CREATE TABLE IF NOT EXISTS transfer_predictions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    gameweek_made INTEGER NOT NULL,
    player_out_id INTEGER NOT NULL,
    player_out_name TEXT NOT NULL,
    player_in_id INTEGER NOT NULL,
    player_in_name TEXT NOT NULL,
    predicted_gain_pts REAL NOT NULL,
    actual_gain_pts REAL,
    gw_actuals TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    reasoning TEXT,
    tracking_notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_transfer_predictions_session
    ON transfer_predictions(session_id, gameweek_made DESC);
`);
