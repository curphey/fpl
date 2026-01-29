"use client";

import { useNotificationHistory } from "@/lib/notifications/hooks";
import type {
  NotificationHistory,
  NotificationType,
} from "@/lib/notifications/types";
import { Card, CardContent } from "@/components/ui/card";

const typeLabels: Record<NotificationType, { label: string; color: string }> = {
  deadline: { label: "Deadline", color: "bg-yellow-500/20 text-yellow-400" },
  price_change: { label: "Price", color: "bg-fpl-green/20 text-fpl-green" },
  injury: { label: "Injury", color: "bg-fpl-danger/20 text-fpl-danger" },
  transfer_rec: { label: "Transfer", color: "bg-blue-500/20 text-blue-400" },
  league_update: { label: "League", color: "bg-purple-500/20 text-purple-400" },
};

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: NotificationHistory;
  onMarkRead: (id: string) => void;
}) {
  const typeInfo = typeLabels[notification.notification_type];
  const isUnread = !notification.read_at;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        isUnread
          ? "border-fpl-green/30 bg-fpl-green/5"
          : "border-fpl-border bg-fpl-card"
      }`}
      onClick={() => isUnread && onMarkRead(notification.id)}
      role={isUnread ? "button" : undefined}
    >
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full ${typeInfo.color}`}
      >
        {notification.channel === "email" ? (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${typeInfo.color}`}
          >
            {typeInfo.label}
          </span>
          {isUnread && <span className="h-2 w-2 rounded-full bg-fpl-green" />}
          <span className="ml-auto text-xs text-fpl-muted">
            {formatTime(notification.sent_at)}
          </span>
        </div>
        <div className="mt-1 font-medium">{notification.title}</div>
        <div className="mt-0.5 text-sm text-fpl-muted line-clamp-2">
          {notification.body}
        </div>
      </div>
    </div>
  );
}

export function NotificationHistoryList() {
  const { history, isLoading, error, markAsRead } = useNotificationHistory(50);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-fpl-border"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-sm text-fpl-danger">
            {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-fpl-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="mt-4 text-sm text-fpl-muted">No notifications yet</p>
            <p className="mt-1 text-xs text-fpl-muted">
              Enable notifications to receive updates about your FPL team
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const unreadCount = history.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-fpl-muted">{unreadCount} unread</span>
          <button
            onClick={() =>
              history.filter((n) => !n.read_at).forEach((n) => markAsRead(n.id))
            }
            className="text-xs text-fpl-green hover:underline"
          >
            Mark all as read
          </button>
        </div>
      )}

      <div className="space-y-3">
        {history.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={markAsRead}
          />
        ))}
      </div>
    </div>
  );
}
