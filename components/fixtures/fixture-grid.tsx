"use client";

import { memo } from "react";
import type { TeamFixtureRow, FixtureCell } from "@/lib/fpl/fixture-planner";
import { getFDRColorClass } from "@/lib/fpl/fixture-planner";

/**
 * Badge component for Double Gameweek indicator
 */
function DGWBadge() {
  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-fpl-cyan text-[8px] font-bold text-fpl-purple">
      2×
    </span>
  );
}

/**
 * Blank Gameweek cell with striped pattern
 */
function BGWCell() {
  return (
    <div
      className="flex h-full items-center justify-center rounded text-xs text-fpl-muted"
      style={{
        background:
          "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(55, 0, 60, 0.3) 3px, rgba(55, 0, 60, 0.3) 6px)",
      }}
      title="Blank Gameweek - No fixture scheduled"
    >
      BGW
    </div>
  );
}

const CellContent = memo(function CellContent({
  cells,
}: {
  cells: FixtureCell[] | undefined;
}) {
  // Blank Gameweek
  if (!cells || cells.length === 0) {
    return <BGWCell />;
  }

  // Double Gameweek (2+ fixtures)
  const isDGW = cells.length > 1;

  return (
    <div className="relative flex h-full flex-col gap-0.5">
      {isDGW && <DGWBadge />}
      {cells.map((cell) => (
        <div
          key={`${cell.fixture.id}-${cell.opponent.id}`}
          className={`flex flex-1 items-center justify-center rounded text-xs font-semibold ${getFDRColorClass(cell.difficulty)}`}
          title={`${cell.opponent.short_name} (${cell.isHome ? "Home" : "Away"}) - FDR ${cell.difficulty}`}
        >
          {cell.opponent.short_name}
          <span className="ml-0.5 text-[10px] font-normal opacity-75">
            ({cell.isHome ? "H" : "A"})
          </span>
        </div>
      ))}
    </div>
  );
});

/**
 * Legend explaining DGW/BGW indicators
 */
function GridLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-fpl-muted">
      <span className="font-medium text-foreground">Legend:</span>
      <div className="flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-fpl-cyan text-[8px] font-bold text-fpl-purple">
          2×
        </span>
        <span>Double Gameweek</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="h-4 w-8 rounded"
          style={{
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(55, 0, 60, 0.3) 3px, rgba(55, 0, 60, 0.3) 6px)",
          }}
        />
        <span>Blank Gameweek</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-4 w-4 rounded bg-green-600" />
        <span>Easy (FDR 1-2)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-4 w-4 rounded bg-yellow-500" />
        <span>Medium (FDR 3)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-4 w-4 rounded bg-red-600" />
        <span>Hard (FDR 4-5)</span>
      </div>
    </div>
  );
}

export function FixtureGrid({
  rows,
  gwStart,
  gwEnd,
}: {
  rows: TeamFixtureRow[];
  gwStart: number;
  gwEnd: number;
}) {
  const gwRange = Array.from(
    { length: gwEnd - gwStart + 1 },
    (_, i) => gwStart + i,
  );

  return (
    <div>
      <GridLegend />
      <div className="overflow-x-auto rounded-lg border border-fpl-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fpl-purple">
              <th className="sticky left-0 z-10 bg-fpl-purple px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-fpl-muted">
                Team
              </th>
              {gwRange.map((gw) => (
                <th
                  key={gw}
                  className="min-w-[64px] px-1 py-2 text-center text-xs font-semibold text-fpl-muted"
                >
                  GW{gw}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.team.id}
                className="border-t border-fpl-border/50 transition-colors hover:bg-fpl-card-hover/30"
              >
                <td className="sticky left-0 z-10 bg-fpl-card px-3 py-1.5 text-xs font-medium">
                  {row.team.short_name}
                </td>
                {gwRange.map((gw) => (
                  <td key={gw} className="h-10 px-0.5 py-0.5">
                    <CellContent cells={row.fixtures.get(gw)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
