/**
 * Notification system barrel exports
 */

// Types
export type {
  NotificationPreferences,
  NotificationHistory,
  NotificationType,
  NotificationChannel,
  NotificationPreferencesUpdate,
  NotificationPayload,
  PushSubscriptionJSON,
  DeadlineReminderData,
  PriceChangeData,
  InjuryNewsData,
  LeagueUpdateData,
} from "./types";

// Hooks
export {
  useNotificationPreferences,
  useNotificationHistory,
  usePushNotificationStatus,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "./hooks";

// Email client
export type { EmailPayload, EmailResult } from "./email-client";
export { sendEmail, sendBatchEmails } from "./email-client";

// Quiet hours utilities
export {
  isInQuietHours,
  shouldRespectQuietHours,
  filterByQuietHours,
  getNextSendTime,
} from "./quiet-hours";
