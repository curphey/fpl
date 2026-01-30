"use client";

import { useState } from "react";
import type {
  OptimizationType,
  TransferConstraints,
  TeamContext,
} from "@/lib/claude/types";
import { useManagerContext } from "@/lib/fpl/manager-context";
import {
  useManager,
  useManagerPicks,
  useBootstrapStatic,
} from "@/lib/fpl/hooks/use-fpl";
import { getCurrentGameweek } from "@/lib/fpl/utils";

interface OptimizeFormProps {
  onSubmit: (data: {
    type: OptimizationType;
    query: string;
    constraints: TransferConstraints;
    currentTeam?: TeamContext;
  }) => void;
  isLoading: boolean;
}

const EXAMPLE_QUERIES: Record<OptimizationType, string[]> = {
  transfer: [
    "Find the best 2 transfers within £1.5m budget",
    "Who should I bring in for the double gameweek?",
    "Best premium midfielder to replace Salah?",
  ],
  chip: [
    "When should I use my Bench Boost?",
    "Is this a good week for Triple Captain?",
    "Should I Free Hit this blank gameweek?",
  ],
  wildcard: [
    "Build me a team for the next 8 gameweeks",
    "Wildcard template targeting the double gameweek",
    "Differential-heavy wildcard to climb my mini-league",
  ],
};

export function OptimizeForm({ onSubmit, isLoading }: OptimizeFormProps) {
  const [type, setType] = useState<OptimizationType>("transfer");
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState("2.0");
  const [maxTransfers, setMaxTransfers] = useState("2");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preferDifferentials, setPreferDifferentials] = useState(false);
  const [includeSquad, setIncludeSquad] = useState(true);

  // Manager context
  const { managerId } = useManagerContext();
  const { data: bootstrap } = useBootstrapStatic();
  const { data: entry } = useManager(managerId);
  const currentGw = bootstrap
    ? (getCurrentGameweek(bootstrap.events)?.id ?? 1)
    : 1;
  const { data: picks } = useManagerPicks(managerId, currentGw);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    // Build squad context if available and enabled
    let currentTeam: TeamContext | undefined;
    if (includeSquad && picks && bootstrap && entry) {
      const posMap: Record<number, string> = {
        1: "GK",
        2: "DEF",
        3: "MID",
        4: "FWD",
      };
      const squadPlayers = picks.picks.map((pick) => {
        const player = bootstrap.elements.find((p) => p.id === pick.element);
        const team = bootstrap.teams.find((t) => t.id === player?.team);
        return {
          id: pick.element,
          name: player?.web_name || "Unknown",
          position: posMap[player?.element_type ?? 0] || "???",
          team: team?.short_name || "???",
          price: (player?.now_cost ?? 0) / 10,
        };
      });

      currentTeam = {
        players: squadPlayers,
        bank: (entry.last_deadline_bank ?? 0) / 10,
        freeTransfers: entry.last_deadline_total_transfers === 0 ? 1 : 1,
        chipsUsed: [], // Would need chip history to populate
      };
    }

    onSubmit({
      type,
      query: query.trim(),
      constraints: {
        budget: parseFloat(budget) || 2.0,
        maxTransfers: parseInt(maxTransfers, 10) || 2,
        preferDifferentials,
        lookAheadWeeks: 5,
      },
      currentTeam,
    });
  }

  function handleExampleClick(example: string) {
    setQuery(example);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type selector */}
      <div className="flex items-center gap-2">
        {(
          [
            { key: "transfer", label: "Transfers" },
            { key: "chip", label: "Chip Timing" },
            { key: "wildcard", label: "Wildcard" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              type === t.key
                ? "bg-fpl-green/20 text-fpl-green"
                : "bg-fpl-card text-fpl-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Query input */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-fpl-muted">
          What do you want to optimize?
        </label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., Find the best 2 transfers within £1.5m budget"
          className="w-full resize-none rounded-lg border border-fpl-border bg-fpl-card px-4 py-3 text-sm text-foreground placeholder-fpl-muted outline-none focus:border-fpl-green"
          rows={2}
        />
      </div>

      {/* Example queries */}
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_QUERIES[type].map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExampleClick(example)}
            className="rounded-full bg-fpl-purple-light px-2.5 py-1 text-xs text-fpl-muted transition-colors hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>

      {/* Constraints (for transfer type) */}
      {type === "transfer" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-fpl-muted hover:text-foreground"
          >
            {showAdvanced ? "- Hide" : "+ Show"} constraints
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-fpl-border bg-fpl-purple-light/50 p-3">
              <div>
                <label className="mb-1 block text-xs text-fpl-muted">
                  Budget (£m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full rounded border border-fpl-border bg-fpl-card px-2 py-1.5 text-sm outline-none focus:border-fpl-green"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-fpl-muted">
                  Max Transfers
                </label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={maxTransfers}
                  onChange={(e) => setMaxTransfers(e.target.value)}
                  className="w-full rounded border border-fpl-border bg-fpl-card px-2 py-1.5 text-sm outline-none focus:border-fpl-green"
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={preferDifferentials}
                    onChange={(e) => setPreferDifferentials(e.target.checked)}
                    className="rounded border-fpl-border"
                  />
                  <span className="text-fpl-muted">
                    Prefer differentials (&lt;10% ownership)
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Squad context toggle */}
      <div className="rounded-lg border border-fpl-border bg-fpl-purple-light/50 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Squad Context</p>
            <p className="text-xs text-fpl-muted">
              {managerId
                ? "Include your current squad for personalized recommendations"
                : "Connect your FPL ID on the Team page for personalized optimization"}
            </p>
          </div>
          {managerId && (
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={includeSquad}
                onChange={(e) => setIncludeSquad(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-fpl-border after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-fpl-green peer-checked:after:translate-x-full" />
            </label>
          )}
        </div>
        {managerId && picks && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {picks.picks.slice(0, 11).map((pick) => {
              const player = bootstrap?.elements.find(
                (p) => p.id === pick.element,
              );
              return (
                <span
                  key={pick.element}
                  className="rounded bg-fpl-card px-1.5 py-0.5 text-xs text-fpl-muted"
                >
                  {player?.web_name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!query.trim() || isLoading}
        className="w-full rounded-lg bg-fpl-green px-4 py-2.5 text-sm font-bold text-fpl-purple transition-opacity disabled:opacity-40"
      >
        {isLoading ? "Thinking..." : "Optimize with Claude"}
      </button>
    </form>
  );
}
