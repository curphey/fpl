"use client";

import { memo, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, PositionBadge } from "@/components/ui/badge";
import { useBootstrapStatic } from "@/lib/fpl/hooks/use-fpl";
import {
  enrichPlayers,
  getPlayerDisplayName,
  getPlayerPrice,
} from "@/lib/fpl/utils";
import {
  analyzeOwnershipMomentum,
  formatMomentumPercent,
  getMomentumColorClass,
  getMomentumBgClass,
  type OwnershipMomentum,
} from "@/lib/fpl/ownership-momentum";

const MomentumRow = memo(function MomentumRow({
  momentum,
  showRisk = false,
}: {
  momentum: OwnershipMomentum;
  showRisk?: boolean;
}) {
  const {
    player,
    momentumScore,
    netTransfers,
    trend,
    isDifferential,
    riskLevel,
  } = momentum;

  const formattedNet =
    netTransfers > 0
      ? `+${netTransfers.toLocaleString()}`
      : netTransfers.toLocaleString();

  return (
    <div className="flex items-center justify-between py-2 border-b border-fpl-border last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {getPlayerDisplayName(player)}
            </span>
            <PositionBadge
              position={player.element_type}
              label={player.position_short}
            />
            {isDifferential && (
              <Badge variant="pink" className="text-[10px]">
                Diff
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-fpl-muted">
            <span>{player.team_short_name}</span>
            <span>|</span>
            <span>{getPlayerPrice(player)}</span>
            <span>|</span>
            <span>{player.selected_by_percent}%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-xs text-fpl-muted">Net Transfers</p>
          <p
            className={`text-sm font-medium ${netTransfers > 0 ? "text-fpl-green" : "text-fpl-danger"}`}
          >
            {formattedNet}
          </p>
        </div>
        <div
          className={`px-2 py-1 rounded text-sm font-semibold ${getMomentumBgClass(momentumScore)} ${getMomentumColorClass(momentumScore)}`}
        >
          {formatMomentumPercent(momentumScore)}
        </div>
        {showRisk && riskLevel !== "none" && (
          <Badge
            variant={
              riskLevel === "high"
                ? "danger"
                : riskLevel === "medium"
                  ? "pink"
                  : "default"
            }
          >
            {riskLevel}
          </Badge>
        )}
      </div>
    </div>
  );
});

const MomentumSection = memo(function MomentumSection({
  title,
  items,
  emptyMessage,
  showRisk = false,
}: {
  title: string;
  items: OwnershipMomentum[];
  emptyMessage: string;
  showRisk?: boolean;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fpl-muted">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {items.map((momentum) => (
            <MomentumRow
              key={momentum.player.id}
              momentum={momentum}
              showRisk={showRisk}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

export function MomentumTracker() {
  const { data: bootstrap, isLoading, error } = useBootstrapStatic();

  const analysis = useMemo(() => {
    if (!bootstrap) return null;
    const enriched = enrichPlayers(bootstrap);
    return analyzeOwnershipMomentum(enriched);
  }, [bootstrap]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 w-32 bg-fpl-purple-light rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(5)].map((_, j) => (
                  <div
                    key={j}
                    className="h-12 bg-fpl-purple-light rounded animate-pulse"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-fpl-danger">Failed to load momentum data</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-xs text-fpl-muted uppercase">Players Tracked</p>
            <p className="text-2xl font-bold text-fpl-green">
              {analysis.stats.totalPlayersAnalyzed}
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-xs text-fpl-muted uppercase">Top Rising</p>
            <p className="text-lg font-bold text-fpl-green truncate">
              {analysis.stats.highestMomentum
                ? getPlayerDisplayName(analysis.stats.highestMomentum.player)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-xs text-fpl-muted uppercase">Top Falling</p>
            <p className="text-lg font-bold text-fpl-danger truncate">
              {analysis.stats.lowestMomentum
                ? getPlayerDisplayName(analysis.stats.lowestMomentum.player)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <p className="text-xs text-fpl-muted uppercase">Avg Momentum</p>
            <p
              className={`text-2xl font-bold ${getMomentumColorClass(analysis.stats.averageMomentum)}`}
            >
              {formatMomentumPercent(analysis.stats.averageMomentum)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <MomentumSection
          title="Rising Stars"
          items={analysis.risingStars}
          emptyMessage="No players with strong positive momentum"
        />
        <MomentumSection
          title="Falling Assets"
          items={analysis.fallingAssets}
          emptyMessage="No players with strong negative momentum"
          showRisk
        />
        <MomentumSection
          title="Emerging Differentials"
          items={analysis.emergingDifferentials}
          emptyMessage="No differentials gaining traction"
        />
        <MomentumSection
          title="Template Exits"
          items={analysis.templateExits}
          emptyMessage="No highly-owned players losing favor"
          showRisk
        />
      </div>
    </div>
  );
}
