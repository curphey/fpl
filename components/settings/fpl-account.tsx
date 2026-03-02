"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const OIDC_KEY =
  "oidc.user:https://account.premierleague.com/as:bfcbaf69-aade-4c1b-8f00-c1cb8a193030";

export interface FplAccountProps {
  sessionId: string;
}

interface AuthStatus {
  connected: boolean;
  managerName: string | null;
  expiresAt: string | null;
}

export function FplAccount({ sessionId }: FplAccountProps) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookmarkletContainerRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(() => {
    void fetch(
      `/api/fpl-auth/status?sessionId=${encodeURIComponent(sessionId)}`,
    )
      .then((r) => r.json())
      .then((d) => setStatus(d as AuthStatus))
      .catch(() =>
        setStatus({ connected: false, managerName: null, expiresAt: null }),
      );
  }, [sessionId]);

  useEffect(() => {
    fetchStatus();
    window.addEventListener("focus", fetchStatus);
    return () => window.removeEventListener("focus", fetchStatus);
  }, [fetchStatus]);

  // Bookmarklet is created as a raw DOM element React never manages, so React's
  // javascript: URL sanitization cannot overwrite the href during reconciliation.
  useEffect(() => {
    if (!bookmarkletContainerRef.current) return;
    const origin = window.location.origin;
    const bookmarklet =
      `javascript:(function(){` +
      `var raw=localStorage.getItem('${OIDC_KEY}');` +
      `if(!raw){alert('Please log in to FPL first, then click this bookmarklet.');return;}` +
      `var u=JSON.parse(raw);` +
      `var at=u.access_token;var rt=u.refresh_token;` +
      `if(!at||!rt){alert('Tokens not found. Please log in to FPL first.');return;}` +
      `fetch('${origin}/api/fpl-auth/connect',{` +
      `method:'POST',` +
      `headers:{'Content-Type':'application/json'},` +
      `body:JSON.stringify({access_token:at,refresh_token:rt})` +
      `}).then(function(r){return r.json();})` +
      `.then(function(d){if(d.ok)alert('Connected! Welcome, '+d.managerName+'.');` +
      `else alert('Error: '+(d.error||'Unknown error'));})` +
      `.catch(function(){alert('Could not reach FPL Insights. Is the app running?');});` +
      `})();`;
    const a = document.createElement("a");
    a.setAttribute("href", bookmarklet);
    a.setAttribute("draggable", "true");
    a.className =
      "inline-flex cursor-move items-center gap-2 rounded-lg border border-fpl-purple/40 bg-fpl-purple/20 px-4 py-2 text-sm font-semibold text-fpl-purple hover:bg-fpl-purple/30";
    a.addEventListener("click", (e) => e.preventDefault());
    a.textContent = "📌 Send to FPL Insights";
    bookmarkletContainerRef.current.innerHTML = "";
    bookmarkletContainerRef.current.appendChild(a);
  }, [status]);

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fpl-auth/logout", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        setError("Disconnect failed");
        return;
      }
      setStatus({ connected: false, managerName: null, expiresAt: null });
    } catch {
      setError("Disconnect failed");
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return <div className="h-24 animate-pulse rounded-lg bg-fpl-card" />;
  }

  if (status.connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <svg
            className="h-5 w-5 flex-shrink-0 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <div>
            <p className="text-green-500">Connected as {status.managerName}</p>
            <p className="text-xs text-fpl-muted">Refreshes automatically</p>
          </div>
        </div>
        <button
          onClick={() => void handleDisconnect()}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm text-fpl-danger transition-colors hover:bg-fpl-danger/10 hover:text-fpl-danger/80 disabled:opacity-50"
        >
          {loading ? "Disconnecting..." : "Disconnect"}
        </button>
        {error && <p className="text-sm text-fpl-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-fpl-purple/30 text-xs font-bold">
            1
          </span>
          <div>
            <p className="mb-2 text-fpl-muted">
              Drag this to your bookmarks bar:
            </p>
            <div ref={bookmarkletContainerRef} />
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-fpl-purple/30 text-xs font-bold">
            2
          </span>
          <p className="text-fpl-muted">
            Open{" "}
            <a
              href="https://fantasy.premierleague.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fpl-cyan underline"
            >
              fantasy.premierleague.com
            </a>{" "}
            and log in if prompted.
          </p>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-fpl-purple/30 text-xs font-bold">
            3
          </span>
          <p className="text-fpl-muted">
            Click the{" "}
            <strong className="text-white">Send to FPL Insights</strong>{" "}
            bookmark. A confirmation will appear.
          </p>
        </li>
      </ol>
      {error && <p className="text-sm text-fpl-danger">{error}</p>}
    </div>
  );
}
