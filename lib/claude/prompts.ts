/**
 * Prompt templates for Claude optimization
 */

import type {
  TransferConstraints,
  ChipConstraints,
  WildcardConstraints,
  TeamContext,
  LeagueContext,
} from './types';

export function buildTransferPrompt(
  query: string,
  constraints: TransferConstraints,
  team: TeamContext | undefined,
  league: LeagueContext | undefined,
  playerData: string,
  fixtureData: string,
): string {
  const teamSection = team
    ? `
## Current Team
Players: ${team.players.map((p) => `${p.name} (${p.position}, ${p.team}, £${p.price}m)`).join(', ')}
Bank: £${team.bank}m
Free Transfers: ${team.freeTransfers}
Chips Used: ${team.chipsUsed.length > 0 ? team.chipsUsed.join(', ') : 'None'}
`
    : '';

  const leagueSection = league
    ? `
## League Context
Rank: ${league.rank} of ${league.totalManagers}
Gap to Leader: ${league.gapToLeader} points
Gameweeks Remaining: ${league.gameweeksRemaining}
`
    : '';

  return `You are an expert Fantasy Premier League analyst. Analyze the user's request and provide optimal transfer recommendations.

## User Request
"${query}"

## Constraints
- Budget available: £${constraints.budget}m
- Maximum transfers: ${constraints.maxTransfers}
${constraints.positionNeeds?.length ? `- Position needs: ${constraints.positionNeeds.join(', ')}` : ''}
${constraints.excludePlayers?.length ? `- Exclude players: ${constraints.excludePlayers.join(', ')}` : ''}
${constraints.mustInclude?.length ? `- Must include: ${constraints.mustInclude.join(', ')}` : ''}
- Prefer differentials (<10% ownership): ${constraints.preferDifferentials ? 'Yes' : 'No'}
- Look ahead: ${constraints.lookAheadWeeks ?? 5} gameweeks
${teamSection}${leagueSection}
## Available Player Data (Top performers by form)
${playerData}

## Upcoming Fixtures (Next 5 GWs, FDR 1=easy, 5=hard)
${fixtureData}

## FPL Rules Reminder
- Squad: 15 players (2 GK, 5 DEF, 5 MID, 3 FWD)
- Max 3 players from any single team
- Each transfer beyond free transfers costs 4 points
- Selling price = purchase price + 50% of profit (rounded down)

## Your Task
Analyze the data and recommend the best transfers. For each transfer:
1. Who to sell and why
2. Who to buy and why
3. Net cost
4. Confidence level (high/medium/low)

Respond with a JSON object in this exact format:
{
  "summary": "Brief 1-2 sentence summary of recommendations",
  "recommendations": [
    {
      "out": { "name": "Player Name", "team": "TEAM", "price": 6.5, "reason": "Why sell" },
      "in": { "name": "Player Name", "team": "TEAM", "price": 7.0, "reason": "Why buy" },
      "netCost": 0.5,
      "priority": 1,
      "confidence": "high"
    }
  ],
  "warnings": ["Any concerns or caveats"]
}`;
}

export function buildChipPrompt(
  query: string,
  constraints: ChipConstraints,
  team: TeamContext | undefined,
  league: LeagueContext | undefined,
  fixtureData: string,
): string {
  const teamSection = team
    ? `
## Current Team
Players: ${team.players.map((p) => `${p.name} (${p.position}, ${p.team})`).join(', ')}
Chips Used: ${team.chipsUsed.length > 0 ? team.chipsUsed.join(', ') : 'None'}
`
    : '';

  const leagueSection = league
    ? `
## League Context
Rank: ${league.rank} of ${league.totalManagers}
Gap to Leader: ${league.gapToLeader} points
Gameweeks Remaining: ${league.gameweeksRemaining}
`
    : '';

  return `You are an expert Fantasy Premier League strategist specializing in chip timing. Analyze when to use the specified chip.

## User Request
"${query}"

## Chip to Analyze
${constraints.chip.toUpperCase()}

## Chips Still Available
${constraints.remainingChips.join(', ') || 'None specified'}
${teamSection}${leagueSection}
## Fixture Calendar & Double/Blank Gameweek Intel
${fixtureData}

## Chip Strategy Guidelines
- **Wildcard**: Best before tough fixture swings or to prepare for DGWs
- **Free Hit**: Ideal for BGWs (few fixtures) or stacking DGW players
- **Bench Boost**: Maximize during DGWs when bench players also have doubles
- **Triple Captain**: Target a premium player with easy DGW fixtures at home

## Your Task
Recommend the optimal gameweek to use this chip. Consider:
1. Fixture difficulty ratings
2. Double/Blank gameweek calendar
3. Team composition and needs
4. Mini-league position (aggressive vs conservative)

Respond with a JSON object:
{
  "summary": "Brief recommendation summary",
  "recommendation": {
    "chip": "${constraints.chip}",
    "recommendedGameweek": 25,
    "reasoning": "Detailed explanation",
    "confidence": "high",
    "alternatives": [
      { "gameweek": 28, "reason": "Why this is backup option" }
    ]
  },
  "warnings": ["Any risks or dependencies"]
}`;
}

export function buildWildcardPrompt(
  query: string,
  constraints: WildcardConstraints,
  league: LeagueContext | undefined,
  playerData: string,
  fixtureData: string,
): string {
  const leagueSection = league
    ? `
## League Context
Rank: ${league.rank} of ${league.totalManagers}
Gap to Leader: ${league.gapToLeader} points
Gameweeks Remaining: ${league.gameweeksRemaining}
`
    : '';

  return `You are an expert Fantasy Premier League team builder. Construct an optimal 15-player wildcard squad.

## User Request
"${query}"

## Constraints
- Total budget: £${constraints.budget}m
- Look ahead: ${constraints.lookAheadWeeks} gameweeks
${constraints.preferredFormation ? `- Preferred formation: ${constraints.preferredFormation}` : ''}
${constraints.mustInclude?.length ? `- Must include: ${constraints.mustInclude.join(', ')}` : ''}
${constraints.excludePlayers?.length ? `- Exclude: ${constraints.excludePlayers.join(', ')}` : ''}
${leagueSection}
## Available Players (Top by form, grouped by position)
${playerData}

## Upcoming Fixtures (FDR 1=easy, 5=hard)
${fixtureData}

## Squad Rules
- 2 Goalkeepers
- 5 Defenders
- 5 Midfielders
- 3 Forwards
- Max 3 players from any team
- Must be within budget

## Your Task
Build the optimal 15-player squad. Consider:
1. Fixture runs over the look-ahead period
2. Form and expected points
3. Price trajectory (rising/falling)
4. Ownership for differential potential
5. Captain options

Respond with a JSON object:
{
  "summary": "Brief description of team strategy",
  "recommendation": {
    "team": [
      { "name": "Player Name", "position": "GK", "team": "TEAM", "price": 5.0 }
    ],
    "formation": "3-4-3",
    "totalCost": 99.5,
    "keyPicks": [
      { "name": "Player Name", "reason": "Why this player is key" }
    ],
    "differentials": ["Player1", "Player2"]
  },
  "warnings": ["Any concerns"]
}`;
}

export function buildSystemPrompt(): string {
  return `You are an expert Fantasy Premier League analyst with deep knowledge of:
- Player statistics, form, and expected points
- Fixture difficulty ratings and team strength
- Price change predictions
- Chip strategy and timing
- Mini-league game theory

Always provide data-driven recommendations. Be specific about player names, prices, and reasoning.
When uncertain, clearly state confidence levels and alternative options.
Your response must be valid JSON that can be parsed programmatically.`;
}
