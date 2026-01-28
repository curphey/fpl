'use client';

import { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import type { ManagerEntry } from './types';
import { useManager } from './hooks/use-fpl';
import { createClient } from '@/lib/supabase/client';

interface ManagerContextValue {
  managerId: number | null;
  manager: ManagerEntry | null;
  isLoading: boolean;
  error: Error | null;
  setManagerId: (id: number) => void;
  clearManager: () => void;
}

const ManagerContext = createContext<ManagerContextValue | null>(null);

const STORAGE_KEY = 'fpl-manager-id';

function readStoredId(): number | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  const parsed = parseInt(stored, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
}

// No-op subscribe — we only read once on mount
const subscribeNoop = () => () => {};

async function persistManagerId(id: number | null) {
  const supabase = createClient();
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('profiles')
    .update({ fpl_manager_id: id, updated_at: new Date().toISOString() })
    .eq('id', user.id);
}

export function ManagerProvider({ children }: { children: React.ReactNode }) {
  const storedId = useSyncExternalStore(subscribeNoop, readStoredId, () => null);
  const [managerId, setManagerIdState] = useState<number | null>(storedId);

  const { data: manager, isLoading, error } = useManager(managerId);

  // On mount, check for a Supabase user and fetch their profile's fpl_manager_id
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const loadProfileId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('fpl_manager_id')
        .eq('id', user.id)
        .single();
      if (profile?.fpl_manager_id) {
        setManagerIdState(profile.fpl_manager_id);
      }
    };
    loadProfileId();
  }, []);

  // Persist to localStorage only after successful fetch
  useEffect(() => {
    if (manager && managerId) {
      localStorage.setItem(STORAGE_KEY, String(managerId));
    }
  }, [manager, managerId]);

  const setManagerId = useCallback((id: number) => {
    setManagerIdState(id);
    persistManagerId(id);
  }, []);

  const clearManager = useCallback(() => {
    setManagerIdState(null);
    localStorage.removeItem(STORAGE_KEY);
    persistManagerId(null);
  }, []);

  return (
    <ManagerContext.Provider
      value={{ managerId, manager, isLoading, error, setManagerId, clearManager }}
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
  setManagerId: () => {},
  clearManager: () => {},
};

export function useManagerContext(): ManagerContextValue {
  const ctx = useContext(ManagerContext);
  // Return safe default during SSR / prerendering when no provider is mounted
  return ctx ?? defaultValue;
}
