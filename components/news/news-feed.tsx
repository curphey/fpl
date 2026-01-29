"use client";

import { useState } from "react";
import { useNews } from "@/lib/claude/hooks";
import type { NewsCategory, NewsItem } from "@/lib/claude/news-types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const categoryLabels: Record<NewsCategory, { label: string; color: string }> = {
  injury: { label: "Injury", color: "bg-fpl-danger/20 text-fpl-danger" },
  transfer: { label: "Transfer", color: "bg-blue-500/20 text-blue-400" },
  team_news: { label: "Team News", color: "bg-fpl-green/20 text-fpl-green" },
  press_conference: {
    label: "Press",
    color: "bg-purple-500/20 text-purple-400",
  },
  suspension: {
    label: "Suspension",
    color: "bg-yellow-500/20 text-yellow-400",
  },
  general: { label: "News", color: "bg-fpl-muted/20 text-fpl-muted" },
};

const impactColors = {
  positive: "text-fpl-green",
  negative: "text-fpl-danger",
  neutral: "text-fpl-muted",
  unknown: "text-fpl-muted",
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NewsItemCard({ item }: { item: NewsItem }) {
  const categoryInfo = categoryLabels[item.category];

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4 transition-colors hover:bg-fpl-card-hover">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${categoryInfo.color}`}
        >
          {categoryInfo.label}
        </span>
        {item.fplImpact !== "unknown" && (
          <span className={`text-xs ${impactColors[item.fplImpact]}`}>
            {item.fplImpact === "positive"
              ? "↑ Positive"
              : item.fplImpact === "negative"
                ? "↓ Negative"
                : "→ Neutral"}
          </span>
        )}
        <span className="ml-auto text-xs text-fpl-muted">
          {formatTimeAgo(item.publishedAt)}
        </span>
      </div>

      <h3 className="mb-1 font-medium">{item.title}</h3>
      <p className="mb-3 text-sm text-fpl-muted">{item.summary}</p>

      <div className="flex flex-wrap items-center gap-2">
        {item.players.slice(0, 3).map((player) => (
          <Badge key={player} variant="default" className="text-xs">
            {player}
          </Badge>
        ))}
        {item.players.length > 3 && (
          <span className="text-xs text-fpl-muted">
            +{item.players.length - 3} more
          </span>
        )}
      </div>

      {item.impactDetails && (
        <p className="mt-2 text-xs text-fpl-muted">
          FPL Impact: {item.impactDetails}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-fpl-muted">
        <span>{item.source}</span>
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fpl-green hover:underline"
          >
            Read more →
          </a>
        )}
      </div>
    </div>
  );
}

interface NewsFeedProps {
  initialQuery?: string;
  categories?: NewsCategory[];
  players?: string[];
  teams?: string[];
  limit?: number;
  showFilters?: boolean;
}

export function NewsFeed({
  initialQuery,
  categories: initialCategories,
  players,
  teams,
  limit = 10,
  showFilters = true,
}: NewsFeedProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [selectedCategories, setSelectedCategories] = useState<NewsCategory[]>(
    initialCategories || [],
  );

  const { news, isLoading, error, refetch, cached } = useNews({
    query: searchQuery || undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    players,
    teams,
    limit,
  });

  const toggleCategory = (category: NewsCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="space-y-3">
          {/* Search input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search news..."
              className="flex-1 rounded-lg border border-fpl-border bg-fpl-card px-3 py-2 text-sm placeholder:text-fpl-muted focus:border-fpl-green focus:outline-none"
            />
            <button
              onClick={refetch}
              disabled={isLoading}
              className="rounded-lg bg-fpl-green px-4 py-2 text-sm font-medium text-fpl-purple disabled:opacity-50"
            >
              {isLoading ? "..." : "Search"}
            </button>
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(categoryLabels) as NewsCategory[]).map((category) => {
              const info = categoryLabels[category];
              const isSelected = selectedCategories.includes(category);
              return (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? info.color
                      : "bg-fpl-card text-fpl-muted hover:text-foreground"
                  }`}
                >
                  {info.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Status indicators */}
      {cached && (
        <div className="text-xs text-fpl-muted">
          Showing cached results •{" "}
          <button onClick={refetch} className="text-fpl-green hover:underline">
            Refresh
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-fpl-border"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-fpl-danger">
              {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* News items */}
      {!isLoading && !error && news.length > 0 && (
        <div className="space-y-3">
          {news.map((item) => (
            <NewsItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && news.length === 0 && (
        <Card>
          <CardContent>
            <div className="py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-fpl-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2"
                />
              </svg>
              <p className="mt-4 text-sm text-fpl-muted">No news found</p>
              <p className="mt-1 text-xs text-fpl-muted">
                Try adjusting your search or filters
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
