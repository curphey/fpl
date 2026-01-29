"use client";

import { useState, useMemo } from "react";
import type { EnrichedPlayer } from "@/lib/fpl/utils";
import {
  getPlayerDisplayName,
  getPlayerPrice,
  getPlayerForm,
  getPlayerValueScore,
} from "@/lib/fpl/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PositionBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

type Tab = "points" | "form" | "value";

const tabs: { key: Tab; label: string }[] = [
  { key: "points", label: "Points" },
  { key: "form", label: "Form" },
  { key: "value", label: "Value" },
];

function getSortedPlayers(
  players: EnrichedPlayer[],
  tab: Tab,
): EnrichedPlayer[] {
  const sorted = [...players];
  switch (tab) {
    case "points":
      sorted.sort((a, b) => b.total_points - a.total_points);
      break;
    case "form":
      sorted.sort((a, b) => getPlayerForm(b) - getPlayerForm(a));
      break;
    case "value":
      sorted.sort((a, b) => getPlayerValueScore(b) - getPlayerValueScore(a));
      break;
  }
  return sorted.slice(0, 10);
}

function getStatValue(player: EnrichedPlayer, tab: Tab): string {
  switch (tab) {
    case "points":
      return `${player.total_points}`;
    case "form":
      return getPlayerForm(player).toFixed(1);
    case "value":
      return getPlayerValueScore(player).toFixed(1);
  }
}

function getStatHeader(tab: Tab): string {
  switch (tab) {
    case "points":
      return "Pts";
    case "form":
      return "Form";
    case "value":
      return "Val";
  }
}

export function TopPlayersTable({ players }: { players: EnrichedPlayer[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("points");

  // Memoize sorted players to avoid re-sorting on every render
  const sorted = useMemo(
    () => getSortedPlayers(players, activeTab),
    [players, activeTab],
  );

  // Memoize columns to avoid recreating on every render
  const columns: Column<EnrichedPlayer>[] = useMemo(
    () => [
      {
        key: "rank",
        header: "#",
        className: "w-8",
        render: (_, i) => <span className="text-fpl-muted">{i + 1}</span>,
      },
      {
        key: "name",
        header: "Player",
        render: (p) => (
          <div>
            <span className="font-medium">{getPlayerDisplayName(p)}</span>
            <span className="ml-2 text-xs text-fpl-muted">
              {p.team_short_name}
            </span>
          </div>
        ),
      },
      {
        key: "pos",
        header: "Pos",
        className: "w-12",
        render: (p) => (
          <PositionBadge position={p.element_type} label={p.position_short} />
        ),
      },
      {
        key: "price",
        header: "Price",
        className: "w-16 text-right",
        render: (p) => (
          <span className="text-fpl-muted">{getPlayerPrice(p)}</span>
        ),
      },
      {
        key: "stat",
        header: getStatHeader(activeTab),
        className: "w-14 text-right",
        render: (p) => (
          <span className="font-semibold text-fpl-green">
            {getStatValue(p, activeTab)}
          </span>
        ),
      },
    ],
    [activeTab],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Top Players</CardTitle>
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-fpl-green/20 text-fpl-green"
                    : "text-fpl-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={sorted} keyExtractor={(p) => p.id} />
      </CardContent>
    </Card>
  );
}
