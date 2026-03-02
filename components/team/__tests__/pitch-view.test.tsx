import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PitchView } from "../pitch-view";
import type { Player, Team, Pick, AutomaticSub } from "@/lib/fpl/types";

function makePlayer(
  id: number,
  elementType: number,
  teamId: number,
  overrides: Partial<Player> = {},
): Player {
  return {
    id,
    element_type: elementType,
    web_name: `Player${id}`,
    first_name: "First",
    second_name: `Player${id}`,
    team: teamId,
    team_code: teamId * 10, // code is different from id
    status: "a",
    news: "",
    now_cost: 80,
    event_points: 4,
    total_points: 100,
    form: "4.0",
    selected_by_percent: "10.0",
    transfers_in_event: 1000,
    transfers_out_event: 500,
    minutes: 90,
    goals_scored: 0,
    assists: 0,
    clean_sheets: 1,
    goals_conceded: 0,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 0,
    red_cards: 0,
    saves: 0,
    bonus: 0,
    bps: 20,
    influence: "30.0",
    creativity: "20.0",
    threat: "10.0",
    ict_index: "20.0",
    starts: 20,
    expected_goals: "0.1",
    expected_assists: "0.1",
    expected_goal_involvements: "0.2",
    expected_goals_conceded: "0.5",
    chance_of_playing_this_round: 100,
    chance_of_playing_next_round: 100,
    cost_change_event: 0,
    cost_change_start: 0,
    dreamteam_count: 0,
    ep_next: "4.0",
    ep_this: "4.0",
    in_dreamteam: false,
    news_added: null,
    photo: `${id}.jpg`,
    points_per_game: "4.0",
    squad_number: null,
    transfers_in: 10000,
    transfers_out: 5000,
    value_form: "0.5",
    value_season: "12.5",
    was_home: true,
    ...overrides,
  } as unknown as Player;
}

function makeTeam(id: number, code: number): Team {
  return {
    id,
    code,
    name: `Team${id}`,
    short_name: `T${id}`,
    strength: 3,
    strength_overall_home: 1000,
    strength_overall_away: 1000,
    strength_attack_home: 1000,
    strength_attack_away: 1000,
    strength_defence_home: 1000,
    strength_defence_away: 1000,
    pulse_id: id,
    draw: 0,
    form: null,
    loss: 0,
    played: 20,
    points: 40,
    position: 5,
    team_division: null,
    unavailable: false,
    win: 13,
  } as unknown as Team;
}

function makePick(
  element: number,
  position: number,
  isCaptain = false,
  isViceCaptain = false,
): Pick {
  return {
    element,
    position,
    multiplier: isCaptain ? 2 : 1,
    is_captain: isCaptain,
    is_vice_captain: isViceCaptain,
  };
}

function buildStandardSquad() {
  // GK
  const players = [
    makePlayer(1, 1, 1), // GK, team 1 (code 10)
    makePlayer(2, 2, 2), // DEF, team 2 (code 20)
    makePlayer(3, 2, 2),
    makePlayer(4, 2, 2),
    makePlayer(5, 2, 3),
    makePlayer(6, 3, 4), // MID
    makePlayer(7, 3, 4),
    makePlayer(8, 3, 4),
    makePlayer(9, 4, 5), // FWD
    makePlayer(10, 4, 5),
    makePlayer(11, 4, 5),
    makePlayer(12, 1, 6), // bench GK (code 60)
    makePlayer(13, 2, 7), // bench DEF
    makePlayer(14, 3, 7), // bench MID
    makePlayer(15, 4, 8), // bench FWD
  ];

  const picks = [
    makePick(1, 1),
    makePick(2, 2, true), // captain
    makePick(3, 3, false, true), // vice-captain
    makePick(4, 4),
    makePick(5, 5),
    makePick(6, 6),
    makePick(7, 7),
    makePick(8, 8),
    makePick(9, 9),
    makePick(10, 10),
    makePick(11, 11),
    makePick(12, 12), // bench pos 12 (GK)
    makePick(13, 13), // bench pos 13
    makePick(14, 14), // bench pos 14
    makePick(15, 15), // bench pos 15
  ];

  const playerMap = new Map<number, Player>(players.map((p) => [p.id, p]));

  const teams = [
    makeTeam(1, 10),
    makeTeam(2, 20),
    makeTeam(3, 30),
    makeTeam(4, 40),
    makeTeam(5, 50),
    makeTeam(6, 60),
    makeTeam(7, 70),
    makeTeam(8, 80),
  ];
  const teamMap = new Map<number, Team>(teams.map((t) => [t.id, t]));

  return { picks, playerMap, teamMap };
}

describe("PitchView", () => {
  it("renders all 11 starters", () => {
    const { picks, playerMap, teamMap } = buildStandardSquad();
    render(
      <PitchView
        picks={picks}
        playerMap={playerMap}
        teamMap={teamMap}
        livePointsMap={null}
        autoSubs={[]}
      />,
    );
    // All 15 players should be visible (11 starters + 4 bench)
    for (let i = 1; i <= 15; i++) {
      expect(screen.getByText(`Player${i}`)).toBeInTheDocument();
    }
  });

  it("passes team code to kit image for outfield player", () => {
    const { picks, playerMap, teamMap } = buildStandardSquad();
    render(
      <PitchView
        picks={picks}
        playerMap={playerMap}
        teamMap={teamMap}
        livePointsMap={null}
        autoSubs={[]}
      />,
    );

    // Player 2 is on team 2 (code 20), outfield → shirt_20-66.png
    const imgs = screen.getAllByRole("img");
    const player2Img = imgs.find(
      (img) =>
        img.getAttribute("src") ===
        "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_20-66.png",
    );
    expect(player2Img).toBeDefined();
  });

  it("passes team code to GK kit image with _1 suffix", () => {
    const { picks, playerMap, teamMap } = buildStandardSquad();
    render(
      <PitchView
        picks={picks}
        playerMap={playerMap}
        teamMap={teamMap}
        livePointsMap={null}
        autoSubs={[]}
      />,
    );

    // Player 1 is GK on team 1 (code 10) → shirt_10_1-66.png
    const imgs = screen.getAllByRole("img");
    const gkImg = imgs.find(
      (img) =>
        img.getAttribute("src") ===
        "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_10_1-66.png",
    );
    expect(gkImg).toBeDefined();
  });

  it("shows bench label above bench players", () => {
    const { picks, playerMap, teamMap } = buildStandardSquad();
    render(
      <PitchView
        picks={picks}
        playerMap={playerMap}
        teamMap={teamMap}
        livePointsMap={null}
        autoSubs={[]}
      />,
    );
    // Bench section label
    expect(screen.getByText("Substitutes")).toBeInTheDocument();
  });

  it("shows bench player position labels", () => {
    const { picks, playerMap, teamMap } = buildStandardSquad();
    render(
      <PitchView
        picks={picks}
        playerMap={playerMap}
        teamMap={teamMap}
        livePointsMap={null}
        autoSubs={[]}
      />,
    );
    // Bench GK (player 12, element_type 1) should show "GKP" label
    expect(screen.getByText("GKP")).toBeInTheDocument();
  });

  it("shows live points when livePointsMap is provided", () => {
    const { picks, playerMap, teamMap } = buildStandardSquad();
    const livePointsMap = new Map<number, number>([[1, 7]]);
    render(
      <PitchView
        picks={picks}
        playerMap={playerMap}
        teamMap={teamMap}
        livePointsMap={livePointsMap}
        autoSubs={[]}
      />,
    );
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders without crashing when autoSubs is empty", () => {
    const { picks, playerMap, teamMap } = buildStandardSquad();
    const { container } = render(
      <PitchView
        picks={picks}
        playerMap={playerMap}
        teamMap={teamMap}
        livePointsMap={null}
        autoSubs={[]}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
