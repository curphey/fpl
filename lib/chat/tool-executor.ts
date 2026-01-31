/**
 * Tool executor for chat assistant
 * Executes FPL tools against the data layer
 */

import type { ChatToolName } from "./types";
import { fplClient, getCurrentGameweek } from "@/lib/fpl/client";
import { enrichPlayers } from "@/lib/fpl/utils";
import { scoreCaptainOptions } from "@/lib/fpl/captain-model";
import { scoreTransferTargets } from "@/lib/fpl/transfer-model";
import { predictPriceChanges } from "@/lib/fpl/price-model";
import { analyzeChipTiming } from "@/lib/fpl/chip-model";
import type { BootstrapStatic, Fixture } from "@/lib/fpl/types";

interface ToolContext {
  managerId?: number;
  bootstrap: BootstrapStatic;
  fixtures: Fixture[];
  currentGw: number;
}

type ToolInput = Record<string, unknown>;

/**
 * Execute a chat tool and return the result
 */
export async function executeTool(
  toolName: ChatToolName,
  input: ToolInput,
  context: ToolContext,
): Promise<unknown> {
  const { bootstrap, fixtures, currentGw, managerId } = context;

  // Build lookup maps
  const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const teamNameMap = new Map(
    bootstrap.teams.map((t) => [t.name.toLowerCase(), t.id]),
  );
  const positionMap = new Map(
    bootstrap.element_types.map((p) => [p.id, p.singular_name_short]),
  );
  const positionIdMap: Record<string, number> = {
    GKP: 1,
    DEF: 2,
    MID: 3,
    FWD: 4,
  };

  // Enrich players for model functions
  const enrichedPlayers = enrichPlayers(bootstrap);

  switch (toolName) {
    case "get_my_squad": {
      if (!managerId) {
        return {
          error: "No manager ID connected. Please connect your FPL team first.",
        };
      }

      const gw = (input.gameweek as number) || currentGw;

      try {
        const [entry, picks] = await Promise.all([
          fplClient.getManager(managerId),
          fplClient.getManagerPicks(managerId, gw),
        ]);

        const squad = picks.picks.map((pick) => {
          const player = bootstrap.elements.find((p) => p.id === pick.element);
          const team = player ? teamMap.get(player.team) : null;

          return {
            name: player?.web_name || "Unknown",
            team: team?.short_name || "???",
            position: player ? positionMap.get(player.element_type) : "???",
            price: player ? `£${(player.now_cost / 10).toFixed(1)}m` : "???",
            points: player?.total_points || 0,
            form: player?.form || "0.0",
            isCaptain: pick.is_captain,
            isViceCaptain: pick.is_vice_captain,
            isOnBench: pick.multiplier === 0,
          };
        });

        return {
          manager: {
            name: `${entry.player_first_name} ${entry.player_last_name}`,
            teamName: entry.name,
            overallPoints: entry.summary_overall_points,
            overallRank: entry.summary_overall_rank,
          },
          gameweek: gw,
          teamValue: `£${(picks.entry_history.value / 10).toFixed(1)}m`,
          bank: `£${(picks.entry_history.bank / 10).toFixed(1)}m`,
          freeTransfers: picks.entry_history.event_transfers,
          squad,
        };
      } catch (error) {
        return {
          error: `Failed to fetch squad: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }

    case "search_players": {
      let players = bootstrap.elements;

      // Apply filters
      if (input.query) {
        const query = (input.query as string).toLowerCase();
        players = players.filter(
          (p) =>
            p.web_name.toLowerCase().includes(query) ||
            p.first_name.toLowerCase().includes(query) ||
            p.second_name.toLowerCase().includes(query),
        );
      }

      if (input.team) {
        const teamId = teamNameMap.get((input.team as string).toLowerCase());
        if (teamId) {
          players = players.filter((p) => p.team === teamId);
        }
      }

      if (input.position) {
        const posId = positionIdMap[input.position as string];
        if (posId) {
          players = players.filter((p) => p.element_type === posId);
        }
      }

      if (input.min_price) {
        const minPrice = (input.min_price as number) * 10;
        players = players.filter((p) => p.now_cost >= minPrice);
      }

      if (input.max_price) {
        const maxPrice = (input.max_price as number) * 10;
        players = players.filter((p) => p.now_cost <= maxPrice);
      }

      // Sort
      const sortBy = (input.sort_by as string) || "total_points";
      players.sort((a, b) => {
        switch (sortBy) {
          case "form":
            return parseFloat(b.form) - parseFloat(a.form);
          case "price":
            return b.now_cost - a.now_cost;
          case "ownership":
            return (
              parseFloat(b.selected_by_percent) -
              parseFloat(a.selected_by_percent)
            );
          case "xgi":
            return (
              parseFloat(b.expected_goal_involvements) -
              parseFloat(a.expected_goal_involvements)
            );
          default:
            return b.total_points - a.total_points;
        }
      });

      // Limit
      const limit = (input.limit as number) || 10;
      players = players.slice(0, limit);

      return players.map((p) => ({
        id: p.id,
        name: p.web_name,
        fullName: `${p.first_name} ${p.second_name}`,
        team: teamMap.get(p.team)?.short_name || "???",
        position: positionMap.get(p.element_type) || "???",
        price: `£${(p.now_cost / 10).toFixed(1)}m`,
        totalPoints: p.total_points,
        form: p.form,
        ownership: `${p.selected_by_percent}%`,
        xGI: p.expected_goal_involvements,
        minutes: p.minutes,
        goals: p.goals_scored,
        assists: p.assists,
        cleanSheets: p.clean_sheets,
        bonus: p.bonus,
        news: p.news || null,
        chanceOfPlaying: p.chance_of_playing_next_round,
      }));
    }

    case "get_player_details": {
      let playerId = input.player_id as number | undefined;

      if (!playerId && input.player_name) {
        const query = (input.player_name as string).toLowerCase();
        const player = bootstrap.elements.find(
          (p) =>
            p.web_name.toLowerCase() === query ||
            p.web_name.toLowerCase().includes(query) ||
            `${p.first_name} ${p.second_name}`.toLowerCase().includes(query),
        );
        if (player) playerId = player.id;
      }

      if (!playerId) {
        return { error: "Player not found" };
      }

      const player = bootstrap.elements.find((p) => p.id === playerId);
      if (!player) {
        return { error: "Player not found" };
      }

      try {
        const summary = await fplClient.getPlayerSummary(playerId);

        return {
          id: player.id,
          name: player.web_name,
          fullName: `${player.first_name} ${player.second_name}`,
          team: teamMap.get(player.team)?.name || "???",
          position: positionMap.get(player.element_type) || "???",
          price: `£${(player.now_cost / 10).toFixed(1)}m`,
          totalPoints: player.total_points,
          form: player.form,
          ownership: `${player.selected_by_percent}%`,
          stats: {
            minutes: player.minutes,
            goals: player.goals_scored,
            assists: player.assists,
            cleanSheets: player.clean_sheets,
            bonus: player.bonus,
            xG: player.expected_goals,
            xA: player.expected_assists,
            xGI: player.expected_goal_involvements,
          },
          news: player.news || null,
          chanceOfPlaying: player.chance_of_playing_next_round,
          recentHistory: summary.history.slice(-5).map((h) => ({
            gameweek: h.round,
            points: h.total_points,
            minutes: h.minutes,
            goals: h.goals_scored,
            assists: h.assists,
            bonus: h.bonus,
            opponent: teamMap.get(h.opponent_team)?.short_name || "???",
            home: h.was_home,
          })),
          upcomingFixtures: summary.fixtures.slice(0, 5).map((f) => ({
            gameweek: f.event,
            opponent:
              teamMap.get(f.is_home ? f.team_a : f.team_h)?.short_name || "???",
            home: f.is_home,
            difficulty: f.difficulty,
          })),
        };
      } catch (error) {
        return {
          error: `Failed to fetch player details: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }

    case "compare_players": {
      const playerNames = input.player_names as string[];
      if (!playerNames || playerNames.length < 2) {
        return { error: "Please provide at least 2 players to compare" };
      }

      const playersToCompare = playerNames
        .map((name) => {
          const query = name.toLowerCase();
          return bootstrap.elements.find(
            (p) =>
              p.web_name.toLowerCase() === query ||
              p.web_name.toLowerCase().includes(query),
          );
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (playersToCompare.length < 2) {
        return { error: "Could not find enough players to compare" };
      }

      return playersToCompare.map((p) => ({
        id: p.id,
        name: p.web_name,
        team: teamMap.get(p.team)?.short_name || "???",
        position: positionMap.get(p.element_type) || "???",
        price: `£${(p.now_cost / 10).toFixed(1)}m`,
        totalPoints: p.total_points,
        form: parseFloat(p.form),
        ownership: `${p.selected_by_percent}%`,
        minutes: p.minutes,
        goals: p.goals_scored,
        assists: p.assists,
        cleanSheets: p.clean_sheets,
        bonus: p.bonus,
        xG: parseFloat(p.expected_goals),
        xA: parseFloat(p.expected_assists),
        xGI: parseFloat(p.expected_goal_involvements),
        pointsPerGame:
          p.minutes > 0
            ? (p.total_points / (p.minutes / 90)).toFixed(1)
            : "0.0",
        pointsPerMillion: (p.total_points / (p.now_cost / 10)).toFixed(1),
      }));
    }

    case "get_fixtures": {
      const gameweeks = (input.gameweeks as number) || 5;
      let teamId: number | null = null;

      if (input.team) {
        teamId = teamNameMap.get((input.team as string).toLowerCase()) || null;
      }

      const upcoming = fixtures
        .filter(
          (f) =>
            !f.finished &&
            f.event !== null &&
            f.event >= currentGw &&
            f.event < currentGw + gameweeks,
        )
        .filter((f) => !teamId || f.team_h === teamId || f.team_a === teamId)
        .map((f) => ({
          gameweek: f.event,
          homeTeam: teamMap.get(f.team_h)?.short_name || "???",
          awayTeam: teamMap.get(f.team_a)?.short_name || "???",
          kickoff: f.kickoff_time,
          homeDifficulty: f.team_h_difficulty,
          awayDifficulty: f.team_a_difficulty,
        }));

      // Group by team if no specific team requested
      if (!teamId) {
        return upcoming;
      }

      // Format for single team
      const team = teamMap.get(teamId);
      return {
        team: team?.name || "???",
        fixtures: upcoming.map((f) => {
          const isHome = f.homeTeam === team?.short_name;
          return {
            gameweek: f.gameweek,
            opponent: isHome ? f.awayTeam : f.homeTeam,
            isHome,
            difficulty: isHome ? f.homeDifficulty : f.awayDifficulty,
            kickoff: f.kickoff,
          };
        }),
      };
    }

    case "get_captain_recommendations": {
      const limit = (input.limit as number) || 5;
      const squadOnly = input.squad_only as boolean;

      let playersToScore = enrichedPlayers;

      // Filter to squad if requested
      if (squadOnly && managerId) {
        try {
          const picks = await fplClient.getManagerPicks(managerId, currentGw);
          const squadIds = new Set(picks.picks.map((p) => p.element));
          playersToScore = enrichedPlayers.filter((p) => squadIds.has(p.id));
        } catch {
          return {
            error:
              "Failed to fetch squad. Make sure your manager ID is connected.",
          };
        }
      }

      const teamShortNameMap = new Map(
        bootstrap.teams.map((t) => [t.id, { short_name: t.short_name }]),
      );

      const recommendations = scoreCaptainOptions(
        playersToScore,
        fixtures,
        teamShortNameMap,
        currentGw,
      ).slice(0, limit);

      return recommendations.map((rec, idx) => ({
        rank: idx + 1,
        player: {
          name: rec.player.web_name,
          team: teamMap.get(rec.player.team)?.short_name || "???",
          position: positionMap.get(rec.player.element_type) || "???",
        },
        score: Math.round(rec.score * 10) / 10,
        opponent: rec.opponentShortName,
        isHome: rec.isHome,
        difficulty: rec.difficulty,
        category: rec.category,
        reasoning: {
          form: Math.round(rec.formScore * 10) / 10,
          fixture: Math.round(rec.fixtureScore * 10) / 10,
          xgi: Math.round(rec.xgiScore * 10) / 10,
          setPieces: Math.round(rec.setPieceScore * 10) / 10,
        },
      }));
    }

    case "get_transfer_recommendations": {
      const limit = (input.limit as number) || 10;
      const positionFilter = input.position as string | undefined;
      const maxPrice = input.max_price as number | undefined;

      let playersToScore = enrichedPlayers.filter((p) => p.minutes > 0);

      if (positionFilter) {
        const posId = positionIdMap[positionFilter];
        if (posId) {
          playersToScore = playersToScore.filter(
            (p) => p.element_type === posId,
          );
        }
      }

      if (maxPrice) {
        playersToScore = playersToScore.filter(
          (p) => p.now_cost <= maxPrice * 10,
        );
      }

      const recommendations = scoreTransferTargets(
        playersToScore,
        fixtures,
        currentGw,
      ).slice(0, limit);

      return recommendations.map((rec, idx) => ({
        rank: idx + 1,
        player: {
          name: rec.player.web_name,
          team: teamMap.get(rec.player.team)?.short_name || "???",
          position: positionMap.get(rec.player.element_type) || "???",
          price: `£${(rec.player.now_cost / 10).toFixed(1)}m`,
        },
        score: Math.round(rec.score * 10) / 10,
        upcomingDifficulty: Math.round(rec.upcomingDifficulty * 10) / 10,
        reasoning: {
          form: Math.round(rec.formScore * 10) / 10,
          fixture: Math.round(rec.fixtureScore * 10) / 10,
          value: Math.round(rec.valueScore * 10) / 10,
          xgi: Math.round(rec.xgiScore * 10) / 10,
        },
      }));
    }

    case "get_price_changes": {
      const direction = (input.direction as string) || "both";
      const limit = (input.limit as number) || 10;

      const { risers, fallers } = predictPriceChanges(enrichedPlayers);

      const formatCandidate = (c: (typeof risers)[0]) => ({
        player: {
          name: c.player.web_name,
          team: teamMap.get(c.player.team)?.short_name || "???",
          position: positionMap.get(c.player.element_type) || "???",
          price: `£${(c.player.now_cost / 10).toFixed(1)}m`,
        },
        direction: c.direction,
        probability: Math.round(c.probability * 100),
        netTransfers: c.netTransfers,
        alreadyMoved: c.costChangeMomentum !== 0,
      });

      if (direction === "rise") {
        return risers.slice(0, limit).map(formatCandidate);
      }
      if (direction === "fall") {
        return fallers.slice(0, limit).map(formatCandidate);
      }

      return {
        risers: risers.slice(0, Math.ceil(limit / 2)).map(formatCandidate),
        fallers: fallers.slice(0, Math.ceil(limit / 2)).map(formatCandidate),
      };
    }

    case "get_chip_advice": {
      const chipFilter = input.chip as string | undefined;

      // Determine available chips (simplified - assumes all available)
      const availableChips = chipFilter
        ? [chipFilter]
        : ["wildcard", "freehit", "bboost", "3xc"];

      const analysis = analyzeChipTiming(
        enrichedPlayers,
        fixtures,
        bootstrap.events,
        currentGw,
        availableChips,
      );

      return analysis.map((a) => ({
        chip: a.chip,
        label: a.label,
        currentGwScore: a.currentGwScore,
        bestGw: a.bestGw,
        bestGwScore: a.bestGwScore,
        recommendation: a.recommendation,
        summary: a.summary,
        upcomingGws: a.gwScores.slice(0, 5).map((s) => ({
          gameweek: s.gw,
          score: s.score,
          reasoning: s.reasoning,
        })),
      }));
    }

    case "get_gameweek_info": {
      const gwNum = input.gameweek as number | undefined;

      const gw = gwNum
        ? bootstrap.events.find((e) => e.id === gwNum)
        : bootstrap.events.find((e) => e.is_current) ||
          bootstrap.events.find((e) => e.is_next);

      if (!gw) {
        return { error: "Gameweek not found" };
      }

      const deadline = new Date(gw.deadline_time);
      const now = new Date();
      const msUntilDeadline = deadline.getTime() - now.getTime();
      const hoursUntilDeadline = Math.max(
        0,
        msUntilDeadline / (1000 * 60 * 60),
      );

      return {
        id: gw.id,
        name: gw.name,
        deadline: gw.deadline_time,
        deadlineFormatted: deadline.toLocaleString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        hoursUntilDeadline: Math.round(hoursUntilDeadline * 10) / 10,
        isCurrent: gw.is_current,
        isNext: gw.is_next,
        finished: gw.finished,
        averageScore: gw.average_entry_score || 0,
        highestScore: gw.highest_score || 0,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

/**
 * Create tool context from FPL data
 */
export async function createToolContext(
  managerId?: number,
): Promise<ToolContext> {
  const [bootstrap, fixtures] = await Promise.all([
    fplClient.getBootstrapStatic(),
    fplClient.getFixtures(),
  ]);

  const currentGw = getCurrentGameweek(bootstrap);

  return {
    managerId,
    bootstrap,
    fixtures,
    currentGw,
  };
}
