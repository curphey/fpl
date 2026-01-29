import type { Fixture, Team } from "./types";

export interface TeamFdrWindow {
  teamId: number;
  teamName: string;
  teamShort: string;
  currentFdr: number; // Average FDR for current window
  nextFdr: number; // Average FDR for next window
  change: number; // Positive = improving, negative = worsening
  fixtureCount: number;
  trend: "improving" | "worsening" | "stable";
}

export interface FixtureSwingAlert {
  teamId: number;
  teamName: string;
  teamShort: string;
  alertType: "green_run" | "red_run" | "improving" | "worsening";
  message: string;
  fdrBefore: number;
  fdrAfter: number;
  fdrChange: number;
  windowStart: number;
  windowEnd: number;
  severity: "high" | "medium" | "low";
}

export interface FixtureSwingAnalysis {
  alerts: FixtureSwingAlert[];
  teamRankings: TeamFdrWindow[];
  bestTeamsToTarget: TeamFdrWindow[];
  teamsToAvoid: TeamFdrWindow[];
}

/**
 * Calculate rolling FDR for a team over a window of gameweeks.
 */
function calculateTeamFdr(
  teamId: number,
  fixtures: Fixture[],
  gwStart: number,
  gwEnd: number,
): { avgFdr: number; fixtureCount: number } {
  const teamFixtures = fixtures.filter(
    (f) =>
      f.event !== null &&
      f.event >= gwStart &&
      f.event <= gwEnd &&
      (f.team_h === teamId || f.team_a === teamId),
  );

  if (teamFixtures.length === 0) {
    return { avgFdr: 5, fixtureCount: 0 }; // No fixtures = worst case
  }

  const totalFdr = teamFixtures.reduce((sum, f) => {
    const isHome = f.team_h === teamId;
    return sum + (isHome ? f.team_h_difficulty : f.team_a_difficulty);
  }, 0);

  return {
    avgFdr: totalFdr / teamFixtures.length,
    fixtureCount: teamFixtures.length,
  };
}

/**
 * Analyze fixture swings for all teams comparing current vs upcoming windows.
 */
export function analyzeFixtureSwings(
  teams: Team[],
  fixtures: Fixture[],
  currentGwId: number,
  windowSize: number = 5,
): FixtureSwingAnalysis {
  const alerts: FixtureSwingAlert[] = [];
  const teamRankings: TeamFdrWindow[] = [];

  // Current window: next 5 GWs
  // Next window: GWs after that
  const currentStart = currentGwId;
  const currentEnd = Math.min(currentGwId + windowSize - 1, 38);
  const nextStart = currentEnd + 1;
  const nextEnd = Math.min(nextStart + windowSize - 1, 38);

  for (const team of teams) {
    const current = calculateTeamFdr(
      team.id,
      fixtures,
      currentStart,
      currentEnd,
    );
    const next = calculateTeamFdr(team.id, fixtures, nextStart, nextEnd);

    const change = current.avgFdr - next.avgFdr; // Positive = next window is easier
    let trend: "improving" | "worsening" | "stable" = "stable";
    if (change > 0.5) trend = "improving";
    else if (change < -0.5) trend = "worsening";

    const teamWindow: TeamFdrWindow = {
      teamId: team.id,
      teamName: team.name,
      teamShort: team.short_name,
      currentFdr: Math.round(current.avgFdr * 10) / 10,
      nextFdr: Math.round(next.avgFdr * 10) / 10,
      change: Math.round(change * 10) / 10,
      fixtureCount: current.fixtureCount,
      trend,
    };
    teamRankings.push(teamWindow);

    // Generate alerts for significant swings
    if (Math.abs(change) >= 0.8) {
      const isImproving = change > 0;
      let alertType: FixtureSwingAlert["alertType"];
      let severity: FixtureSwingAlert["severity"] = "medium";
      let message: string;

      if (isImproving && next.avgFdr <= 2.5) {
        alertType = "green_run";
        severity = "high";
        message = `${team.name} enters favorable run (FDR ${next.avgFdr.toFixed(1)}) from GW${nextStart}`;
      } else if (!isImproving && next.avgFdr >= 3.5) {
        alertType = "red_run";
        severity = "high";
        message = `${team.name} faces tough fixtures (FDR ${next.avgFdr.toFixed(1)}) from GW${nextStart}`;
      } else if (isImproving) {
        alertType = "improving";
        severity = Math.abs(change) >= 1.2 ? "high" : "medium";
        message = `${team.name} fixtures improve by ${change.toFixed(1)} FDR from GW${nextStart}`;
      } else {
        alertType = "worsening";
        severity = Math.abs(change) >= 1.2 ? "high" : "medium";
        message = `${team.name} fixtures worsen by ${Math.abs(change).toFixed(1)} FDR from GW${nextStart}`;
      }

      alerts.push({
        teamId: team.id,
        teamName: team.name,
        teamShort: team.short_name,
        alertType,
        message,
        fdrBefore: Math.round(current.avgFdr * 10) / 10,
        fdrAfter: Math.round(next.avgFdr * 10) / 10,
        fdrChange: Math.round(change * 10) / 10,
        windowStart: nextStart,
        windowEnd: nextEnd,
        severity,
      });
    }

    // Also alert for current green/red runs
    if (current.avgFdr <= 2.2 && current.fixtureCount >= windowSize - 1) {
      const exists = alerts.find(
        (a) => a.teamId === team.id && a.alertType === "green_run",
      );
      if (!exists) {
        alerts.push({
          teamId: team.id,
          teamName: team.name,
          teamShort: team.short_name,
          alertType: "green_run",
          message: `${team.name} currently in green run (FDR ${current.avgFdr.toFixed(1)})`,
          fdrBefore: Math.round(current.avgFdr * 10) / 10,
          fdrAfter: Math.round(next.avgFdr * 10) / 10,
          fdrChange: Math.round(change * 10) / 10,
          windowStart: currentStart,
          windowEnd: currentEnd,
          severity: "high",
        });
      }
    } else if (
      current.avgFdr >= 3.8 &&
      current.fixtureCount >= windowSize - 1
    ) {
      const exists = alerts.find(
        (a) => a.teamId === team.id && a.alertType === "red_run",
      );
      if (!exists) {
        alerts.push({
          teamId: team.id,
          teamName: team.name,
          teamShort: team.short_name,
          alertType: "red_run",
          message: `${team.name} currently in tough run (FDR ${current.avgFdr.toFixed(1)})`,
          fdrBefore: Math.round(current.avgFdr * 10) / 10,
          fdrAfter: Math.round(next.avgFdr * 10) / 10,
          fdrChange: Math.round(change * 10) / 10,
          windowStart: currentStart,
          windowEnd: currentEnd,
          severity: "high",
        });
      }
    }
  }

  // Sort alerts by severity and absolute change
  alerts.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return Math.abs(b.fdrChange) - Math.abs(a.fdrChange);
  });

  // Sort team rankings by current FDR (easiest first)
  teamRankings.sort((a, b) => a.currentFdr - b.currentFdr);

  // Best teams to target: low current FDR or significantly improving
  const bestTeamsToTarget = teamRankings
    .filter(
      (t) =>
        t.currentFdr <= 2.8 || (t.trend === "improving" && t.change >= 0.8),
    )
    .slice(0, 6);

  // Teams to avoid: high current FDR or significantly worsening
  const teamsToAvoid = teamRankings
    .filter(
      (t) =>
        t.currentFdr >= 3.5 || (t.trend === "worsening" && t.change <= -0.8),
    )
    .sort((a, b) => b.currentFdr - a.currentFdr)
    .slice(0, 6);

  return {
    alerts: alerts.slice(0, 10), // Top 10 alerts
    teamRankings,
    bestTeamsToTarget,
    teamsToAvoid,
  };
}

/**
 * Get teams with the easiest fixtures in the given window.
 */
export function getEasiestFixtureTeams(
  teams: Team[],
  fixtures: Fixture[],
  gwStart: number,
  gwEnd: number,
  limit: number = 5,
): TeamFdrWindow[] {
  const teamFdrs: TeamFdrWindow[] = [];

  for (const team of teams) {
    const { avgFdr, fixtureCount } = calculateTeamFdr(
      team.id,
      fixtures,
      gwStart,
      gwEnd,
    );

    teamFdrs.push({
      teamId: team.id,
      teamName: team.name,
      teamShort: team.short_name,
      currentFdr: Math.round(avgFdr * 10) / 10,
      nextFdr: 0,
      change: 0,
      fixtureCount,
      trend: "stable",
    });
  }

  return teamFdrs.sort((a, b) => a.currentFdr - b.currentFdr).slice(0, limit);
}
