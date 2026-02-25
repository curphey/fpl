import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerCard } from "../player-card";
import type { Player } from "@/lib/fpl/types";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    element_type: 3, // MID
    web_name: "Salah",
    first_name: "Mohamed",
    second_name: "Salah",
    team: 14,
    team_code: 14,
    status: "a",
    news: "",
    now_cost: 130,
    event_points: 12,
    total_points: 200,
    form: "9.0",
    selected_by_percent: "40.0",
    transfers_in_event: 100000,
    transfers_out_event: 5000,
    minutes: 90,
    goals_scored: 1,
    assists: 1,
    clean_sheets: 0,
    goals_conceded: 1,
    own_goals: 0,
    penalties_saved: 0,
    penalties_missed: 0,
    yellow_cards: 0,
    red_cards: 0,
    saves: 0,
    bonus: 3,
    bps: 45,
    influence: "80.0",
    creativity: "60.0",
    threat: "90.0",
    ict_index: "77.0",
    starts: 25,
    expected_goals: "0.8",
    expected_assists: "0.5",
    expected_goal_involvements: "1.3",
    expected_goals_conceded: "0.9",
    chance_of_playing_this_round: 100,
    chance_of_playing_next_round: 100,
    cost_change_event: 0,
    cost_change_start: 5,
    dreamteam_count: 3,
    ep_next: "8.5",
    ep_this: "9.0",
    in_dreamteam: false,
    news_added: null,
    photo: "1.jpg",
    points_per_game: "8.0",
    squad_number: null,
    transfers_in: 500000,
    transfers_out: 50000,
    value_form: "0.7",
    value_season: "15.4",
    was_home: true,
    ...overrides,
  } as unknown as Player;
}

describe("PlayerCard", () => {
  it("renders the player's web name", () => {
    const player = makePlayer({ web_name: "Salah" });
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={12}
        isCaptain={false}
        isViceCaptain={false}
        isBench={false}
      />,
    );
    expect(screen.getByText("Salah")).toBeInTheDocument();
  });

  it("renders the points value", () => {
    const player = makePlayer();
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={8}
        isCaptain={false}
        isViceCaptain={false}
        isBench={false}
      />,
    );
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders dash when points is null", () => {
    const player = makePlayer();
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={null}
        isCaptain={false}
        isViceCaptain={false}
        isBench={false}
      />,
    );
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("uses correct outfield kit URL with teamCode", () => {
    const player = makePlayer({ element_type: 3 }); // MID
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={12}
        isCaptain={false}
        isViceCaptain={false}
        isBench={false}
      />,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_14-66.png",
    );
  });

  it("uses GK kit URL with _1 suffix for goalkeeper", () => {
    const player = makePlayer({ element_type: 1 }); // GK
    render(
      <PlayerCard
        player={player}
        teamCode={1}
        teamShortName="ARS"
        points={6}
        isCaptain={false}
        isViceCaptain={false}
        isBench={false}
      />,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_1_1-66.png",
    );
  });

  it("shows C badge for captain", () => {
    const player = makePlayer();
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={12}
        isCaptain={true}
        isViceCaptain={false}
        isBench={false}
      />,
    );
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("shows V badge for vice-captain", () => {
    const player = makePlayer();
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={12}
        isCaptain={false}
        isViceCaptain={true}
        isBench={false}
      />,
    );
    expect(screen.getByText("V")).toBeInTheDocument();
  });

  it("does not show C or V badge when neither captain nor vice-captain", () => {
    const player = makePlayer();
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={12}
        isCaptain={false}
        isViceCaptain={false}
        isBench={false}
      />,
    );
    expect(screen.queryByText("C")).not.toBeInTheDocument();
    expect(screen.queryByText("V")).not.toBeInTheDocument();
  });

  it("shows auto-sub in arrow for auto-sub in", () => {
    const player = makePlayer();
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={2}
        isCaptain={false}
        isViceCaptain={false}
        isBench={false}
        autoSub="in"
      />,
    );
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("shows auto-sub out arrow for auto-sub out", () => {
    const player = makePlayer();
    render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={0}
        isCaptain={false}
        isViceCaptain={false}
        isBench={true}
        autoSub="out"
      />,
    );
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("applies reduced opacity for bench players", () => {
    const player = makePlayer();
    const { container } = render(
      <PlayerCard
        player={player}
        teamCode={14}
        teamShortName="LIV"
        points={2}
        isCaptain={false}
        isViceCaptain={false}
        isBench={true}
      />,
    );
    expect(container.firstChild).toHaveClass("opacity-80");
  });
});
