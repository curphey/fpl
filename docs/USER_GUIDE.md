# FPL Insights User Guide

A complete guide to using FPL Insights for Fantasy Premier League success.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Live Gameweek](#live-gameweek)
4. [Transfer Hub](#transfer-hub)
5. [Captain Selector](#captain-selector)
6. [Fixture Planner](#fixture-planner)
7. [Chip Strategy](#chip-strategy)
8. [Mini-League Analyzer](#mini-league-analyzer)
9. [AI Optimizer](#ai-optimizer)
10. [Draft Mode](#draft-mode)
11. [My Team](#my-team)
12. [Notifications](#notifications)
13. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### Connecting Your FPL Account

FPL Insights uses your **Manager ID** to fetch your team data from the official FPL API.

**Finding Your Manager ID:**

1. Log in to the [official FPL website](https://fantasy.premierleague.com)
2. Click on "Points" to view your team
3. Look at the URL: `https://fantasy.premierleague.com/entry/XXXXXX/event/1`
4. The number after `/entry/` is your Manager ID

**Entering Your Manager ID:**

1. Click the input field in the header (shows "Enter FPL ID")
2. Type your Manager ID
3. Press Enter or click the arrow button
4. Your team name will appear once connected

> **Tip:** Sign in with Google to sync your Manager ID across devices.

### Optional: Google Sign-In

Signing in with Google provides:

- Manager ID synced across all your devices
- Notification preferences saved to your account
- No need to re-enter your ID each visit

Click "Sign In" in the header to connect with Google.

---

## Dashboard

The Dashboard provides an overview of the current gameweek and your team's performance.

### Gameweek Banner

Shows the current gameweek status:

- **Deadline countdown** - Time remaining until transfers lock
- **Your points** - Current GW points (live during matches)
- **Average** - League average for comparison
- **Highest** - Top score this gameweek

### Key Stats

Quick metrics for your team:

- **Overall Rank** - Your position out of all FPL managers
- **GW Rank** - How you performed this gameweek
- **Total Points** - Season total
- **Team Value** - Current squad value

### Top Performers

Lists the highest-scoring players this gameweek, helping you identify form players to target.

### Upcoming Fixtures

Shows the next set of fixtures with difficulty ratings, so you can plan transfers ahead.

---

## Live Gameweek

Track your team's performance during live matches.

### Match Scores

- Real-time scores for all matches
- Your players highlighted with their current points
- Bonus point predictions (BPS) before confirmation

### Live Points Breakdown

| Icon | Meaning          |
| ---- | ---------------- |
| ⚽   | Goal scored      |
| 🅰️   | Assist           |
| 🧤   | Clean sheet      |
| 🛡️   | Save points      |
| ⭐   | Bonus points     |
| 🟨   | Yellow card (-1) |
| 🟥   | Red card (-3)    |

### BPS Tracker

Before bonus points are confirmed, the BPS Tracker shows:

- Current BPS scores for all players in each match
- Projected 3-2-1 bonus allocation
- Minutes remaining that could affect final bonus

### Top Performers

See who's hauling across all matches to identify transfer targets.

---

## Transfer Hub

Your command center for making informed transfer decisions.

### Transfer Recommendations

AI-generated suggestions based on:

- **Form** - Recent points and underlying stats
- **Fixtures** - Upcoming fixture difficulty
- **Value** - Price vs points potential
- **Ownership** - Differential opportunities

Each recommendation shows:

- Player name and team
- Position
- Price and ownership %
- Recommendation score (0-100)
- Reasoning summary

### Price Change Predictions

See which players are likely to rise or fall in price:

- **Price Rise** - Players trending upward (green)
- **Price Fall** - Players trending downward (red)
- **Threshold** - How close to the next change

> **Tip:** Make transfers before price rises to gain team value.

### Timing Advice

- Best time to make transfers (typically close to deadline)
- Whether to hold or act based on injury news
- Chip considerations that affect transfer strategy

### Injury Returns

Players expected back from injury:

- Expected return gameweek
- Injury details
- Price since injury

---

## Captain Selector

Choose the optimal captain with data-driven rankings.

### Captain Rankings

Players scored on multiple factors:

| Factor     | Weight | Description                    |
| ---------- | ------ | ------------------------------ |
| Form       | 25%    | Recent points per game         |
| Fixture    | 25%    | Opposition strength            |
| xGI        | 20%    | Expected goal involvement      |
| Set Pieces | 15%    | Penalties, corners, free kicks |
| Ownership  | 15%    | Differential potential         |

### Score Breakdown

Click any player to see their detailed scoring:

- Individual factor scores (0-10)
- Raw stat values
- Comparison to other options

### Recommendations

- **Safe Pick** - High-ownership, consistent performer
- **Differential** - Lower ownership for mini-league gains
- **Fixture-Based** - Best match-up this week

---

## Fixture Planner

Plan transfers around fixture difficulty.

### FDR Grid

A visual grid showing fixture difficulty for all teams:

- **Green (1-2)** - Easy fixtures
- **Gray (3)** - Medium fixtures
- **Red (4-5)** - Difficult fixtures

Use the slider to adjust the number of gameweeks shown (1-10).

### Double/Blank Gameweeks

Automatically highlighted when known:

- **DGW** - Teams with two fixtures (highlighted in purple)
- **BGW** - Teams without a fixture (highlighted in dark)

### Fixture Swings

Identifies teams with changing fixture runs:

- **Improving** - Difficult fixtures ending, easy run starting
- **Worsening** - Easy run ending, tough fixtures ahead

Great for timing transfers in/out of team assets.

### Best Teams to Target

Ranked list of teams by upcoming fixture difficulty:

- Combined FDR score over your selected range
- Number of DGW/BGW in the period
- Key players from each team

---

## Chip Strategy

Optimize when to play your chips for maximum impact.

### Available Chips

| Chip               | Effect                       | Best Use                      |
| ------------------ | ---------------------------- | ----------------------------- |
| **Wildcard**       | Unlimited free transfers     | Squad overhaul, fixture swing |
| **Free Hit**       | One-week unlimited transfers | BGW/DGW, injury crisis        |
| **Triple Captain** | Captain scores 3x            | DGW, premium vs weak opponent |
| **Bench Boost**    | Bench players score          | DGW with 15 playing           |

### Timing Recommendations

Each chip shows:

- **Recommended GW** - Optimal gameweek to use
- **Confidence** - How strong the recommendation is
- **Reasoning** - Why this timing is suggested

Factors considered:

- Double/Blank gameweeks
- Fixture difficulty
- Your current rank and goals
- Chips already used

### Chip History

See past chip performance:

- Which gameweek you used each chip
- Points scored
- Verdict (good/neutral/poor decision)

---

## Mini-League Analyzer

Gain an edge in your mini-leagues.

### Connecting a League

1. Go to the Leagues page
2. Enter your Manager ID if not connected
3. Your leagues will appear automatically
4. Click "Analyze" on any league

### Effective Ownership (EO)

Shows how widely owned each player is within your mini-league:

- **League EO%** - Percentage of analyzed managers who own
- **Captain EO%** - Percentage who captained
- **Your Status** - Own/Captain/Bench/Don't Own

High EO players are "safe" - they won't lose you ground. Low EO players are differentials.

### Differentials

**Your Differentials (Attack)**

- Players you own that rivals don't
- These can gain you ground if they score

**Their Differentials (Cover)**

- Players rivals own that you don't
- These can lose you ground - consider covering

### Rival Comparison

Head-to-head analysis with specific rivals:

- Shared players (cancel out)
- Players only you own
- Players only they own
- Captain comparison

### Swing Scenarios

"What if" analysis:

- If Player X scores 2/6/10/15 points, what's your net gain/loss?
- Helps prioritize which differentials matter most

### Chip Tracking

See which rivals have used their chips:

- Remaining chips for each rival
- Chip advantage opportunities
- Alerts when rivals play chips

---

## AI Optimizer

Claude-powered transfer and squad optimization.

### How It Works

1. Select optimization type (Transfer/Chip/Wildcard)
2. Describe your situation and constraints
3. AI analyzes your team, fixtures, and FPL data
4. Receive personalized recommendations

### Optimization Types

**Transfer Optimization**

- Best player(s) to transfer in/out
- Hit vs wait analysis
- Differential suggestions

**Chip Advice**

- Optimal chip timing
- Squad requirements for chip success
- Risk assessment

**Wildcard Planning**

- Full 15-player squad suggestions
- Budget allocation
- Formation recommendations

### Using the Optimizer

Write a natural language query:

> "I have 2 FTs and £2.5m ITB. Should I get Salah for the DGW or spread funds?"

Include relevant context:

- Budget available
- Position needs
- Mini-league situation
- Risk tolerance

### Understanding Results

The AI provides:

- **Thinking Process** - How it analyzed your situation
- **Recommendations** - Specific players/actions
- **Reasoning** - Why each suggestion makes sense
- **Warnings** - Risks to consider

---

## Draft Mode

For FPL Draft leagues with snake or auction formats.

### Draft Rankings

ADP-based rankings for all players:

- **Estimated ADP** - Where players typically get drafted
- **Value Score** - Points potential vs draft position
- **Tier** - Elite/Premium/Mid/Value/Bench

Filter by position to focus your shortlist.

### Snake Draft Simulator

Simulate a snake draft:

1. Set league size (4-16 managers)
2. Set your draft position
3. View the draft board with snake direction
4. Get pick suggestions based on:
   - Best player available (BPA)
   - Positional need
   - Value vs ADP

### Auction Draft Simulator

Plan your auction strategy:

- Budget allocation by position
- Suggested bid amounts
- Value targets for nominations
- Remaining budget tracker

### Keeper Analysis

Evaluate keeper league decisions:

- Keeper value score (age, consistency, ceiling)
- Keep/Drop recommendation
- Comparison between keeper candidates

---

## My Team

View and manage your FPL squad.

### Pitch View

Visual representation of your team:

- Starting XI in formation
- Bench players
- Captain (C) and Vice-Captain (VC) badges
- Current GW points per player

### Gameweek Navigation

Use arrows to view past gameweek teams:

- See historical picks
- Review captain choices
- Check chip usage

### Squad Value Tracker

Track your team value over time:

- Current squad value
- Bank balance
- Value gained/lost this season
- Player-by-player value changes

---

## Notifications

Stay informed with push and email notifications.

### Notification Types

| Type                  | Description                    |
| --------------------- | ------------------------------ |
| **Deadline Reminder** | Alert before GW deadline       |
| **Price Changes**     | Players about to rise/fall     |
| **Injury Updates**    | News about your players        |
| **League Updates**    | Mini-league position changes   |
| **Weekly Summary**    | Transfer recommendations email |

### Setting Up Push Notifications

1. Go to Settings > Notifications
2. Click "Enable Push Notifications"
3. Allow notifications when prompted
4. Configure which alerts you want

### Setting Up Email Notifications

1. Ensure you're signed in
2. Go to Settings > Notifications
3. Toggle "Email Notifications" on
4. Select notification types

### Quiet Hours

Set times when you don't want notifications:

- Configure start and end hours
- Set your timezone
- Notifications queue until quiet hours end

---

## Tips & Best Practices

### General Strategy

1. **Don't chase points** - Last week's top scorer often blanks next week
2. **Plan ahead** - Use Fixture Planner to identify good runs
3. **Hold transfers** - Having 2 FTs gives flexibility for injuries
4. **Balance risk** - Mix safe picks with differentials

### Using the Tools Effectively

1. **Check daily** - Price changes happen overnight
2. **Before deadline** - Use Captain Selector and AI Optimizer
3. **During GW** - Track Live Gameweek for entertainment
4. **After GW** - Analyze with Mini-League Analyzer

### Chip Strategy

1. **Wildcard** - Save for big fixture swings or team crisis
2. **Free Hit** - Best for blank gameweeks
3. **Triple Captain** - DGW + easy fixture + premium asset
4. **Bench Boost** - Only when all 15 have good fixtures

### Mini-League Success

1. **Know your rivals** - Use the Analyzer weekly
2. **Manage risk** - Bigger differentials when chasing
3. **Cover key players** - Don't ignore high-EO assets
4. **Time chips strategically** - Consider when rivals will use theirs

---

## Keyboard Shortcuts

| Shortcut | Action              |
| -------- | ------------------- |
| `G`      | Go to Dashboard     |
| `L`      | Go to Live Gameweek |
| `T`      | Go to Transfers     |
| `F`      | Go to Fixtures      |
| `M`      | Go to My Team       |
| `?`      | Show help           |

---

## Getting Help

- **GitHub Issues** - Report bugs or request features
- **Documentation** - See [API docs](./API.md) for technical details
- **Deployment** - See [Deployment Guide](./DEPLOYMENT.md) for self-hosting

---

## Glossary

| Term    | Definition                          |
| ------- | ----------------------------------- |
| **ADP** | Average Draft Position              |
| **BGW** | Blank Gameweek (no fixture)         |
| **BPS** | Bonus Points System                 |
| **DGW** | Double Gameweek (two fixtures)      |
| **EO**  | Effective Ownership                 |
| **FDR** | Fixture Difficulty Rating (1-5)     |
| **FT**  | Free Transfer                       |
| **GW**  | Gameweek                            |
| **ITB** | In The Bank (budget)                |
| **RMT** | Rate My Team                        |
| **TC**  | Triple Captain chip                 |
| **xA**  | Expected Assists                    |
| **xG**  | Expected Goals                      |
| **xGI** | Expected Goal Involvement (xG + xA) |
