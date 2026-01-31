"use client";

import { memo, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TeamFixtureRow, FixtureCell } from "@/lib/fpl/fixture-planner";
import { getFDRColorClass } from "@/lib/fpl/fixture-planner";

const ROW_HEIGHT = 44;
const MAX_HEIGHT = 500;
const OVERSCAN = 3;

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

const FixtureRow = memo(function FixtureRow({
  row,
  gwRange,
}: {
  row: TeamFixtureRow;
  gwRange: number[];
}) {
  return (
    <>
      <td className="sticky left-0 z-10 bg-fpl-card px-3 py-1.5 text-xs font-medium">
        {row.team.short_name}
      </td>
      {gwRange.map((gw) => (
        <td key={gw} className="h-10 px-0.5 py-0.5">
          <CellContent cells={row.fixtures.get(gw)} />
        </td>
      ))}
    </>
  );
});

export function FixtureGrid({
  rows,
  gwStart,
  gwEnd,
}: {
  rows: TeamFixtureRow[];
  gwStart: number;
  gwEnd: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gwRange = Array.from(
    { length: gwEnd - gwStart + 1 },
    (_, i) => gwStart + i,
  );

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => ROW_HEIGHT, []),
    overscan: OVERSCAN,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const needsVirtualization = rows.length * ROW_HEIGHT > MAX_HEIGHT;

  return (
    <div>
      <GridLegend />
      <div className="overflow-x-auto rounded-lg border border-fpl-border">
        {/* Fixed header */}
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
                    const row = rows[virtualRow.index];
                    return (
                      <tr
                        key={row.team.id}
                        className="border-t border-fpl-border/50 transition-colors hover:bg-fpl-card-hover/30"
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
                        <FixtureRow row={row} gwRange={gwRange} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.team.id}
                  className="border-t border-fpl-border/50 transition-colors hover:bg-fpl-card-hover/30"
                >
                  <FixtureRow row={row} gwRange={gwRange} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
