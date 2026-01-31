export interface NotificationPreferences {
  id: string;
  user_id: string;

  // Email preferences
  email_enabled: boolean;
  email_address: string | null;
  email_deadline_reminder: boolean;
  email_deadline_hours: number;
  email_weekly_summary: boolean;
  email_transfer_recommendations: boolean;

  // Push notification preferences
  push_enabled: boolean;
  push_subscription: PushSubscriptionJSON | null;
  push_deadline_reminder: boolean;
  push_deadline_hours: number;
  push_price_changes: boolean;
  push_injury_news: boolean;
  push_league_updates: boolean;

  // General settings
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string;

  created_at: string;
  updated_at: string;
}

export interface NotificationHistory {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  sent_at: string;
  read_at: string | null;
  clicked_at: string | null;
}

export type NotificationType =
  | "deadline"
  | "price_change"
  | "injury"
  | "transfer_rec"
  | "league_update"
  | "weekly_summary";

export type NotificationChannel = "email" | "push";

export interface NotificationPreferencesUpdate {
  email_enabled?: boolean;
  email_address?: string | null;
  email_deadline_reminder?: boolean;
  email_deadline_hours?: number;
  email_weekly_summary?: boolean;
  email_transfer_recommendations?: boolean;

  push_enabled?: boolean;
  push_subscription?: PushSubscriptionJSON | null;
  push_deadline_reminder?: boolean;
  push_deadline_hours?: number;
  push_price_changes?: boolean;
  push_injury_news?: boolean;
  push_league_updates?: boolean;

  quiet_hours_start?: number | null;
  quiet_hours_end?: number | null;
  timezone?: string;
}

// Notification payload for sending
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  url?: string;
}

// Web Push subscription JSON format
export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Email notification template data
export interface DeadlineReminderData {
  gameweek: number;
  deadline: string;
  hoursRemaining: number;
  transfers_made: number;
  captain: string;
}

export interface PriceChangeData {
  player_name: string;
  team: string;
  direction: "rise" | "fall";
  probability: number;
  current_price: number;
  owned: boolean;
}

export interface InjuryNewsData {
  player_name: string;
  team: string;
  status: string;
  news: string;
  chance_of_playing: number | null;
}

export interface LeagueUpdateData {
  league_name: string;
  gameweek: number;
  your_rank: number;
  rank_change: number;
  points_scored: number;
  gap_to_leader: number;
}

export interface WeeklySummaryData {
  manager_name: string;
  gameweek: number;

  // Gameweek recap
  gw_points: number;
  gw_rank: number;
  overall_points: number;
  overall_rank: number;
  rank_change: number;
  captain_name: string;
  captain_points: number;

  // AI-generated sections
  ai_recap: string;
  ai_transfer_suggestions: string;
  ai_captain_picks: string;
  ai_chip_advice: string;

  // Price alerts
  price_risers: Array<{ name: string; team: string; probability: number }>;
  price_fallers: Array<{ name: string; team: string; probability: number }>;

  // Mini-league summary
  leagues: Array<{
    name: string;
    rank: number;
    rank_change: number;
    top_rival: string;
    gap_to_top: number;
  }>;
}
