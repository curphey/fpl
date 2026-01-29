"use client";

import type {
  RivalChipAnalysis,
  RivalChipStatus,
} from "@/lib/fpl/league-analyzer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ChipBadge({ has, label }: { has: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
        has
          ? "bg-fpl-green/20 text-fpl-green"
          : "bg-fpl-border text-fpl-muted line-through"
      }`}
    >
      {label}
    </span>
  );
}

function RivalChipRow({ rival }: { rival: RivalChipStatus }) {
  const gapDisplay =
    rival.pointsGap > 0
      ? `+${rival.pointsGap}`
      : rival.pointsGap < 0
        ? rival.pointsGap.toString()
        : "0";

  return (
    <div className="flex items-center justify-between border-b border-fpl-border py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fpl-purple-light text-xs font-bold">
          {rival.rank}
        </div>
        <div>
          <div className="font-medium">{rival.playerName}</div>
          <div className="text-xs text-fpl-muted">{rival.name}</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-wrap gap-1">
          <ChipBadge has={rival.hasWildcard} label="WC" />
          <ChipBadge has={rival.hasFreehit} label="FH" />
          <ChipBadge has={rival.hasTripleCaptain} label="TC" />
          <ChipBadge has={rival.hasBenchBoost} label="BB" />
        </div>
        <div
          className={`w-16 text-right text-sm font-medium ${
            rival.pointsGap > 0
              ? "text-fpl-danger"
              : rival.pointsGap < 0
                ? "text-fpl-green"
                : "text-fpl-muted"
          }`}
        >
          {gapDisplay}
        </div>
      </div>
    </div>
  );
}

export function RivalChipsSection({
  analysis,
}: {
  analysis: RivalChipAnalysis;
}) {
  const { rivals, chipAdvantages, activeChipAlerts, summary } = analysis;

  return (
    <div className="space-y-4">
      {/* Active chip alerts */}
      {activeChipAlerts.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-400">
            <span>⚠️</span>
            <span>Chip Alert</span>
          </div>
          <div className="mt-1 text-sm text-foreground">
            {activeChipAlerts.map((alert, i) => (
              <span key={i}>
                {i > 0 && ", "}
                <span className="font-medium">
                  {alert.rivalName}
                </span> played{" "}
                <span className="text-yellow-400">{alert.chip}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chip advantages */}
      <Card>
        <CardHeader>
          <CardTitle>Your Chip Advantages</CardTitle>
          <p className="text-xs text-fpl-muted">{summary}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {chipAdvantages.map((adv) => (
              <div
                key={adv.chip}
                className={`rounded-lg border p-3 ${
                  adv.userHas
                    ? "border-fpl-green/30 bg-fpl-green/5"
                    : "border-fpl-border bg-fpl-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{adv.label}</span>
                  {adv.userHas ? (
                    <Badge variant="green">You have</Badge>
                  ) : (
                    <Badge variant="default">Used</Badge>
                  )}
                </div>
                {adv.userHas && adv.rivalsWithout > 0 && (
                  <p className="mt-1 text-xs text-fpl-green">
                    {adv.rivalsWithout} rival
                    {adv.rivalsWithout !== 1 ? "s" : ""} don&apos;t have it
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rival chip matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Rival Chip Status</CardTitle>
            <Badge variant="default">{rivals.length} rivals</Badge>
          </div>
          <p className="text-xs text-fpl-muted">
            Chips remaining for each rival • Gap shows points difference from
            you
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-fpl-border">
            {rivals.length > 0 ? (
              rivals.map((rival) => (
                <RivalChipRow key={rival.entry} rival={rival} />
              ))
            ) : (
              <p className="py-4 text-center text-sm text-fpl-muted">
                No rival chip data available
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-fpl-muted">
        <span>Legend:</span>
        <div className="flex items-center gap-1">
          <span className="inline-block rounded bg-fpl-green/20 px-1.5 py-0.5 text-fpl-green">
            WC
          </span>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block rounded bg-fpl-border px-1.5 py-0.5 text-fpl-muted line-through">
            WC
          </span>
          <span>Used</span>
        </div>
      </div>
    </div>
  );
}
