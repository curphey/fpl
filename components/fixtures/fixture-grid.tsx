"use client";

import type { TeamFixtureRow, FixtureCell } from "@/lib/fpl/fixture-planner";
import { getFDRColorClass } from "@/lib/fpl/fixture-planner";

function CellContent({ cells }: { cells: FixtureCell[] | undefined }) {
  if (!cells || cells.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-fpl-purple-light/50 text-xs text-fpl-muted">
        -
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-0.5">
      {cells.map((cell) => (
        <div
          key={`${cell.fixture.id}-${cell.opponent.id}`}
          className={`flex flex-1 items-center justify-center rounded text-xs font-semibold ${getFDRColorClass(cell.difficulty)}`}
        >
          {cell.opponent.short_name}
          <span className="ml-0.5 text-[10px] font-normal opacity-75">
            ({cell.isHome ? "H" : "A"})
          </span>
        </div>
      ))}
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
  );
}
