/**
 * FPL API Type Definitions
 * Based on https://fantasy.premierleague.com/api/
 *
 * Note on pricing: All `cost` and `now_cost` values are in tenths.
 * For example, `now_cost: 100` means £10.0m.
 * Use `formatPrice(cost)` to convert to display string.
 *
 * @see https://fantasy.premierleague.com/api/bootstrap-static/
 */

// =============================================================================
// Bootstrap Static Types (GET /bootstrap-static/)
// =============================================================================

/**
 * Root response from the FPL bootstrap-static endpoint.
 * Contains all static data needed to render the app.
 *
 * @example
 * const data = await fplClient.getBootstrapStatic();
 * const currentGw = data.events.find(e => e.is_current);
 * const players = data.elements;
 */
export interface BootstrapStatic {
  /** All gameweeks/events for the season */
  events: Gameweek[];
  /** FPL game rules and settings */
  game_settings: GameSettings;
  /** Season phases (Overall, Aug-Sep, etc.) */
  phases: Phase[];
  /** All 20 Premier League teams */
  teams: Team[];
  /** Total number of FPL managers globally */
  total_players: number;
  /** All players (called "elements" in FPL API) */
  elements: Player[];
  /** Available stat types for players */
  element_stats: ElementStat[];
  /** Player position types (GK, DEF, MID, FWD) */
  element_types: ElementType[];
}

/**
 * Gameweek/Event data. Each season has 38 gameweeks.
 *
 * @example
 * // Find current gameweek
 * const current = events.find(e => e.is_current);
 *
 * // Find next deadline
 * const next = events.find(e => e.is_next);
 * console.log(new Date(next.deadline_time));
 */
export interface Gameweek {
  /** Gameweek number (1-38) */
  id: number;
  /** Display name, e.g., "Gameweek 1" */
  name: string;
  /** ISO 8601 deadline timestamp */
  deadline_time: string;
  /** Unix timestamp of deadline */
  deadline_time_epoch: number;
  /** Offset from kickoff to deadline in seconds */
  deadline_time_game_offset: number;
  /** When points were released (null if not yet) */
  release_time: string | null;
  /** Average points scored by all managers */
  average_entry_score: number;
  /** Whether all fixtures have finished */
  finished: boolean;
  /** Whether bonus points have been calculated */
  data_checked: boolean;
  /** Manager ID with highest score (null until finished) */
  highest_scoring_entry: number | null;
  /** Highest points scored this GW (null until finished) */
  highest_score: number | null;
  /** True if this is the previous gameweek */
  is_previous: boolean;
  /** True if this is the current active gameweek */
  is_current: boolean;
  /** True if this is the next upcoming gameweek */
  is_next: boolean;
  /** Whether cup leagues have been created */
  cup_leagues_created: boolean;
  /** Whether H2H knockout matches created */
  h2h_ko_matches_created: boolean;
  /** Number of managers with complete squads */
  ranked_count: number;
  /** Chip usage stats for this gameweek */
  chip_plays: ChipPlay[];
  /** Player ID of most selected player */
  most_selected: number | null;
  /** Player ID of most transferred in */
  most_transferred_in: number | null;
  /** Player ID of top scorer */
  top_element: number | null;
  /** Points info for top scorer */
  top_element_info: TopElementInfo | null;
  /** Total transfers made this gameweek */
  transfers_made: number;
  /** Most captained player ID */
  most_captained: number | null;
  /** Most vice-captained player ID */
  most_vice_captained: number | null;
}

export interface ChipPlay {
  chip_name: string;
  num_played: number;
}

export interface TopElementInfo {
  id: number;
  points: number;
}

export interface GameSettings {
  league_join_private_max: number;
  league_join_public_max: number;
  league_max_size_public_classic: number;
  league_max_size_public_h2h: number;
  league_max_size_private_h2h: number;
  league_max_ko_rounds_private_h2h: number;
  league_prefix_public: string;
  league_points_h2h_win: number;
  league_points_h2h_lose: number;
  league_points_h2h_draw: number;
  league_ko_first_instead_of_random: boolean;
  cup_start_event_id: number | null;
  cup_stop_event_id: number | null;
  cup_qualifying_method: string | null;
  cup_type: string | null;
  featured_entries: number[];
  percentile_ranks: number[];
  squad_squadplay: number;
  squad_squadsize: number;
  squad_team_limit: number;
  squad_total_spend: number;
  ui_currency_multiplier: number;
  ui_use_special_shirts: boolean;
  ui_special_shirt_exclusions: number[];
  stats_form_days: number;
  sys_vice_captain_enabled: boolean;
  transfers_cap: number;
  transfers_sell_on_fee: number;
  max_extra_free_transfers: number;
  league_h2h_tiebreak_stats: string[];
  timezone: string;
}

export interface Phase {
  id: number;
  name: string;
  start_event: number;
  stop_event: number;
  highest_score: number | null;
}

/**
 * Premier League team data.
 *
 * @example
 * // Find team by ID
 * const team = teams.find(t => t.id === player.team);
 * console.log(team.name); // "Manchester City"
 * console.log(team.short_name); // "MCI"
 */
export interface Team {
  /** Internal team code */
  code: number;
  /** Season draws count */
  draw: number;
  /** Recent form string (e.g., "WWDLW") or null */
  form: string | null;
  /** Team ID (1-20, referenced by player.team) */
  id: number;
  /** Season losses count */
  loss: number;
  /** Full team name, e.g., "Manchester City" */
  name: string;
  /** Games played */
  played: number;
  /** League points */
  points: number;
  /** League table position */
  position: number;
  /** 3-letter abbreviation, e.g., "MCI" */
  short_name: string;
  /** Overall strength rating (1-5) */
  strength: number;
  /** Division (null for PL teams) */
  team_division: number | null;
  /** Whether team is unavailable */
  unavailable: boolean;
  /** Season wins count */
  win: number;
  /** Home overall strength (1000-1500 scale) */
  strength_overall_home: number;
  /** Away overall strength (1000-1500 scale) */
  strength_overall_away: number;
  /** Home attacking strength (1000-1500 scale) */
  strength_attack_home: number;
  /** Away attacking strength (1000-1500 scale) */
  strength_attack_away: number;
  /** Home defensive strength (1000-1500 scale) */
  strength_defence_home: number;
  /** Away defensive strength (1000-1500 scale) */
  strength_defence_away: number;
  /** External Pulse ID for media */
  pulse_id: number;
}

/**
 * FPL player ("element") data.
 *
 * Note: All cost values are in tenths (100 = £10.0m).
 *
 * @example
 * // Get player price in millions
 * const priceInMillions = player.now_cost / 10; // e.g., 12.5
 *
 * // Check if player is injured
 * const isInjured = player.chance_of_playing_next_round !== null &&
 *                   player.chance_of_playing_next_round < 100;
 *
 * // Get expected points
 * const expectedPts = parseFloat(player.ep_next || '0');
 */
export interface Player {
  /** Probability of playing next GW (0-100, null = 100%) */
  chance_of_playing_next_round: number | null;
  /** Probability of playing this GW (0-100, null = 100%) */
  chance_of_playing_this_round: number | null;
  /** Internal player code */
  code: number;
  /** Price change this gameweek (in tenths, positive = rise) */
  cost_change_event: number;
  /** Price falls this gameweek (in tenths) */
  cost_change_event_fall: number;
  /** Price change since season start (in tenths) */
  cost_change_start: number;
  /** Price falls since season start (in tenths) */
  cost_change_start_fall: number;
  /** Times selected for Dream Team */
  dreamteam_count: number;
  /** Position: 1=GK, 2=DEF, 3=MID, 4=FWD */
  element_type: PlayerPosition;
  /** Expected points next gameweek (string, parse to float) */
  ep_next: string | null;
  /** Expected points this gameweek (string, parse to float) */
  ep_this: string | null;
  /** Points scored this gameweek */
  event_points: number;
  /** Player's first name */
  first_name: string;
  /** Recent form (points per game, string, parse to float) */
  form: string;
  /** Player ID (unique identifier) */
  id: number;
  /** Whether in current Dream Team */
  in_dreamteam: boolean;
  /** Injury/suspension news text */
  news: string;
  /** When news was added (ISO timestamp, null if no news) */
  news_added: string | null;
  /** Current price in tenths (100 = £10.0m) */
  now_cost: number;
  /** Photo filename */
  photo: string;
  /** Points per game (string, parse to float) */
  points_per_game: string;
  /** Player's last name */
  second_name: string;
  /** Ownership percentage (string, e.g., "45.2") */
  selected_by_percent: string;
  /** Whether player has special status */
  special: boolean;
  /** Squad number (null if unassigned) */
  squad_number: number | null;
  /** Availability status: a=available, d=doubtful, i=injured, s=suspended, u=unavailable, n=not in squad */
  status: PlayerStatus;
  /** Team ID (references Team.id) */
  team: number;
  /** Team code (internal) */
  team_code: number;
  /** Total FPL points this season */
  total_points: number;
  /** Total transfers in this season */
  transfers_in: number;
  /** Transfers in this gameweek */
  transfers_in_event: number;
  /** Total transfers out this season */
  transfers_out: number;
  /** Transfers out this gameweek */
  transfers_out_event: number;
  /** Value based on recent form (string, parse to float) */
  value_form: string;
  /** Value based on season performance (string, parse to float) */
  value_season: string;
  /** Display name (shirt name), e.g., "Haaland" */
  web_name: string;
  /** Total minutes played */
  minutes: number;
  /** Goals scored */
  goals_scored: number;
  /** Assists */
  assists: number;
  /** Clean sheets (DEF/GK) */
  clean_sheets: number;
  /** Goals conceded (DEF/GK) */
  goals_conceded: number;
  /** Own goals */
  own_goals: number;
  /** Penalties saved (GK) */
  penalties_saved: number;
  /** Penalties missed */
  penalties_missed: number;
  /** Yellow cards */
  yellow_cards: number;
  /** Red cards */
  red_cards: number;
  /** Saves (GK) */
  saves: number;
  /** Bonus points earned */
  bonus: number;
  /** Bonus Points System score */
  bps: number;
  /** ICT influence score (string, parse to float) */
  influence: string;
  /** ICT creativity score (string, parse to float) */
  creativity: string;
  /** ICT threat score (string, parse to float) */
  threat: string;
  /** Combined ICT index (string, parse to float) */
  ict_index: string;
  /** Number of starts */
  starts: number;
  /** Expected goals (xG) (string, parse to float) */
  expected_goals: string;
  /** Expected assists (xA) (string, parse to float) */
  expected_assists: string;
  /** Expected goal involvements (xGI = xG + xA) (string, parse to float) */
  expected_goal_involvements: string;
  /** Expected goals conceded (xGC) (string, parse to float) */
  expected_goals_conceded: string;
  /** Influence rank overall */
  influence_rank: number;
  /** Influence rank within position */
  influence_rank_type: number;
  /** Creativity rank overall */
  creativity_rank: number;
  /** Creativity rank within position */
  creativity_rank_type: number;
  /** Threat rank overall */
  threat_rank: number;
  /** Threat rank within position */
  threat_rank_type: number;
  /** ICT index rank overall */
  ict_index_rank: number;
  /** ICT index rank within position */
  ict_index_rank_type: number;
  /** Corner/indirect FK order (1 = first choice, null = not on duty) */
  corners_and_indirect_freekicks_order: number | null;
  /** Corner duty text description */
  corners_and_indirect_freekicks_text: string;
  /** Direct FK order (1 = first choice, null = not on duty) */
  direct_freekicks_order: number | null;
  /** Direct FK duty text description */
  direct_freekicks_text: string;
  /** Penalty order (1 = first choice, null = not on duty) */
  penalties_order: number | null;
  /** Penalty duty text description */
  penalties_text: string;
  /** Expected goals per 90 minutes */
  expected_goals_per_90: number;
  /** Saves per 90 minutes (GK) */
  saves_per_90: number;
  /** Expected assists per 90 minutes */
  expected_assists_per_90: number;
  /** Expected goal involvements per 90 minutes */
  expected_goal_involvements_per_90: number;
  /** Expected goals conceded per 90 minutes */
  expected_goals_conceded_per_90: number;
  /** Goals conceded per 90 minutes */
  goals_conceded_per_90: number;
  /** Price rank overall */
  now_cost_rank: number;
  /** Price rank within position */
  now_cost_rank_type: number;
  /** Form rank overall */
  form_rank: number;
  /** Form rank within position */
  form_rank_type: number;
  /** Points per game rank overall */
  points_per_game_rank: number;
  /** Points per game rank within position */
  points_per_game_rank_type: number;
  /** Selection rank overall */
  selected_rank: number;
  /** Selection rank within position */
  selected_rank_type: number;
  /** Starts per 90 minutes */
  starts_per_90: number;
  /** Clean sheets per 90 minutes */
  clean_sheets_per_90: number;
}

/**
 * Player position type.
 * 1=Goalkeeper, 2=Defender, 3=Midfielder, 4=Forward
 */
export type PlayerPosition = 1 | 2 | 3 | 4;

/**
 * Player availability status.
 * - 'a' = Available
 * - 'd' = Doubtful (25-75% chance)
 * - 'i' = Injured (0% chance)
 * - 's' = Suspended
 * - 'u' = Unavailable
 * - 'n' = Not in squad
 */
export type PlayerStatus = "a" | "d" | "i" | "s" | "u" | "n";

export interface ElementStat {
  label: string;
  name: string;
}

export interface ElementType {
  id: number;
  plural_name: string;
  plural_name_short: string;
  singular_name: string;
  singular_name_short: string;
  squad_select: number;
  squad_min_select: number | null;
  squad_max_select: number | null;
  squad_min_play: number;
  squad_max_play: number;
  ui_shirt_specific: boolean;
  sub_positions_locked: number[];
  element_count: number;
}

// =============================================================================
// Fixtures Types (GET /fixtures/)
// =============================================================================

/**
 * Premier League fixture/match data.
 *
 * @example
 * // Get home team name
 * const homeTeam = teams.find(t => t.id === fixture.team_h);
 *
 * // Check fixture difficulty for home team
 * const isHardFixture = fixture.team_h_difficulty >= 4;
 *
 * // Check if match is in a specific gameweek
 * const gw5Fixtures = fixtures.filter(f => f.event === 5);
 */
export interface Fixture {
  /** Internal fixture code */
  code: number;
  /** Gameweek number (null if unscheduled, e.g., postponed) */
  event: number | null;
  /** Whether match has finished */
  finished: boolean;
  /** Provisional finished status */
  finished_provisional: boolean;
  /** Fixture ID */
  id: number;
  /** Kickoff time (ISO 8601, null if TBC) */
  kickoff_time: string | null;
  /** Minutes played (0-90+) */
  minutes: number;
  /** Whether kickoff time is provisional */
  provisional_start_time: boolean;
  /** Whether match has started (null if not yet) */
  started: boolean | null;
  /** Away team ID (references Team.id) */
  team_a: number;
  /** Away team score (null if not started) */
  team_a_score: number | null;
  /** Home team ID (references Team.id) */
  team_h: number;
  /** Home team score (null if not started) */
  team_h_score: number | null;
  /** Live stats (goals, assists, etc.) */
  stats: FixtureStat[];
  /** Fixture Difficulty Rating for home team (1-5, 1=easiest) */
  team_h_difficulty: number;
  /** Fixture Difficulty Rating for away team (1-5, 1=easiest) */
  team_a_difficulty: number;
  /** External Pulse ID */
  pulse_id: number;
}

export interface FixtureStat {
  identifier: string;
  a: FixtureStatValue[];
  h: FixtureStatValue[];
}

export interface FixtureStatValue {
  value: number;
  element: number;
}

// =============================================================================
// Element Summary Types (GET /element-summary/{id}/)
// =============================================================================

export interface ElementSummary {
  fixtures: PlayerFixture[];
  history: PlayerHistory[];
  history_past: PlayerHistoryPast[];
}

export interface PlayerFixture {
  id: number;
  code: number;
  team_h: number;
  team_h_score: number | null;
  team_a: number;
  team_a_score: number | null;
  event: number | null;
  finished: boolean;
  minutes: number;
  provisional_start_time: boolean;
  kickoff_time: string | null;
  event_name: string | null;
  is_home: boolean;
  difficulty: number;
}

export interface PlayerHistory {
  element: number;
  fixture: number;
  opponent_team: number;
  total_points: number;
  was_home: boolean;
  kickoff_time: string;
  team_h_score: number;
  team_a_score: number;
  round: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  starts: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  value: number;
  transfers_balance: number;
  selected: number;
  transfers_in: number;
  transfers_out: number;
}

export interface PlayerHistoryPast {
  season_name: string;
  element_code: number;
  start_cost: number;
  end_cost: number;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  starts: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
}

// =============================================================================
// Live Gameweek Types (GET /event/{gw}/live/)
// =============================================================================

export interface LiveGameweek {
  elements: LiveElement[];
}

export interface LiveElement {
  id: number;
  stats: LiveElementStats;
  explain: LiveExplain[];
}

export interface LiveElementStats {
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  starts: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  total_points: number;
  in_dreamteam: boolean;
}

export interface LiveExplain {
  fixture: number;
  stats: LiveExplainStat[];
}

export interface LiveExplainStat {
  identifier: string;
  points: number;
  value: number;
}

// =============================================================================
// Manager Entry Types (GET /entry/{id}/)
// =============================================================================

export interface ManagerEntry {
  id: number;
  joined_time: string;
  started_event: number;
  favourite_team: number | null;
  player_first_name: string;
  player_last_name: string;
  player_region_id: number;
  player_region_name: string;
  player_region_iso_code_short: string;
  player_region_iso_code_long: string;
  years_active: number;
  summary_overall_points: number;
  summary_overall_rank: number;
  summary_event_points: number;
  summary_event_rank: number;
  current_event: number;
  leagues: ManagerLeagues;
  name: string;
  name_change_blocked: boolean;
  entered_events: number[];
  kit: string | null;
  last_deadline_bank: number;
  last_deadline_value: number;
  last_deadline_total_transfers: number;
}

export interface ManagerLeagues {
  classic: ManagerLeague[];
  h2h: ManagerLeague[];
  cup: ManagerCup;
  cup_matches: ManagerCupMatch[];
}

export interface ManagerLeague {
  id: number;
  name: string;
  short_name: string | null;
  created: string;
  closed: boolean;
  rank: number | null;
  max_entries: number | null;
  league_type: string;
  scoring: string;
  admin_entry: number | null;
  start_event: number;
  entry_can_leave: boolean;
  entry_can_admin: boolean;
  entry_can_invite: boolean;
  has_cup: boolean;
  cup_league: number | null;
  cup_qualified: boolean | null;
  rank_count: number | null;
  entry_percentile_rank: number | null;
  active_phases: ActivePhase[];
  entry_rank: number;
  entry_last_rank: number;
}

export interface ActivePhase {
  phase: number;
  rank: number;
  last_rank: number;
  rank_sort: number;
  total: number;
  league_id: number;
  rank_count: number | null;
  entry_percentile_rank: number | null;
}

export interface ManagerCup {
  matches: ManagerCupMatch[];
  status: CupStatus;
  cup_league: number | null;
}

export interface ManagerCupMatch {
  id: number;
  entry_1_entry: number;
  entry_1_name: string;
  entry_1_player_name: string;
  entry_1_points: number;
  entry_1_win: number;
  entry_1_draw: number;
  entry_1_loss: number;
  entry_1_total: number;
  entry_2_entry: number;
  entry_2_name: string;
  entry_2_player_name: string;
  entry_2_points: number;
  entry_2_win: number;
  entry_2_draw: number;
  entry_2_loss: number;
  entry_2_total: number;
  is_knockout: boolean;
  league: number;
  winner: number | null;
  seed_value: number | null;
  event: number;
  tiebreak: string | null;
  is_bye: boolean;
  knockout_name: string;
}

export interface CupStatus {
  qualification_event: number | null;
  qualification_numbers: number | null;
  qualification_rank: number | null;
  qualification_state: string | null;
}

// =============================================================================
// Manager History Types (GET /entry/{id}/history/)
// =============================================================================

export interface ManagerHistory {
  current: ManagerHistoryCurrent[];
  past: ManagerHistoryPast[];
  chips: ManagerChip[];
}

export interface ManagerHistoryCurrent {
  event: number;
  points: number;
  total_points: number;
  rank: number;
  rank_sort: number;
  percentile_rank: number;
  overall_rank: number;
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
}

export interface ManagerHistoryPast {
  season_name: string;
  total_points: number;
  rank: number;
}

export interface ManagerChip {
  name: string;
  time: string;
  event: number;
}

// =============================================================================
// Manager Picks Types (GET /entry/{id}/event/{gw}/picks/)
// =============================================================================

export interface ManagerPicks {
  active_chip: string | null;
  automatic_subs: AutomaticSub[];
  entry_history: ManagerHistoryCurrent;
  picks: Pick[];
}

export interface Pick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface AutomaticSub {
  entry: number;
  element_in: number;
  element_out: number;
  event: number;
}

// =============================================================================
// League Standings Types (GET /leagues-classic/{id}/standings/)
// =============================================================================

export interface LeagueStandings {
  new_entries: LeagueNewEntries;
  last_updated_data: string;
  league: League;
  standings: StandingsPage;
}

export interface LeagueNewEntries {
  has_next: boolean;
  page: number;
  results: LeagueNewEntry[];
}

export interface LeagueNewEntry {
  entry: number;
  entry_name: string;
  joined_time: string;
  player_first_name: string;
  player_last_name: string;
}

export interface League {
  id: number;
  name: string;
  created: string;
  closed: boolean;
  max_entries: number | null;
  league_type: string;
  scoring: string;
  admin_entry: number | null;
  start_event: number;
  code_privacy: string;
  has_cup: boolean;
  cup_league: number | null;
  rank: number | null;
}

export interface StandingsPage {
  has_next: boolean;
  page: number;
  results: StandingsResult[];
}

export interface StandingsResult {
  id: number;
  event_total: number;
  player_name: string;
  rank: number;
  last_rank: number;
  rank_sort: number;
  total: number;
  entry: number;
  entry_name: string;
}

// =============================================================================
// Utility Types
// =============================================================================

export type ChipName = "wildcard" | "freehit" | "3xc" | "bboost";

export interface PositionInfo {
  id: PlayerPosition;
  singular: string;
  plural: string;
  shortSingular: string;
  shortPlural: string;
}

export const POSITIONS: Record<PlayerPosition, PositionInfo> = {
  1: {
    id: 1,
    singular: "Goalkeeper",
    plural: "Goalkeepers",
    shortSingular: "GK",
    shortPlural: "GKs",
  },
  2: {
    id: 2,
    singular: "Defender",
    plural: "Defenders",
    shortSingular: "DEF",
    shortPlural: "DEFs",
  },
  3: {
    id: 3,
    singular: "Midfielder",
    plural: "Midfielders",
    shortSingular: "MID",
    shortPlural: "MIDs",
  },
  4: {
    id: 4,
    singular: "Forward",
    plural: "Forwards",
    shortSingular: "FWD",
    shortPlural: "FWDs",
  },
};

export const PLAYER_STATUS_MAP: Record<
  PlayerStatus,
  { label: string; color: string }
> = {
  a: { label: "Available", color: "green" },
  d: { label: "Doubtful", color: "yellow" },
  i: { label: "Injured", color: "red" },
  s: { label: "Suspended", color: "red" },
  u: { label: "Unavailable", color: "red" },
  n: { label: "Not in squad", color: "gray" },
};
