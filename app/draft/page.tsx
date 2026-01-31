"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DraftModeSelector } from "@/components/draft/draft-mode-selector";
import { SnakeDraftSimulator } from "@/components/draft/snake-draft-simulator";
import { AuctionDraftSimulator } from "@/components/draft/auction-draft-simulator";
import { DraftRankingsTable } from "@/components/draft/draft-rankings-table";
import { KeeperAnalysisSection } from "@/components/draft/keeper-analysis";
import { useBootstrapStatic } from "@/lib/fpl/hooks/use-fpl";
import { enrichPlayers } from "@/lib/fpl/utils";
import {
  calculateEstimatedADP,
  createInitialDraftState,
} from "@/lib/fpl/draft-model";
import type {
  DraftMode,
  DraftSettings,
  DraftState,
  DraftPlayer,
} from "@/lib/fpl/draft-types";

type Tab = "simulator" | "rankings" | "keepers";

export default function DraftPage() {
  const [activeTab, setActiveTab] = useState<Tab>("simulator");
  const [draftMode, setDraftMode] = useState<DraftMode>("snake");
  const [draftSettings, setDraftSettings] = useState<DraftSettings>({
    mode: "snake",
    leagueSize: 10,
    userDraftPosition: 1,
    auctionBudget: 200,
  });
  const [draftState, setDraftState] = useState<DraftState | null>(null);

  const { data: bootstrap, isLoading: bootstrapLoading } = useBootstrapStatic();

  // Calculate draft players with ADP
  const draftPlayers = useMemo<DraftPlayer[]>(() => {
    if (!bootstrap) return [];
    const enriched = enrichPlayers(bootstrap);
    return calculateEstimatedADP(enriched);
  }, [bootstrap]);

  // Start a new draft
  const handleStartDraft = useCallback((settings: DraftSettings) => {
    setDraftSettings(settings);
    setDraftMode(settings.mode);
    const initialState = createInitialDraftState(settings);
    setDraftState(initialState);
  }, []);

  // Reset draft
  const handleResetDraft = useCallback(() => {
    setDraftState(null);
  }, []);

  // Update draft state
  const handleDraftStateChange = useCallback((newState: DraftState) => {
    setDraftState(newState);
  }, []);

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
        <h1 className="text-xl font-bold">Draft Mode</h1>
        <p className="text-sm text-fpl-muted">
          Snake/auction draft simulator with ADP rankings and keeper analysis
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "simulator" as Tab, label: "Draft Simulator", icon: "🎯" },
          { id: "rankings" as Tab, label: "ADP Rankings", icon: "📊" },
          { id: "keepers" as Tab, label: "Keeper Analysis", icon: "🔒" },
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

      {/* Simulator Tab */}
      {activeTab === "simulator" && (
        <div className="space-y-4">
          {!draftState ? (
            <DraftModeSelector
              onStartDraft={handleStartDraft}
              defaultSettings={draftSettings}
            />
          ) : (
            <>
              {/* Draft Info Bar */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm">
                        <span className="text-fpl-muted">Mode:</span>{" "}
                        <span className="font-medium capitalize">
                          {draftState.mode}
                        </span>
                      </span>
                      <span className="text-sm">
                        <span className="text-fpl-muted">League:</span>{" "}
                        <span className="font-medium">
                          {draftState.totalManagers} managers
                        </span>
                      </span>
                      <span className="text-sm">
                        <span className="text-fpl-muted">Your Position:</span>{" "}
                        <span className="font-medium">
                          #{draftState.userPosition}
                        </span>
                      </span>
                      {draftState.budgetRemaining !== undefined && (
                        <span className="text-sm">
                          <span className="text-fpl-muted">Budget:</span>{" "}
                          <span className="font-medium text-fpl-green">
                            {draftState.budgetRemaining}
                          </span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleResetDraft}
                      className="text-sm text-fpl-muted hover:text-white transition-colors"
                    >
                      Reset Draft
                    </button>
                  </div>
                </CardContent>
              </Card>

              {draftMode === "snake" ? (
                <SnakeDraftSimulator
                  players={draftPlayers}
                  state={draftState}
                  onStateChange={handleDraftStateChange}
                />
              ) : (
                <AuctionDraftSimulator
                  players={draftPlayers}
                  state={draftState}
                  onStateChange={handleDraftStateChange}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Rankings Tab */}
      {activeTab === "rankings" && (
        <DraftRankingsTable players={draftPlayers} />
      )}

      {/* Keepers Tab */}
      {activeTab === "keepers" && (
        <KeeperAnalysisSection players={draftPlayers} />
      )}

      {/* Info Footer */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-fpl-muted text-center">
            ADP estimates based on ownership, points, form, and xGI. Actual
            draft positions may vary.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
