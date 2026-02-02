"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import type { ManagerEntry } from "./types";
import { useManager } from "./hooks/use-fpl";

interface ManagerContextValue {
  managerId: number | null;
  manager: ManagerEntry | null;
  isLoading: boolean;
  error: Error | null;
  sessionId: string | null;
  setManagerId: (id: number) => void;
  clearManager: () => void;
}

const ManagerContext = createContext<ManagerContextValue | null>(null);

const SESSION_KEY = "fpl-session-id";
const STORAGE_KEY = "fpl-manager-id";

function readStoredId(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  const parsed = parseInt(stored, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

// No-op subscribe — we only read once on mount
const subscribeNoop = () => () => {};

export function ManagerProvider({ children }: { children: React.ReactNode }) {
  const storedId = useSyncExternalStore(
    subscribeNoop,
    readStoredId,
    () => null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [managerId, setManagerIdState] = useState<number | null>(storedId);
  const [initialized, setInitialized] = useState(false);

  const { data: manager, isLoading, error } = useManager(managerId);

  // Initialize session on mount
  useEffect(() => {
    async function initSession() {
      const sid = localStorage.getItem(SESSION_KEY);

      if (sid) {
        // Validate existing session
        try {
          const res = await fetch(`/api/session?id=${encodeURIComponent(sid)}`);
          if (res.ok) {
            const session = await res.json();
            setSessionId(sid);
            // If session has a manager ID, use it (cross-device sync)
            if (session.fpl_manager_id && !storedId) {
              setManagerIdState(session.fpl_manager_id);
              localStorage.setItem(STORAGE_KEY, String(session.fpl_manager_id));
            }
            setInitialized(true);
            return;
          }
        } catch {
          // Session invalid or network error, create new one
        }
      }

      // Create new session
      try {
        const res = await fetch("/api/session", { method: "POST" });
        const session = await res.json();
        localStorage.setItem(SESSION_KEY, session.id);
        setSessionId(session.id);
      } catch {
        // Network error, continue without session
      }
      setInitialized(true);
    }
    initSession();
  }, [storedId]);

  // Persist to localStorage only after successful fetch
  useEffect(() => {
    if (manager && managerId) {
      localStorage.setItem(STORAGE_KEY, String(managerId));
    }
  }, [manager, managerId]);

  const setManagerId = useCallback(
    async (id: number) => {
      setManagerIdState(id);
      localStorage.setItem(STORAGE_KEY, String(id));
      if (sessionId) {
        try {
          await fetch("/api/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: sessionId, fpl_manager_id: id }),
          });
        } catch {
          // Network error, localStorage will still work
        }
      }
    },
    [sessionId],
  );

  const clearManager = useCallback(async () => {
    setManagerIdState(null);
    localStorage.removeItem(STORAGE_KEY);
    if (sessionId) {
      try {
        await fetch("/api/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sessionId, fpl_manager_id: null }),
        });
      } catch {
        // Network error, localStorage will still work
      }
    }
  }, [sessionId]);

  // Show children immediately, don't block on session initialization
  if (!initialized) {
    return (
      <ManagerContext.Provider
        value={{
          managerId: storedId,
          manager: null,
          isLoading: true,
          error: null,
          sessionId: null,
          setManagerId: () => {},
          clearManager: () => {},
        }}
      >
        {children}
      </ManagerContext.Provider>
    );
  }

  return (
    <ManagerContext.Provider
      value={{
        managerId,
        manager,
        isLoading,
        error,
        sessionId,
        setManagerId,
        clearManager,
      }}
    >
      {children}
    </ManagerContext.Provider>
  );
}

const defaultValue: ManagerContextValue = {
  managerId: null,
  manager: null,
  isLoading: false,
  error: null,
  sessionId: null,
  setManagerId: () => {},
  clearManager: () => {},
};

export function useManagerContext(): ManagerContextValue {
  const ctx = useContext(ManagerContext);
  // Return safe default during SSR / prerendering when no provider is mounted
  return ctx ?? defaultValue;
}
