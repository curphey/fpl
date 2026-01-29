"use client";

import type { ReturningPlayer } from "@/lib/fpl/injury-tracker";
import type { EnrichedPlayer } from "@/lib/fpl/utils";
import { getPlayerDisplayName, getPlayerPrice } from "@/lib/fpl/utils";
import { PositionBadge, Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function valueRatingColor(rating: number): string {
  if (rating >= 70) return "text-fpl-green";
  if (rating >= 50) return "text-yellow-400";
  return "text-fpl-muted";
}

function valueRatingBg(rating: number): string {
  if (rating >= 70) return "bg-fpl-green";
  if (rating >= 50) return "bg-yellow-500";
  return "bg-fpl-muted";
}

function ReturningPlayerCard({ data }: { data: ReturningPlayer }) {
  const {
    player,
    status,
    chanceOfPlaying,
    priceChange,
    valueRating,
    reasoning,
  } = data;

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <PositionBadge
            position={player.element_type}
            label={player.position_short}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {getPlayerDisplayName(player)}
              </span>
              <span className="text-xs text-fpl-muted">
                {player.team_short_name}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs">
              <span className="text-fpl-muted">{getPlayerPrice(player)}</span>
              {priceChange !== 0 && (
                <span
                  className={
                    priceChange < 0 ? "text-fpl-danger" : "text-fpl-green"
                  }
                >
                  ({priceChange > 0 ? "+" : ""}
                  {priceChange.toFixed(1)}m)
                </span>
              )}
              <span className="text-fpl-muted">•</span>
              <span className="text-fpl-muted">
                {data.ownershipPercent.toFixed(1)}% owned
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${valueRatingColor(valueRating)}`}>
            {valueRating}
          </div>
          <div className="text-[10px] text-fpl-muted">Value Score</div>
        </div>
      </div>

      {/* Value bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-fpl-border">
        <div
          className={`h-1.5 rounded-full ${valueRatingBg(valueRating)}`}
          style={{ width: `${valueRating}%` }}
        />
      </div>

      {/* Status badge */}
      <div className="mt-3 flex items-center gap-2">
        {status === "available" ? (
          <Badge variant="green">Available</Badge>
        ) : (
          <Badge variant="pink">{chanceOfPlaying}% chance</Badge>
        )}
        <span className="text-xs text-fpl-muted">
          FDR: {data.upcomingFdr.toFixed(1)}
        </span>
        <span className="text-xs text-fpl-muted">
          Pre-injury: {data.preInjuryForm.toFixed(1)} pts/gm
        </span>
      </div>

      {/* Reasoning */}
      <ul className="mt-3 space-y-1">
        {reasoning.slice(0, 3).map((reason, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-fpl-muted">
            <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-fpl-muted" />
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WatchlistPlayer({ player }: { player: EnrichedPlayer }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <PositionBadge
          position={player.element_type}
          label={player.position_short}
        />
        <span className="text-sm font-medium">
          {getPlayerDisplayName(player)}
        </span>
        <span className="text-xs text-fpl-muted">{player.team_short_name}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-fpl-muted">{getPlayerPrice(player)}</span>
        <Badge variant="danger">
          {player.status === "i"
            ? "Injured"
            : player.status === "s"
              ? "Suspended"
              : "Unavailable"}
        </Badge>
      </div>
    </div>
  );
}

export function InjuryReturnsSection({
  returning,
  watchlist,
}: {
  returning: ReturningPlayer[];
  watchlist: EnrichedPlayer[];
}) {
  if (returning.length === 0 && watchlist.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Returning Players */}
      {returning.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Returning from Injury</CardTitle>
              <Badge variant="green">{returning.length}</Badge>
            </div>
            <p className="text-xs text-fpl-muted">
              Players back from injury who may be undervalued
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {returning.map((r) => (
                <ReturningPlayerCard key={r.player.id} data={r} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Injury Watchlist */}
      {watchlist.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Injury Watchlist</CardTitle>
              <Badge variant="danger">{watchlist.length}</Badge>
            </div>
            <p className="text-xs text-fpl-muted">
              High-value players currently injured - monitor for return
            </p>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-fpl-border">
              {watchlist.map((player) => (
                <WatchlistPlayer key={player.id} player={player} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
