"use client";

import { useState } from "react";
import type { TeamSetPieces, SetPieceAsset } from "@/lib/fpl/set-piece-tracker";
import { formatSetPieceDuties } from "@/lib/fpl/set-piece-tracker";
import { getPlayerDisplayName, getPlayerPrice } from "@/lib/fpl/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, PositionBadge } from "@/components/ui/badge";

type ViewMode = "top-assets" | "by-team";

function SetPieceAssetCard({ asset }: { asset: SetPieceAsset }) {
  const {
    player,
    isPrimaryPenalty,
    isPrimaryCorner,
    isPrimaryFreekick,
    setPieceValue,
  } = asset;

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
            <div className="mt-0.5 text-xs text-fpl-muted">
              {getPlayerPrice(player)} • {player.total_points} pts
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-xl font-bold ${setPieceValue >= 60 ? "text-fpl-green" : setPieceValue >= 40 ? "text-yellow-400" : "text-fpl-muted"}`}
          >
            {setPieceValue}
          </div>
          <div className="text-[10px] text-fpl-muted">SP Value</div>
        </div>
      </div>

      {/* Duty badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {isPrimaryPenalty && <Badge variant="green">Penalties</Badge>}
        {asset.duties.penalties === 2 && (
          <Badge variant="default">Pens (2nd)</Badge>
        )}
        {isPrimaryCorner && <Badge variant="green">Corners</Badge>}
        {asset.duties.corners === 2 && (
          <Badge variant="default">Corners (2nd)</Badge>
        )}
        {isPrimaryFreekick && <Badge variant="green">Free Kicks</Badge>}
        {asset.duties.directFreekicks === 2 && (
          <Badge variant="default">FKs (2nd)</Badge>
        )}
      </div>

      {/* Stats */}
      <div className="mt-3 flex items-center gap-4 text-xs">
        <div>
          <span className="text-fpl-muted">Goals: </span>
          <span>{player.goals_scored}</span>
        </div>
        <div>
          <span className="text-fpl-muted">Assists: </span>
          <span>{player.assists}</span>
        </div>
        <div>
          <span className="text-fpl-muted">Form: </span>
          <span>{player.form}</span>
        </div>
      </div>
    </div>
  );
}

function TeamSetPiecesCard({ team }: { team: TeamSetPieces }) {
  const hasPenalties = team.penalties.length > 0;
  const hasCorners = team.corners.length > 0;
  const hasFreekicks = team.directFreekicks.length > 0;

  if (!hasPenalties && !hasCorners && !hasFreekicks) {
    return null;
  }

  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      <h3 className="mb-3 font-semibold">
        {team.teamName}
        <span className="ml-2 text-xs font-normal text-fpl-muted">
          {team.teamShort}
        </span>
      </h3>

      <div className="space-y-3">
        {/* Penalties */}
        {hasPenalties && (
          <div>
            <div className="mb-1 text-xs font-medium text-fpl-muted">
              Penalties
            </div>
            <div className="space-y-1">
              {team.penalties.map((taker) => (
                <div
                  key={taker.player.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${taker.order === 1 ? "bg-fpl-green/20 text-fpl-green" : "bg-fpl-border text-fpl-muted"}`}
                    >
                      {taker.order}
                    </span>
                    <span>{getPlayerDisplayName(taker.player)}</span>
                  </div>
                  <span className="text-xs text-fpl-muted">
                    {getPlayerPrice(taker.player)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Corners */}
        {hasCorners && (
          <div>
            <div className="mb-1 text-xs font-medium text-fpl-muted">
              Corners & Indirect FKs
            </div>
            <div className="space-y-1">
              {team.corners.map((taker) => (
                <div
                  key={taker.player.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${taker.order === 1 ? "bg-fpl-green/20 text-fpl-green" : "bg-fpl-border text-fpl-muted"}`}
                    >
                      {taker.order}
                    </span>
                    <span>{getPlayerDisplayName(taker.player)}</span>
                  </div>
                  <span className="text-xs text-fpl-muted">
                    {getPlayerPrice(taker.player)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct Free Kicks */}
        {hasFreekicks && (
          <div>
            <div className="mb-1 text-xs font-medium text-fpl-muted">
              Direct Free Kicks
            </div>
            <div className="space-y-1">
              {team.directFreekicks.map((taker) => (
                <div
                  key={taker.player.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${taker.order === 1 ? "bg-fpl-green/20 text-fpl-green" : "bg-fpl-border text-fpl-muted"}`}
                    >
                      {taker.order}
                    </span>
                    <span>{getPlayerDisplayName(taker.player)}</span>
                  </div>
                  <span className="text-xs text-fpl-muted">
                    {getPlayerPrice(taker.player)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SetPieceTakersSection({
  topAssets,
  teamSetPieces,
}: {
  topAssets: SetPieceAsset[];
  teamSetPieces: TeamSetPieces[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("top-assets");

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("top-assets")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === "top-assets"
              ? "bg-fpl-green/20 text-fpl-green"
              : "bg-fpl-card text-fpl-muted hover:text-foreground"
          }`}
        >
          Top Set-Piece Assets
        </button>
        <button
          onClick={() => setViewMode("by-team")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === "by-team"
              ? "bg-fpl-green/20 text-fpl-green"
              : "bg-fpl-card text-fpl-muted hover:text-foreground"
          }`}
        >
          By Team
        </button>
      </div>

      {viewMode === "top-assets" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {topAssets.map((asset) => (
            <SetPieceAssetCard key={asset.player.id} asset={asset} />
          ))}
        </div>
      )}

      {viewMode === "by-team" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teamSetPieces.map((team) => (
            <TeamSetPiecesCard key={team.teamId} team={team} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-fpl-muted">
        <span>SP Value:</span>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-fpl-green" />
          <span>60+ High value</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-yellow-500" />
          <span>40-59 Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-fpl-muted" />
          <span>&lt;40 Backup</span>
        </div>
      </div>
    </div>
  );
}
