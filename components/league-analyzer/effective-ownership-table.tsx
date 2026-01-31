"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { EffectiveOwnership } from "@/lib/fpl/league-analyzer";
import { Badge } from "@/components/ui/badge";

type EOFilter = "all" | "mine" | "not_mine";

const statusBadge: Record<
  EffectiveOwnership["userStatus"],
  { label: string; variant: string }
> = {
  captain: { label: "Captain", variant: "green" },
  own: { label: "Own", variant: "default" },
  bench: { label: "Bench", variant: "pink" },
  dont_own: { label: "Don't Own", variant: "danger" },
};

const ROW_HEIGHT = 44;
const MAX_HEIGHT = 500;
const OVERSCAN = 5;

function EORow({ row }: { row: EffectiveOwnership }) {
  const badge = statusBadge[row.userStatus];
  return (
    <>
      <td className="px-4 py-2 font-medium">{row.playerName}</td>
      <td className="hidden px-4 py-2 text-fpl-muted sm:table-cell">
        {row.position}
      </td>
      <td className="hidden px-4 py-2 text-fpl-muted md:table-cell">
        {row.teamShortName}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {row.globalOwnership.toFixed(1)}%
      </td>
      <td className="px-4 py-2 text-right font-medium tabular-nums text-fpl-green">
        {row.leagueEO.toFixed(0)}%
      </td>
      <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">
        {row.captainEO > 0 ? `${row.captainEO.toFixed(0)}%` : "-"}
      </td>
      <td className="hidden px-4 py-2 text-right tabular-nums md:table-cell">
        {row.ownerCount}/{row.totalManagers}
      </td>
      <td className="px-4 py-2 text-right">
        <Badge
          variant={badge.variant as "green" | "default" | "pink" | "danger"}
        >
          {badge.label}
        </Badge>
      </td>
    </>
  );
}

export function EffectiveOwnershipTable({
  data,
}: {
  data: EffectiveOwnership[];
}) {
  const [filter, setFilter] = useState<EOFilter>("all");
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (filter === "mine")
      return data.filter((d) => d.userStatus !== "dont_own");
    if (filter === "not_mine")
      return data.filter((d) => d.userStatus === "dont_own");
    return data;
  }, [data, filter]);

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => ROW_HEIGHT, []),
    overscan: OVERSCAN,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const needsVirtualization = filtered.length * ROW_HEIGHT > MAX_HEIGHT;

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card">
      <div className="flex items-center justify-between gap-2 border-b border-fpl-border px-4 py-3">
        <div className="flex items-center gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "mine", label: "Mine" },
              { key: "not_mine", label: "Not Mine" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-fpl-green/20 text-fpl-green"
                  : "text-fpl-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-fpl-muted">
          {filtered.length} players
        </span>
      </div>

      <div className="overflow-x-auto">
        {/* Fixed header */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fpl-border text-left text-xs uppercase tracking-wide text-fpl-muted">
              <th className="px-4 py-2">Player</th>
              <th className="hidden px-4 py-2 sm:table-cell">Pos</th>
              <th className="hidden px-4 py-2 md:table-cell">Team</th>
              <th className="px-4 py-2 text-right">Global%</th>
              <th className="px-4 py-2 text-right">League EO%</th>
              <th className="hidden px-4 py-2 text-right sm:table-cell">
                Cap EO%
              </th>
              <th className="hidden px-4 py-2 text-right md:table-cell">
                Owners
              </th>
              <th className="px-4 py-2 text-right">Status</th>
            </tr>
          </thead>
        </table>

        {/* Virtualized or regular body */}
        {needsVirtualization ? (
          <div
            ref={parentRef}
            className="overflow-y-auto"
            style={{ maxHeight: MAX_HEIGHT }}
          >
            <div
              style={{
                height: `${totalSize}px`,
                width: "100%",
                position: "relative",
              }}
            >
              <table className="w-full text-sm">
                <tbody>
                  {virtualItems.map((virtualRow) => {
                    const row = filtered[virtualRow.index];
                    return (
                      <tr
                        key={row.playerId}
                        className="transition-colors hover:bg-fpl-purple-light/50"
                        style={{
                          height: `${ROW_HEIGHT}px`,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                          display: "table",
                          tableLayout: "fixed",
                        }}
                      >
                        <EORow row={row} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-fpl-border/50">
              {filtered.map((row) => (
                <tr
                  key={row.playerId}
                  className="transition-colors hover:bg-fpl-purple-light/50"
                >
                  <EORow row={row} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="p-8 text-center text-sm text-fpl-muted">
          No players match the selected filter.
        </div>
      )}
    </div>
  );
}
