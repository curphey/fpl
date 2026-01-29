"use client";

import { useInjuryUpdates } from "@/lib/claude/hooks";
import type { InjuryUpdate } from "@/lib/claude/news-types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  injured: "bg-fpl-danger/20 text-fpl-danger",
  doubtful: "bg-yellow-500/20 text-yellow-400",
  fit: "bg-fpl-green/20 text-fpl-green",
  suspended: "bg-purple-500/20 text-purple-400",
  unknown: "bg-fpl-muted/20 text-fpl-muted",
};

const statusLabels = {
  injured: "Injured",
  doubtful: "Doubtful",
  fit: "Fit",
  suspended: "Suspended",
  unknown: "Unknown",
};

function InjuryCard({ injury }: { injury: InjuryUpdate }) {
  return (
    <div className="rounded-lg border border-fpl-border bg-fpl-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{injury.playerName}</span>
          <span className="text-sm text-fpl-muted">{injury.team}</span>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[injury.status]}`}
        >
          {statusLabels[injury.status]}
        </span>
      </div>

      <p className="mb-2 text-sm text-fpl-muted">{injury.details}</p>

      {injury.expectedReturn && (
        <div className="mb-2 flex items-center gap-1 text-sm">
          <span className="text-fpl-muted">Expected return:</span>
          <span className="font-medium text-fpl-green">
            {injury.expectedReturn}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-fpl-muted">
        <span>Source: {injury.source}</span>
        <span>Updated: {new Date(injury.updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

interface InjuryTrackerProps {
  players?: string[];
}

export function InjuryTracker({ players }: InjuryTrackerProps) {
  const { injuries, isLoading, error, refetch } = useInjuryUpdates(players);

  // Group by status
  const injuredPlayers = injuries.filter((i) => i.status === "injured");
  const doubtfulPlayers = injuries.filter((i) => i.status === "doubtful");
  const suspendedPlayers = injuries.filter((i) => i.status === "suspended");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fpl-muted">
          Latest injury updates from press conferences and news sources
        </p>
        <button
          onClick={refetch}
          disabled={isLoading}
          className="rounded-lg bg-fpl-card px-3 py-1.5 text-xs font-medium text-fpl-muted transition-colors hover:bg-fpl-card-hover hover:text-foreground disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-fpl-border"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-fpl-danger">
              {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Injury lists */}
      {!isLoading && !error && (
        <>
          {/* Injured */}
          {injuredPlayers.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-fpl-danger" />
                Injured ({injuredPlayers.length})
              </h3>
              <div className="space-y-3">
                {injuredPlayers.map((injury, idx) => (
                  <InjuryCard
                    key={`${injury.playerName}-${idx}`}
                    injury={injury}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Doubtful */}
          {doubtfulPlayers.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-yellow-400" />
                Doubtful ({doubtfulPlayers.length})
              </h3>
              <div className="space-y-3">
                {doubtfulPlayers.map((injury, idx) => (
                  <InjuryCard
                    key={`${injury.playerName}-${idx}`}
                    injury={injury}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Suspended */}
          {suspendedPlayers.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                Suspended ({suspendedPlayers.length})
              </h3>
              <div className="space-y-3">
                {suspendedPlayers.map((injury, idx) => (
                  <InjuryCard
                    key={`${injury.playerName}-${idx}`}
                    injury={injury}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {injuries.length === 0 && (
            <Card>
              <CardContent>
                <div className="py-12 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-fpl-green"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-4 text-sm text-fpl-muted">
                    No injury updates found
                  </p>
                  <p className="mt-1 text-xs text-fpl-muted">
                    All players appear to be fit
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
