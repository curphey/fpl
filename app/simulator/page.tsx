"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionSimulator } from "@/components/simulator/decision-simulator";
import { RivalAnalyzer } from "@/components/simulator/rival-analyzer";
import { InjuryPredictor } from "@/components/simulator/injury-predictor";
import { useBootstrapStatic, useManagerPicks } from "@/lib/fpl/hooks/use-fpl";
import { useManagerContext } from "@/lib/fpl/manager-context";
import { enrichPlayers } from "@/lib/fpl/utils";
import type {
  SimulationPlayer,
  RivalProfile,
  FixtureContext,
  InjuredPlayer,
} from "@/lib/claude/simulator-types";

type Tab = "decision" | "rival" | "injury";

export default function SimulatorPage() {
  const [activeTab, setActiveTab] = useState<Tab>("decision");
  const { managerId } = useManagerContext();
  const { data: bootstrap, isLoading: bootstrapLoading } = useBootstrapStatic();
  const currentGW = bootstrap?.events.find((e) => e.is_current)?.id ?? 1;
  const { data: picks } = useManagerPicks(managerId ?? null, currentGW);

  // Build squad for simulator from manager picks
  const squad = useMemo<SimulationPlayer[]>(() => {
    if (!bootstrap || !picks) return [];

    const enriched = enrichPlayers(bootstrap);
    const playerMap = new Map(enriched.map((p) => [p.id, p]));

    return picks.picks.map((pick) => {
      const player = playerMap.get(pick.element);
      return {
        id: pick.element,
        name: player?.web_name ?? `Player ${pick.element}`,
        position: player?.position_short ?? "Unknown",
        team: player?.team_name ?? "Unknown",
        expectedPoints: player?.ep_next ? parseFloat(player.ep_next) : 0,
        ownership: player?.selected_by_percent
          ? parseFloat(player.selected_by_percent)
          : 0,
      };
    });
  }, [bootstrap, picks]);

  // Get injured players for injury predictor
  const injuredPlayers = useMemo<InjuredPlayer[]>(() => {
    if (!bootstrap) return [];

    const enriched = enrichPlayers(bootstrap);
    return enriched
      .filter(
        (p) =>
          p.news &&
          p.news.length > 0 &&
          (p.chance_of_playing_next_round ?? 100) < 100,
      )
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        name: p.web_name,
        team: p.team_name ?? "Unknown",
        position: p.position_short ?? "Unknown",
        injuryType: extractInjuryType(p.news || ""),
        news: p.news || "",
        newsAdded: p.news_added || null,
        chanceOfPlaying: p.chance_of_playing_next_round ?? null,
        price: p.now_cost / 10,
        formBeforeInjury: parseFloat(p.form || "0"),
        expectedPointsPerGame: p.ep_next ? parseFloat(p.ep_next) : 0,
      }));
  }, [bootstrap]);

  // Mock rival for demo (in real app, this would come from league data)
  const mockRival: RivalProfile = {
    managerId: 12345,
    name: "Demo Rival",
    chipsUsed: [{ chip: "wildcard", gameweek: 8 }],
    captainHistory: [
      { gameweek: currentGW - 3, player: "Haaland", points: 12 },
      { gameweek: currentGW - 2, player: "Salah", points: 8 },
      { gameweek: currentGW - 1, player: "Haaland", points: 15 },
    ],
    transferPatterns: [
      { gameweek: currentGW - 2, in: "Palmer", out: "Saka" },
      { gameweek: currentGW - 1, in: "Watkins", out: "Isak" },
    ],
    rank: 15000,
    pointsGap: -25,
  };

  // Mock fixtures
  const mockFixtures: FixtureContext[] = [
    {
      gameweek: currentGW,
      isDGW: false,
      isBGW: false,
      favorableTeams: ["Arsenal", "Chelsea", "Liverpool"],
    },
    {
      gameweek: currentGW + 1,
      isDGW: true,
      isBGW: false,
      favorableTeams: ["Man City", "Newcastle", "Brighton"],
    },
    {
      gameweek: currentGW + 2,
      isDGW: false,
      isBGW: false,
      favorableTeams: ["Tottenham", "Aston Villa"],
    },
  ];

  const [selectedInjuredPlayer, setSelectedInjuredPlayer] =
    useState<InjuredPlayer | null>(null);

  if (bootstrapLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-fpl-green border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">AI Simulator</h1>
        <p className="text-sm text-fpl-muted">
          Claude-powered analysis for decisions, rivals, and injuries
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "decision" as Tab, label: "Decision Simulator", icon: "🎯" },
          { id: "rival" as Tab, label: "Rival Analyzer", icon: "🔍" },
          { id: "injury" as Tab, label: "Injury Predictor", icon: "🏥" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-fpl-purple text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Decision Simulator Tab */}
      {activeTab === "decision" && (
        <>
          {squad.length > 0 ? (
            <DecisionSimulator
              squad={squad}
              currentGameweek={currentGW}
              leagueContext={{
                rank: 50000,
                totalManagers: 10000000,
                gapToLeader: 150,
                gameweeksRemaining: 38 - currentGW,
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-fpl-muted">
                  {managerId
                    ? "Loading your squad..."
                    : "Enter your Manager ID to load your squad for simulation"}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Rival Analyzer Tab */}
      {activeTab === "rival" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-fpl-muted mb-2">
                Analyze a rival manager&apos;s patterns to predict their moves.
                Currently showing demo data.
              </p>
            </CardContent>
          </Card>
          <RivalAnalyzer
            rival={mockRival}
            yourSquad={squad}
            upcomingFixtures={mockFixtures}
            currentGameweek={currentGW}
          />
        </div>
      )}

      {/* Injury Predictor Tab */}
      {activeTab === "injury" && (
        <div className="space-y-4">
          {/* Player Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Injured Player</CardTitle>
            </CardHeader>
            <CardContent>
              {injuredPlayers.length > 0 ? (
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {injuredPlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedInjuredPlayer(player)}
                      className={`flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                        selectedInjuredPlayer?.id === player.id
                          ? "bg-fpl-purple/20 border border-fpl-purple"
                          : "bg-gray-800 hover:bg-gray-700"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-white">{player.name}</p>
                        <p className="text-sm text-gray-400">
                          {player.team} • {player.position} •{" "}
                          {player.injuryType}
                        </p>
                      </div>
                      <span
                        className={`text-sm px-2 py-1 rounded ${
                          (player.chanceOfPlaying ?? 0) >= 75
                            ? "bg-green-500/20 text-green-400"
                            : (player.chanceOfPlaying ?? 0) >= 25
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {player.chanceOfPlaying ?? "?"}%
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-fpl-muted text-center py-4">
                  No injured players to analyze
                </p>
              )}
            </CardContent>
          </Card>

          {/* Injury Predictor */}
          {selectedInjuredPlayer && (
            <InjuryPredictor
              player={selectedInjuredPlayer}
              currentGameweek={currentGW}
              hasPlayer={squad.some((p) => p.id === selectedInjuredPlayer.id)}
              replacementOptions={squad
                .filter(
                  (s) =>
                    s.position === selectedInjuredPlayer.position &&
                    s.id !== selectedInjuredPlayer.id,
                )
                .map((s) => s.name)}
            />
          )}
        </div>
      )}

      {/* API Info */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-fpl-muted text-center">
            Powered by Claude AI with extended thinking • Requires
            ANTHROPIC_API_KEY
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function extractInjuryType(news: string): string {
  const lowered = news.toLowerCase();
  if (lowered.includes("hamstring")) return "Hamstring";
  if (lowered.includes("ankle")) return "Ankle";
  if (lowered.includes("knee")) return "Knee";
  if (lowered.includes("calf")) return "Calf";
  if (lowered.includes("groin")) return "Groin";
  if (lowered.includes("thigh")) return "Thigh";
  if (lowered.includes("back")) return "Back";
  if (lowered.includes("illness")) return "Illness";
  if (lowered.includes("suspended")) return "Suspended";
  if (lowered.includes("muscle")) return "Muscle";
  return "Unknown";
}
