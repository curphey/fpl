"use client";

import { useState } from "react";
import { NewsFeed } from "@/components/news/news-feed";
import { InjuryTracker } from "@/components/news/injury-tracker";

type Tab = "all" | "injuries";

export default function NewsPage() {
  const [tab, setTab] = useState<Tab>("all");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">FPL News</h1>
        <p className="text-sm text-fpl-muted">
          Real-time news, injuries, and team updates powered by Claude
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-fpl-border">
        {[
          { key: "all" as Tab, label: "Latest News" },
          { key: "injuries" as Tab, label: "Injury Updates" },
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

      {tab === "all" && <NewsFeed showFilters={true} limit={15} />}
      {tab === "injuries" && <InjuryTracker />}
    </div>
  );
}
