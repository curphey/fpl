"use client";

import type {
  FixtureSwingAnalysis,
  FixtureSwingAlert,
  TeamFdrWindow,
} from "@/lib/fpl/fixture-swing";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function AlertIcon({ type }: { type: FixtureSwingAlert["alertType"] }) {
  if (type === "green_run" || type === "improving") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fpl-green/20">
        <span className="text-fpl-green">↗</span>
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fpl-danger/20">
      <span className="text-fpl-danger">↘</span>
    </div>
  );
}

function AlertCard({ alert }: { alert: FixtureSwingAlert }) {
  const isPositive =
    alert.alertType === "green_run" || alert.alertType === "improving";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-fpl-border bg-fpl-card p-3">
      <AlertIcon type={alert.alertType} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{alert.teamShort}</span>
          <Badge variant={isPositive ? "green" : "destructive"}>
            {alert.alertType === "green_run"
              ? "Green Run"
              : alert.alertType === "red_run"
                ? "Tough Run"
                : alert.alertType === "improving"
                  ? "Improving"
                  : "Worsening"}
          </Badge>
          {alert.severity === "high" && (
            <span className="text-xs text-yellow-400">High impact</span>
          )}
        </div>
        <p className="mt-1 text-sm text-fpl-muted">{alert.message}</p>
        <div className="mt-2 flex items-center gap-4 text-xs">
          <span>
            <span className="text-fpl-muted">FDR: </span>
            <span className={isPositive ? "text-fpl-green" : "text-fpl-danger"}>
              {alert.fdrBefore} → {alert.fdrAfter}
            </span>
          </span>
          <span className="text-fpl-muted">
            GW{alert.windowStart}-{alert.windowEnd}
          </span>
        </div>
      </div>
    </div>
  );
}

function TeamFdrCard({
  team,
  variant,
}: {
  team: TeamFdrWindow;
  variant: "target" | "avoid";
}) {
  const isTarget = variant === "target";

  return (
    <div className="flex items-center justify-between rounded-lg border border-fpl-border bg-fpl-card p-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
            isTarget
              ? "bg-fpl-green/20 text-fpl-green"
              : "bg-fpl-danger/20 text-fpl-danger"
          }`}
        >
          {team.teamShort.slice(0, 3)}
        </div>
        <div>
          <span className="font-medium">{team.teamName}</span>
          {team.trend !== "stable" && (
            <span className="ml-2 text-xs text-fpl-muted">
              {team.trend === "improving" ? "↗ Improving" : "↘ Worsening"}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div
          className={`text-lg font-bold ${
            team.currentFdr <= 2.5
              ? "text-fpl-green"
              : team.currentFdr >= 3.5
                ? "text-fpl-danger"
                : "text-yellow-400"
          }`}
        >
          {team.currentFdr}
        </div>
        <div className="text-xs text-fpl-muted">Avg FDR</div>
      </div>
    </div>
  );
}

export function FixtureSwingAlerts({
  analysis,
}: {
  analysis: FixtureSwingAnalysis;
}) {
  const { alerts, bestTeamsToTarget, teamsToAvoid } = analysis;

  const positiveAlerts = alerts.filter(
    (a) => a.alertType === "green_run" || a.alertType === "improving",
  );
  const negativeAlerts = alerts.filter(
    (a) => a.alertType === "red_run" || a.alertType === "worsening",
  );

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fixture Swing Alerts</CardTitle>
            <p className="text-xs text-fpl-muted">
              Significant FDR changes detected — adjust your transfers
              accordingly
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {/* Positive alerts */}
              {positiveAlerts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-fpl-green">
                    <span className="h-2 w-2 rounded-full bg-fpl-green" />
                    Target
                  </h3>
                  {positiveAlerts.slice(0, 3).map((alert) => (
                    <AlertCard
                      key={`${alert.teamId}-${alert.alertType}`}
                      alert={alert}
                    />
                  ))}
                </div>
              )}

              {/* Negative alerts */}
              {negativeAlerts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-fpl-danger">
                    <span className="h-2 w-2 rounded-full bg-fpl-danger" />
                    Avoid / Sell
                  </h3>
                  {negativeAlerts.slice(0, 3).map((alert) => (
                    <AlertCard
                      key={`${alert.teamId}-${alert.alertType}`}
                      alert={alert}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Teams & Teams to Avoid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Best Teams to Target */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Best Teams to Target</CardTitle>
              <Badge variant="green">{bestTeamsToTarget.length}</Badge>
            </div>
            <p className="text-xs text-fpl-muted">
              Teams with easy upcoming fixtures
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bestTeamsToTarget.map((team) => (
                <TeamFdrCard key={team.teamId} team={team} variant="target" />
              ))}
              {bestTeamsToTarget.length === 0 && (
                <p className="py-4 text-center text-sm text-fpl-muted">
                  No standout teams to target
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Teams to Avoid */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Teams to Avoid</CardTitle>
              <Badge variant="destructive">{teamsToAvoid.length}</Badge>
            </div>
            <p className="text-xs text-fpl-muted">
              Teams with tough upcoming fixtures
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamsToAvoid.map((team) => (
                <TeamFdrCard key={team.teamId} team={team} variant="avoid" />
              ))}
              {teamsToAvoid.length === 0 && (
                <p className="py-4 text-center text-sm text-fpl-muted">
                  No teams to particularly avoid
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
