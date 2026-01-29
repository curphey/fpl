"use client";

import { useState } from "react";
import { useManagerContext } from "@/lib/fpl/manager-context";
import { ConnectPrompt } from "@/components/leagues/connect-prompt";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences";
import { NotificationHistoryList } from "@/components/notifications/notification-history";

type Tab = "settings" | "history";

export default function NotificationsPage() {
  const { manager } = useManagerContext();
  const [tab, setTab] = useState<Tab>("settings");

  if (!manager) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-sm text-fpl-muted">
            Configure alerts for deadlines, price changes, and more
          </p>
        </div>
        <ConnectPrompt />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Notifications</h1>
        <p className="text-sm text-fpl-muted">
          Configure alerts for deadlines, price changes, and more
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-fpl-border">
        {[
          { key: "settings" as Tab, label: "Settings" },
          { key: "history" as Tab, label: "History" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-fpl-green text-fpl-green"
                : "border-transparent text-fpl-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && <NotificationPreferencesForm />}
      {tab === "history" && <NotificationHistoryList />}
    </div>
  );
}
