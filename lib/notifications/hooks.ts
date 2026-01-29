"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPreferences() {
      setIsLoading(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase!.auth.getUser();
        if (!user) {
          setPreferences(null);
          setIsLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase!
          .from("notification_preferences")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw fetchError;
        }

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
  }, [supabase, fetchKey]);

  const updatePreferences = useCallback(
    async (updates: NotificationPreferencesUpdate) => {
      if (!supabase) throw new Error("Supabase not configured");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user.id,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          },
        );

      if (updateError) throw updateError;

      // Refetch to get updated data
      refetch();
    },
    [supabase, refetch],
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
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase!.auth.getUser();
        if (!user) {
          setHistory([]);
          setIsLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase!
          .from("notification_history")
          .select("*")
          .eq("user_id", user.id)
          .order("sent_at", { ascending: false })
          .limit(limit);

        if (fetchError) throw fetchError;

        if (!cancelled) {
          setHistory(data ?? []);
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
  }, [supabase, limit, fetchKey]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!supabase) throw new Error("Supabase not configured");

      const { error: updateError } = await supabase
        .from("notification_history")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (updateError) throw updateError;

      // Update local state
      setHistory((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, read_at: new Date().toISOString() }
            : n,
        ),
      );
    },
    [supabase],
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
