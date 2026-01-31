"use client";

import { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Column } from "./data-table";

interface VirtualizedDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  /** Height of each row in pixels */
  rowHeight?: number;
  /** Maximum height of the table container */
  maxHeight?: number;
  /** Overscan count - how many rows to render above/below visible area */
  overscan?: number;
  className?: string;
}

export function VirtualizedDataTable<T>({
  columns,
  data,
  keyExtractor,
  rowHeight = 44,
  maxHeight = 600,
  overscan = 5,
  className = "",
}: VirtualizedDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // If data is small enough, render normally without virtualization
  if (data.length * rowHeight <= maxHeight) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fpl-border text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fpl-muted ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => (
              <tr
                key={keyExtractor(item, i)}
                className="border-b border-fpl-border/50 transition-colors hover:bg-fpl-card-hover"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${col.className ?? ""}`}
                  >
                    {col.render(item, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      {/* Fixed header */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-fpl-border text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fpl-muted ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
      </table>

      {/* Virtualized body */}
      <div
        ref={parentRef}
        className="overflow-y-auto"
        style={{ maxHeight: maxHeight - 40 }} // Subtract header height
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
                const item = data[virtualRow.index];
                const i = virtualRow.index;
                return (
                  <tr
                    key={keyExtractor(item, i)}
                    className="border-b border-fpl-border/50 transition-colors hover:bg-fpl-card-hover"
                    style={{
                      height: `${rowHeight}px`,
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2 ${col.className ?? ""}`}
                      >
                        {col.render(item, i)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
