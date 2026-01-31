"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PositionBadge } from "@/components/ui/badge";
import type {
  DraftPlayer,
  PositionFilter,
  ADPTier,
} from "@/lib/fpl/draft-types";

interface DraftRankingsTableProps {
  players: DraftPlayer[];
}

type SortKey = "adp" | "points" | "form" | "xgi" | "ownership" | "value";

const TIER_COLORS: Record<ADPTier, string> = {
  elite: "text-yellow-400",
  premium: "text-fpl-green",
  mid: "text-blue-400",
  value: "text-gray-300",
  bench: "text-gray-500",
};

interface SortHeaderProps {
  label: string;
  sortKeyName: SortKey;
  className?: string;
  currentSortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}

const SortHeader = memo(function SortHeader({
  label,
  sortKeyName,
  className = "",
  currentSortKey,
  sortAsc,
  onSort,
}: SortHeaderProps) {
  return (
    <th
      className={`px-2 py-2 text-left text-xs font-medium text-fpl-muted cursor-pointer hover:text-white transition-colors ${className}`}
      onClick={() => onSort(sortKeyName)}
    >
      {label}
      {currentSortKey === sortKeyName && (
        <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
      )}
    </th>
  );
});

export const DraftRankingsTable = memo(function DraftRankingsTable({
  players,
}: DraftRankingsTableProps) {
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("adp");
  const [sortAsc, setSortAsc] = useState(true);
  const [tierFilter, setTierFilter] = useState<ADPTier | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAndSorted = useMemo(() => {
    let result = [...players];

    // Position filter
    if (positionFilter !== "ALL") {
      result = result.filter((p) => p.position === positionFilter);
    }

    // Tier filter
    if (tierFilter !== "ALL") {
      result = result.filter((p) => p.adpTier === tierFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.team.toLowerCase().includes(query),
      );
    }

    // Sort
    result.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "adp":
          diff = a.estimatedADP - b.estimatedADP;
          break;
        case "points":
          diff = b.totalPoints - a.totalPoints;
          break;
        case "form":
          diff = b.form - a.form;
          break;
        case "xgi":
          diff = b.xgi - a.xgi;
          break;
        case "ownership":
          diff = b.ownership - a.ownership;
          break;
        case "value":
          diff = b.valueVsADP - a.valueVsADP;
          break;
      }
      return sortAsc ? diff : -diff;
    });

    return result;
  }, [players, positionFilter, sortKey, sortAsc, tierFilter, searchQuery]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortAsc(!sortAsc);
      } else {
        setSortKey(key);
        setSortAsc(key === "adp"); // ADP ascending by default, others descending
      }
    },
    [sortKey, sortAsc],
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search players or teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm"
              />
            </div>

            {/* Position Filter */}
            <div className="flex gap-1">
              {(["ALL", "GK", "DEF", "MID", "FWD"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPositionFilter(pos)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    positionFilter === pos
                      ? "bg-fpl-purple text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>

            {/* Tier Filter */}
            <div className="flex gap-1">
              {(
                ["ALL", "elite", "premium", "mid", "value", "bench"] as const
              ).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
                    tierFilter === tier
                      ? "bg-fpl-purple text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rankings Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>ADP Rankings</span>
            <span className="text-sm font-normal text-fpl-muted">
              {filteredAndSorted.length} players
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <SortHeader
                    label="Rank"
                    sortKeyName="adp"
                    className="w-14"
                    currentSortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                  />
                  <th className="px-2 py-2 text-left text-xs font-medium text-fpl-muted">
                    Player
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-fpl-muted">
                    Team
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-fpl-muted">
                    Pos
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-fpl-muted">
                    Tier
                  </th>
                  <SortHeader
                    label="Pts"
                    sortKeyName="points"
                    className="text-center"
                    currentSortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Form"
                    sortKeyName="form"
                    className="text-center"
                    currentSortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="xGI"
                    sortKeyName="xgi"
                    className="text-center"
                    currentSortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Own%"
                    sortKeyName="ownership"
                    className="text-center"
                    currentSortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                  />
                  <SortHeader
                    label="Value"
                    sortKeyName="value"
                    className="text-center"
                    currentSortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.slice(0, 100).map((player, index) => (
                  <tr
                    key={player.id}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                      index % 2 === 0 ? "" : "bg-gray-900/20"
                    }`}
                  >
                    <td className="px-2 py-2 text-sm font-medium">
                      {player.estimatedADP}
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-medium">{player.name}</span>
                    </td>
                    <td className="px-2 py-2 text-sm text-fpl-muted">
                      {player.teamShort}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <PositionBadge
                        position={player.positionId}
                        label={player.position}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`text-xs font-medium capitalize ${TIER_COLORS[player.adpTier]}`}
                      >
                        {player.adpTier}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center text-sm">
                      {player.totalPoints}
                    </td>
                    <td className="px-2 py-2 text-center text-sm">
                      {player.form.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-center text-sm">
                      {player.xgi.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-center text-sm">
                      {player.ownership.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-center">
                      {player.valueVsADP > 5 ? (
                        <Badge variant="green">+{player.valueVsADP}</Badge>
                      ) : player.valueVsADP < -5 ? (
                        <Badge variant="danger">{player.valueVsADP}</Badge>
                      ) : (
                        <span className="text-sm text-fpl-muted">
                          {player.valueVsADP}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSorted.length > 100 && (
            <p className="text-xs text-fpl-muted text-center mt-4">
              Showing top 100 of {filteredAndSorted.length} players. Use filters
              to narrow results.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tier Legend */}
      <Card>
        <CardContent className="py-4">
          <h4 className="text-sm font-medium mb-3">ADP Tier Guide</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className={`font-medium ${TIER_COLORS.elite}`}>
                Elite (1-20)
              </span>
              <p className="text-xs text-fpl-muted">
                Top tier, franchise players
              </p>
            </div>
            <div>
              <span className={`font-medium ${TIER_COLORS.premium}`}>
                Premium (21-60)
              </span>
              <p className="text-xs text-fpl-muted">
                Strong starters, reliable points
              </p>
            </div>
            <div>
              <span className={`font-medium ${TIER_COLORS.mid}`}>
                Mid (61-120)
              </span>
              <p className="text-xs text-fpl-muted">
                Solid depth, upside potential
              </p>
            </div>
            <div>
              <span className={`font-medium ${TIER_COLORS.value}`}>
                Value (121-180)
              </span>
              <p className="text-xs text-fpl-muted">
                Rotation options, matchup plays
              </p>
            </div>
            <div>
              <span className={`font-medium ${TIER_COLORS.bench}`}>
                Bench (181+)
              </span>
              <p className="text-xs text-fpl-muted">Emergency cover only</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
