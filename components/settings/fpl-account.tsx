"use client";

import { useState, useEffect } from "react";

interface Props {
  sessionId: string;
}

interface AuthStatus {
  connected: boolean;
  managerName: string | null;
  expiresAt: string | null;
}

export function FplAccount({ sessionId }: Props) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(
      `/api/fpl-auth/status?sessionId=${encodeURIComponent(sessionId)}`,
    )
      .then((r) => r.json())
      .then((d) => setStatus(d as AuthStatus))
      .catch(() =>
        setStatus({ connected: false, managerName: null, expiresAt: null }),
      );
  }, [sessionId]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fpl-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email, password }),
      });
      const data = (await res.json()) as {
        connected?: boolean;
        managerName?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Connection failed");
        return;
      }
      setStatus({
        connected: true,
        managerName: data.managerName ?? null,
        expiresAt: data.expiresAt ?? null,
      });
      setEmail("");
      setPassword("");
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/fpl-auth/logout", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      setStatus({ connected: false, managerName: null, expiresAt: null });
    } catch {
      setError("Disconnect failed");
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return <div className="h-24 animate-pulse rounded-lg bg-white/5" />;
  }

  if (status.connected) {
    const expiryLabel = status.expiresAt
      ? new Date(status.expiresAt).toLocaleDateString("en-GB", {
          month: "short",
          year: "numeric",
        })
      : null;

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
            {expiryLabel && (
              <p className="text-xs text-white/50">
                Session expires {expiryLabel}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => void handleDisconnect()}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-50"
        >
          Disconnect
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleConnect(e)} className="space-y-4">
      <div>
        <label htmlFor="fpl-email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="fpl-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fpl-purple"
        />
      </div>
      <div>
        <label
          htmlFor="fpl-password"
          className="mb-1 block text-sm font-medium"
        >
          Password
        </label>
        <input
          id="fpl-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your FPL password"
          required
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fpl-purple"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading || !email || !password}
        className="w-full rounded-lg bg-fpl-purple px-4 py-3 font-medium hover:bg-fpl-purple/80 disabled:cursor-not-allowed disabled:bg-white/10 transition-colors"
      >
        {loading ? "Connecting..." : "Connect to FPL"}
      </button>
    </form>
  );
}
