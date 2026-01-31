"use client";

import { useState, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "fpl-chat-api-key";

// Helper to read from localStorage
function getStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

// Subscribe to storage changes
function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

interface ApiKeyInputProps {
  onKeyChange: (key: string | null) => void;
}

export function ApiKeyInput({ onKeyChange }: ApiKeyInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");

  // Use useSyncExternalStore for localStorage
  const savedKey = useSyncExternalStore(
    subscribeToStorage,
    getStoredKey,
    () => null, // Server snapshot
  );

  // Notify parent of key changes
  useEffect(() => {
    onKeyChange(savedKey);
  }, [savedKey, onKeyChange]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem(STORAGE_KEY, apiKey.trim());
      // Trigger storage event for useSyncExternalStore
      window.dispatchEvent(new Event("storage"));
      setApiKey("");
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    // Trigger storage event for useSyncExternalStore
    window.dispatchEvent(new Event("storage"));
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded px-2 py-1 text-xs transition-colors ${
          savedKey
            ? "bg-green-500/20 text-green-400"
            : "bg-fpl-card-alt text-fpl-muted hover:text-fpl-text"
        }`}
        title={savedKey ? "API key configured" : "Configure API key"}
      >
        {savedKey ? "Key Set" : "API Key"}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-fpl-border bg-fpl-card p-3 shadow-lg">
          <div className="mb-2 text-xs text-fpl-muted">
            {savedKey
              ? "Your API key is saved locally."
              : "Enter your Anthropic API key to use the chat. It will be stored in your browser."}
          </div>

          {!savedKey ? (
            <>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="mb-2 w-full rounded border border-fpl-border bg-fpl-bg px-2 py-1.5 text-xs text-fpl-text placeholder-fpl-muted focus:border-fpl-purple focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className="flex-1 rounded bg-fpl-purple px-2 py-1 text-xs text-white transition-colors hover:bg-fpl-purple-dark disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded px-2 py-1 text-xs text-fpl-muted hover:text-fpl-text"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="flex-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/30"
              >
                Remove Key
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded px-2 py-1 text-xs text-fpl-muted hover:text-fpl-text"
              >
                Close
              </button>
            </div>
          )}

          <div className="mt-2 border-t border-fpl-border pt-2">
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-fpl-green hover:underline"
            >
              Get an API key →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get the stored API key
 */
export function useApiKey(): string | null {
  return useSyncExternalStore(
    subscribeToStorage,
    getStoredKey,
    () => null, // Server snapshot
  );
}
