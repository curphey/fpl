"use client";

import { useState, useEffect, useCallback } from "react";
import { useManagerContext } from "@/lib/fpl/manager-context";
import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
  NotificationHistory,
} from "./types";

interface UseNotificationPreferencesResult {
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: Error | null;
  updatePreferences: (updates: NotificationPreferencesUpdate) => Promise<void>;
  refetch: () => void;
}

export function useNotificationPreferences(): UseNotificationPreferencesResult {
  const { sessionId } = useManagerContext();
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPreferences() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/notifications/preferences?sessionId=${encodeURIComponent(sessionId!)}`,
        );

        if (!res.ok) {
          if (res.status === 404) {
            // No preferences yet, that's okay
            setPreferences(null);
            return;
          }
          throw new Error("Failed to fetch preferences");
        }

        const data = await res.json();
        if (!cancelled) {
          setPreferences(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to fetch preferences"),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPreferences();

    return () => {
      cancelled = true;
    };
  }, [sessionId, fetchKey]);

  const updatePreferences = useCallback(
    async (updates: NotificationPreferencesUpdate) => {
      if (!sessionId) throw new Error("No session");

      const res = await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...updates }),
      });

      if (!res.ok) {
        throw new Error("Failed to update preferences");
      }

      // Refetch to get updated data
      refetch();
    },
    [sessionId, refetch],
  );

  return { preferences, isLoading, error, updatePreferences, refetch };
}

interface UseNotificationHistoryResult {
  history: NotificationHistory[];
  isLoading: boolean;
  error: Error | null;
  markAsRead: (notificationId: string) => Promise<void>;
  refetch: () => void;
}

export function useNotificationHistory(
  limit: number = 50,
): UseNotificationHistoryResult {
  const { sessionId } = useManagerContext();
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/notifications/history?sessionId=${encodeURIComponent(sessionId!)}&limit=${limit}`,
        );

        if (!res.ok) {
          throw new Error("Failed to fetch history");
        }

        const data = await res.json();
        if (!cancelled) {
          setHistory(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err : new Error("Failed to fetch history"),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [sessionId, limit, fetchKey]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!sessionId) throw new Error("No session");

      const res = await fetch("/api/notifications/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, notificationId }),
      });

      if (!res.ok) {
        throw new Error("Failed to mark as read");
      }

      // Update local state
      setHistory((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read_at: new Date().toISOString() }
            : n,
        ),
      );
    },
    [sessionId],
  );

  return { history, isLoading, error, markAsRead, refetch };
}

// Helper to check push notification support (runs once at module load in browser)
function checkPushSupport(): {
  supported: boolean;
  permission: NotificationPermission;
} {
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  ) {
    return { supported: true, permission: Notification.permission };
  }
  return { supported: false, permission: "default" };
}

// Hook to check if push notifications are supported and get permission status
export function usePushNotificationStatus() {
  const initial = checkPushSupport();
  const [isSupported] = useState(initial.supported);
  const [permission, setPermission] = useState<NotificationPermission>(
    initial.permission,
  );

  const requestPermission = useCallback(async () => {
    if (!isSupported) return "denied" as NotificationPermission;

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  return { isSupported, permission, requestPermission };
}

/**
 * Subscribe to push notifications and return the subscription object.
 * This requires the service worker to be registered and push permission granted.
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications not supported");
    return null;
  }

  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    const existingSubscription =
      await registration.pushManager.getSubscription();
    if (existingSubscription) {
      return existingSubscription;
    }

    // Get VAPID public key from environment
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn("VAPID public key not configured");
      return null;
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    return subscription;
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to unsubscribe from push notifications:", error);
    return false;
  }
}

/**
 * Convert a base64 URL-safe string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Re-export PushSubscriptionJSON type for external use
import type { PushSubscriptionJSON } from "./types";
export type { PushSubscriptionJSON };
