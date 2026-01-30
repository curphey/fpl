"use client";

import { useState, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { useManagerContext } from "@/lib/fpl/manager-context";

const DISMISSED_KEY = "fpl-onboarding-dismissed";

/**
 * Check if banner was dismissed from localStorage.
 */
function getSnapshot(): boolean {
  return localStorage.getItem(DISMISSED_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return true; // Default to hidden on server to prevent flash
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Onboarding banner shown to users who haven't connected their FPL manager ID.
 * Dismissible and persists dismissal in localStorage.
 */
export function OnboardingBanner() {
  const { managerId } = useManagerContext();
  const isDismissedFromStorage = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [isDismissedLocal, setIsDismissedLocal] = useState(false);
  const isDismissed = isDismissedFromStorage || isDismissedLocal;

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsDismissedLocal(true);
  }, []);

  // Don't show if user already has a manager ID or has dismissed
  if (managerId || isDismissed) {
    return null;
  }

  return (
    <div className="relative rounded-lg border border-fpl-cyan/30 bg-gradient-to-r from-fpl-purple to-fpl-purple-light p-4 sm:p-6">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-fpl-muted transition-colors hover:text-foreground"
        aria-label="Dismiss banner"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="pr-8 sm:pr-0">
          <h3 className="text-lg font-bold text-fpl-cyan">
            Connect Your FPL Account
          </h3>
          <p className="mt-1 text-sm text-fpl-muted">
            Unlock personalized insights by connecting your Fantasy Premier
            League manager ID.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-foreground/80">
            <li className="flex items-center gap-2">
              <span className="text-fpl-green">✓</span>
              View your team with live points
            </li>
            <li className="flex items-center gap-2">
              <span className="text-fpl-green">✓</span>
              Analyze your mini-leagues
            </li>
            <li className="flex items-center gap-2">
              <span className="text-fpl-green">✓</span>
              Get personalized transfer recommendations
            </li>
            <li className="flex items-center gap-2">
              <span className="text-fpl-green">✓</span>
              Sync across devices when signed in
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href="/team"
            className="inline-flex items-center justify-center rounded-lg bg-fpl-green px-6 py-2.5 font-semibold text-fpl-purple transition-colors hover:bg-fpl-green/90"
          >
            Connect Now
          </Link>
          <span className="text-xs text-fpl-muted">
            Find your ID at{" "}
            <a
              href="https://fantasy.premierleague.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fpl-cyan hover:underline"
            >
              fantasy.premierleague.com
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
