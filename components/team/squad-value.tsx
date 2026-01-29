"use client";

import type {
  SquadValueSummary,
  ValueHistoryPoint,
} from "@/lib/fpl/squad-value";
import { PositionBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function ValueChart({ history }: { history: ValueHistoryPoint[] }) {
  if (history.length < 2) {
    return (
      <p className="py-4 text-center text-sm text-fpl-muted">
        Not enough data for chart
      </p>
    );
  }

  const chartWidth = 400;
  const chartHeight = 100;
  const padding = { top: 10, right: 20, bottom: 25, left: 40 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const values = history.map((h) => h.value);
  const minValue = Math.min(...values) - 0.5;
  const maxValue = Math.max(...values) + 0.5;
  const valueRange = maxValue - minValue || 1;

  const points = history.map((h, i) => {
    const x = padding.left + (i / Math.max(history.length - 1, 1)) * innerWidth;
    const y =
      padding.top +
      innerHeight -
      ((h.value - minValue) / valueRange) * innerHeight;
    return { x, y, ...h };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
    .join(" ");

  // Determine trend
  const startValue = history[0]?.value ?? 100;
  const endValue = history[history.length - 1]?.value ?? 100;
  const trendUp = endValue > startValue;
  const strokeColor =
    endValue === startValue
      ? "#888"
      : trendUp
        ? "var(--fpl-green)"
        : "var(--fpl-danger)";

  return (
    <svg width={chartWidth} height={chartHeight} className="w-full">
      {/* Grid lines */}
      {[0, 0.5, 1].map((pct) => {
        const y = padding.top + innerHeight * (1 - pct);
        const value = minValue + valueRange * pct;
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
              £{value.toFixed(1)}m
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path
        d={`${linePath} L ${points[points.length - 1].x},${padding.top + innerHeight} L ${points[0].x},${padding.top + innerHeight} Z`}
        fill={strokeColor}
        fillOpacity="0.1"
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Points */}
      {points
        .filter(
          (_, i) =>
            i % Math.max(1, Math.floor(points.length / 8)) === 0 ||
            i === points.length - 1,
        )
        .map((p) => (
          <circle key={p.gw} cx={p.x} cy={p.y} r="3" fill={strokeColor} />
        ))}

      {/* X-axis labels */}
      {points
        .filter(
          (_, i) =>
            i % Math.max(1, Math.ceil(points.length / 6)) === 0 ||
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
  );
}

function PlayerValueRow({ pv }: { pv: SquadValueSummary["playerValues"][0] }) {
  const profitColor =
    pv.profit > 0
      ? "text-fpl-green"
      : pv.profit < 0
        ? "text-fpl-danger"
        : "text-fpl-muted";

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <PositionBadge
          position={pv.position}
          label={["GK", "DEF", "MID", "FWD"][pv.position - 1]}
        />
        <span className="text-sm font-medium">{pv.name}</span>
        <span className="text-xs text-fpl-muted">{pv.teamShort}</span>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <div className="text-right">
          <div className="text-fpl-muted">Current</div>
          <div>£{pv.currentPrice.toFixed(1)}m</div>
        </div>
        <div className="text-right">
          <div className="text-fpl-muted">Sell</div>
          <div>£{pv.sellingPrice.toFixed(1)}m</div>
        </div>
        <div className="w-16 text-right">
          <div className="text-fpl-muted">Profit</div>
          <div className={profitColor}>
            {pv.profit > 0 ? "+" : ""}
            {pv.profit.toFixed(1)}m
          </div>
        </div>
        {pv.lockedProfit > 0 && (
          <div className="w-16 text-right">
            <div className="text-fpl-muted">Locked</div>
            <div className="text-yellow-400">
              £{pv.lockedProfit.toFixed(1)}m
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SquadValueCard({
  summary,
  history,
}: {
  summary: SquadValueSummary;
  history: ValueHistoryPoint[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Squad Value</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-fpl-purple-light p-3 text-center">
            <div className="text-2xl font-bold">
              £{summary.totalValue.toFixed(1)}m
            </div>
            <div className="text-xs text-fpl-muted">Total Value</div>
          </div>
          <div className="rounded-lg bg-fpl-purple-light p-3 text-center">
            <div className="text-2xl font-bold">
              £{summary.bank.toFixed(1)}m
            </div>
            <div className="text-xs text-fpl-muted">In Bank</div>
          </div>
          <div className="rounded-lg bg-fpl-purple-light p-3 text-center">
            <div
              className={`text-2xl font-bold ${summary.valueGained >= 0 ? "text-fpl-green" : "text-fpl-danger"}`}
            >
              {summary.valueGained >= 0 ? "+" : ""}£
              {summary.valueGained.toFixed(1)}m
            </div>
            <div className="text-xs text-fpl-muted">Value Gained</div>
          </div>
          <div className="rounded-lg bg-fpl-purple-light p-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              £{summary.totalLockedProfit.toFixed(1)}m
            </div>
            <div className="text-xs text-fpl-muted">Locked Profit</div>
          </div>
        </div>

        {/* Value chart */}
        {history.length > 1 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase text-fpl-muted">
              Value Over Time
            </h4>
            <ValueChart history={history} />
          </div>
        )}

        {/* Player breakdown */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-fpl-muted">
            Player Values
          </h4>
          <div className="divide-y divide-fpl-border">
            {summary.playerValues.map((pv) => (
              <PlayerValueRow key={pv.playerId} pv={pv} />
            ))}
          </div>
        </div>

        {/* Explainer */}
        <p className="text-xs text-fpl-muted">
          <strong>Locked profit</strong> is the portion of price rises you
          cannot sell for. FPL gives you 50% of any price increase when selling
          a player.
        </p>
      </CardContent>
    </Card>
  );
}
