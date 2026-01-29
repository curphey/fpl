"use client";

import { useEffect, useCallback } from "react";
import { usePlayerSummary } from "@/lib/fpl/hooks/use-fpl";
import type { EnrichedPlayer } from "@/lib/fpl/utils";
import { getPlayerDisplayName, getPlayerPrice } from "@/lib/fpl/utils";

interface PriceHistoryModalProps {
  player: EnrichedPlayer;
  onClose: () => void;
}

export function PriceHistoryModal({ player, onClose }: PriceHistoryModalProps) {
  const { data: summary, isLoading } = usePlayerSummary(player.id);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Extract price history from player summary
  const priceHistory =
    summary?.history?.map((h) => ({
      gw: h.round,
      price: h.value / 10,
      date: h.kickoff_time,
    })) ?? [];

  // Calculate price changes (where price differs from previous GW)
  const priceChanges: {
    gw: number;
    price: number;
    change: number;
    date: string;
  }[] = [];
  for (let i = 1; i < priceHistory.length; i++) {
    const diff = priceHistory[i].price - priceHistory[i - 1].price;
    if (Math.abs(diff) >= 0.05) {
      priceChanges.push({
        gw: priceHistory[i].gw,
        price: priceHistory[i].price,
        change: diff,
        date: priceHistory[i].date,
      });
    }
  }

  // Chart dimensions
  const chartWidth = 400;
  const chartHeight = 120;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const prices = priceHistory.map((h) => h.price);
  const minPrice = Math.min(...prices, player.now_cost / 10) - 0.2;
  const maxPrice = Math.max(...prices, player.now_cost / 10) + 0.2;
  const priceRange = maxPrice - minPrice || 1;

  const points = priceHistory.map((h, i) => {
    const x =
      padding.left + (i / Math.max(priceHistory.length - 1, 1)) * innerWidth;
    const y =
      padding.top +
      innerHeight -
      ((h.price - minPrice) / priceRange) * innerHeight;
    return { x, y, ...h };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");

  // Determine overall trend
  const startPrice = priceHistory[0]?.price ?? player.now_cost / 10;
  const endPrice =
    priceHistory[priceHistory.length - 1]?.price ?? player.now_cost / 10;
  const trendUp = endPrice > startPrice;
  const strokeColor =
    endPrice === startPrice
      ? "#888"
      : trendUp
        ? "var(--fpl-green)"
        : "var(--fpl-danger)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-fpl-border bg-fpl-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {getPlayerDisplayName(player)}
            </h3>
            <p className="text-sm text-fpl-muted">
              {player.team_short_name} &middot; Current:{" "}
              {getPlayerPrice(player)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-fpl-muted hover:bg-fpl-border hover:text-foreground"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-fpl-green border-t-transparent" />
          </div>
        ) : priceHistory.length > 0 ? (
          <div className="mb-4">
            <svg width={chartWidth} height={chartHeight} className="w-full">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = padding.top + innerHeight * (1 - pct);
                const price = minPrice + priceRange * pct;
                return (
                  <g key={pct}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + innerWidth}
                      y2={y}
                      stroke="#333"
                      strokeDasharray="2,2"
                    />
                    <text
                      x={padding.left - 5}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-fpl-muted text-[10px]"
                    >
                      {price.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Price line */}
              <path
                d={linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Data points */}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={strokeColor} />
              ))}

              {/* X-axis labels */}
              {points
                .filter(
                  (_, i) =>
                    i % Math.ceil(points.length / 6) === 0 ||
                    i === points.length - 1,
                )
                .map((p) => (
                  <text
                    key={p.gw}
                    x={p.x}
                    y={chartHeight - 5}
                    textAnchor="middle"
                    className="fill-fpl-muted text-[10px]"
                  >
                    GW{p.gw}
                  </text>
                ))}
            </svg>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-fpl-muted">
            No price history available
          </p>
        )}

        {/* Price changes list */}
        {priceChanges.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-fpl-muted">
              Price Changes
            </h4>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {priceChanges.map((pc) => (
                <div
                  key={pc.gw}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-fpl-muted">GW{pc.gw}</span>
                  <span
                    className={
                      pc.change > 0 ? "text-fpl-green" : "text-fpl-danger"
                    }
                  >
                    {pc.change > 0 ? "+" : ""}
                    {pc.change.toFixed(1)}m
                  </span>
                  <span>£{pc.price.toFixed(1)}m</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {priceChanges.length === 0 && priceHistory.length > 0 && (
          <p className="text-center text-xs text-fpl-muted">
            No price changes this season
          </p>
        )}
      </div>
    </div>
  );
}
