# Fantasy Premier League Optimization Application
## Product Specification v1.0

---

## Executive Summary

This specification outlines a web application designed to give Fantasy Premier League (FPL) managers a competitive edge through data-driven decision making, advanced analytics, and strategic optimization tools. The application will leverage the official FPL API, third-party statistical data, and machine learning models to provide actionable insights.

---

## Table of Contents

1. [Understanding FPL](#1-understanding-fpl)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Core Features](#4-core-features)
5. [Data Sources & API Integration](#5-data-sources--api-integration)
6. [Technical Architecture](#6-technical-architecture)
7. [User Interface Design](#7-user-interface-design)
8. [Analytics Engine](#8-analytics-engine)
9. [Optimization Algorithms](#9-optimization-algorithms)
10. [Development Phases](#10-development-phases)
11. [Success Metrics](#11-success-metrics)
12. [Competitive Analysis](#12-competitive-analysis)

---

## 1. Understanding FPL - Comprehensive Rules Reference

> **CRITICAL FOR DEVELOPERS**: This section contains the complete rules of FPL. Every constraint, edge case, and validation rule is documented here. The application MUST enforce these rules. Any recommendation that violates these rules is INVALID.

---

### 1.1 Squad Composition Rules

#### 1.1.1 Squad Size and Structure

| Rule | Value | Validation |
|------|-------|------------|
| Total squad size | **Exactly 15 players** | Cannot be 14 or 16. Ever. |
| Goalkeepers | **Exactly 2** | Not 1, not 3. Exactly 2. |
| Defenders | **Exactly 5** | Not 4, not 6. Exactly 5. |
| Midfielders | **Exactly 5** | Not 4, not 6. Exactly 5. |
| Forwards | **Exactly 3** | Not 2, not 4. Exactly 3. |

```
VALIDATION: count(GK) == 2 AND count(DEF) == 5 AND count(MID) == 5 AND count(FWD) == 3
VALIDATION: total_players == 15
```

#### 1.1.2 Team Limit Rule

| Rule | Value | Validation |
|------|-------|------------|
| Max players from same Premier League team | **3** | Cannot have 4+ players from Arsenal, etc. |

```
VALIDATION: For each of 20 PL teams: count(players from team) <= 3
```

**Example violations to catch**:
- ❌ 4 Arsenal players (Saka, Saliba, Raya, Martinelli)
- ❌ Transfer in 4th Liverpool player when you have 3
- ✅ 3 Man City + 3 Arsenal + 3 Liverpool = valid (9 players from 3 teams)

#### 1.1.3 Budget Rules

| Rule | Value | Validation |
|------|-------|------------|
| Starting budget | **£100.0m** | All new teams start here |
| Minimum spend | **£0** | You can have money in bank |
| Maximum squad value | **No limit** | Team value can exceed £100m through price rises |
| Bank balance | **No maximum** | Can hold any amount in bank |
| Price precision | **£0.1m increments** | All prices end in .0, .1, .2, etc. |

```
VALIDATION: sum(player_prices) + bank <= total_budget
VALIDATION: bank >= 0 (cannot go negative)
VALIDATION: All prices are multiples of 0.1
```

**Budget edge cases**:
- Player A costs £10.0m, you have £10.0m in bank → ✅ Valid (bank becomes £0.0m)
- Player A costs £10.1m, you have £10.0m in bank → ❌ Invalid (insufficient funds)
- Team value £105.3m, bank £2.1m, total budget £107.4m → ✅ Valid (price rises allowed this)

---

### 1.2 Starting XI Rules

#### 1.2.1 Formation Constraints

The **starting 11** must follow valid football formations:

| Position | Minimum | Maximum | Notes |
|----------|---------|---------|-------|
| Goalkeeper | 1 | 1 | Always exactly 1 GK starts |
| Defenders | 3 | 5 | At least 3, max 5 |
| Midfielders | 2 | 5 | At least 2, can be up to 5 |
| Forwards | 1 | 3 | At least 1, max 3 |

```
VALIDATION: starting_GK == 1
VALIDATION: starting_DEF >= 3 AND starting_DEF <= 5
VALIDATION: starting_MID >= 2 AND starting_MID <= 5
VALIDATION: starting_FWD >= 1 AND starting_FWD <= 3
VALIDATION: starting_GK + starting_DEF + starting_MID + starting_FWD == 11
```

**Valid formations** (GK always 1):
| Formation | DEF | MID | FWD | Total |
|-----------|-----|-----|-----|-------|
| 3-4-3 | 3 | 4 | 3 | 11 ✅ |
| 3-5-2 | 3 | 5 | 2 | 11 ✅ |
| 4-3-3 | 4 | 3 | 3 | 11 ✅ |
| 4-4-2 | 4 | 4 | 2 | 11 ✅ |
| 4-5-1 | 4 | 5 | 1 | 11 ✅ |
| 5-2-3 | 5 | 2 | 3 | 11 ✅ |
| 5-3-2 | 5 | 3 | 2 | 11 ✅ |
| 5-4-1 | 5 | 4 | 1 | 11 ✅ |

**Invalid formations to reject**:
| Formation | Why Invalid |
|-----------|-------------|
| 2-5-3 | Only 2 defenders (min 3) |
| 4-1-5 | Only 1 midfielder (min 2) |
| 3-4-4 | 12 outfield players |
| 5-5-0 | 0 forwards (min 1) |

#### 1.2.2 Bench Structure

| Position | Bench Slot | Purpose |
|----------|------------|---------|
| Slot 1 | GK | Backup goalkeeper |
| Slot 2 | Outfield | First substitute |
| Slot 3 | Outfield | Second substitute |
| Slot 4 | Outfield | Third substitute |

```
VALIDATION: bench[0].position == 'GK'
VALIDATION: bench[1].position != 'GK'
VALIDATION: bench[2].position != 'GK'
VALIDATION: bench[3].position != 'GK'
VALIDATION: count(bench) == 4
```

**Bench order matters for auto-substitutions** (see section 1.6)

---

### 1.3 Captain and Vice-Captain Rules

#### 1.3.1 Basic Rules

| Rule | Description |
|------|-------------|
| Captain selection | Must be from starting 11 |
| Vice-captain selection | Must be from starting 11 |
| Captain ≠ Vice-captain | Cannot be the same player |
| Captain points | Doubled (×2) |
| Vice-captain activation | Only if captain plays 0 minutes |

```
VALIDATION: captain IN starting_11
VALIDATION: vice_captain IN starting_11
VALIDATION: captain != vice_captain
```

#### 1.3.2 Captain Points Calculation

```
IF captain.minutes > 0:
    captain_points = captain.base_points × 2
ELSE IF vice_captain.minutes > 0:
    captain_points = vice_captain.base_points × 2
    # Vice-captain becomes effective captain
ELSE:
    captain_points = 0
    # Neither played, no doubled points
```

**Edge cases**:
- Captain plays 1 minute, scores 1 point → Gets 2 points (doubled) ✅
- Captain plays 0 minutes, VC plays 90 → VC points doubled ✅
- Captain plays 0 minutes, VC plays 0 minutes → No doubling occurs ✅
- Captain is subbed off at 59 minutes → Still counts as played, points doubled ✅

---

### 1.4 Scoring System (2025/26 Season)

#### 1.4.1 Appearance Points

| Action | Points | Conditions |
|--------|--------|------------|
| Playing 1-59 minutes | 1 | Any minutes played |
| Playing 60+ minutes | 2 | Must be 60 or more |
| Not playing | 0 | 0 minutes = 0 points |

```
IF minutes == 0: appearance_points = 0
ELSE IF minutes < 60: appearance_points = 1
ELSE: appearance_points = 2
```

**Edge case**: Player plays exactly 60 minutes → Gets 2 points ✅

#### 1.4.2 Goal Scoring Points

| Position | Points per Goal |
|----------|-----------------|
| Forward | 4 |
| Midfielder | 5 |
| Defender | 6 |
| Goalkeeper | 6 |

```
goal_points = goals × points_per_position[player.position]
```

**Important**: Position is determined by FPL classification, NOT where player actually plays on pitch
- Trent Alexander-Arnold is classified as DEF → Gets 6 points per goal
- Even if he plays midfield in real life, FPL position is what counts

#### 1.4.3 Assist Points

| Action | Points |
|--------|--------|
| Assist | 3 |

**FPL Assist Definition** (different from Opta):
- Pass leading directly to a goal
- Winning a penalty that is scored counts as assist
- Winning a free kick that is scored does NOT count as assist
- Shot that is saved and scored on rebound → Original shooter gets assist

#### 1.4.4 Clean Sheet Points

| Position | Points | Condition |
|----------|--------|-----------|
| Goalkeeper | 4 | Team concedes 0 goals AND player plays 60+ mins |
| Defender | 4 | Team concedes 0 goals AND player plays 60+ mins |
| Midfielder | 1 | Team concedes 0 goals AND player plays 60+ mins |
| Forward | 0 | Forwards never get clean sheet points |

```
IF team_goals_conceded == 0 AND player.minutes >= 60:
    IF player.position IN ['GK', 'DEF']: clean_sheet_points = 4
    ELSE IF player.position == 'MID': clean_sheet_points = 1
    ELSE: clean_sheet_points = 0
ELSE:
    clean_sheet_points = 0
```

**Critical edge cases**:
- Player plays 59 minutes, team keeps clean sheet → 0 clean sheet points ❌
- Player plays 60 minutes, team concedes in 90th minute → 0 clean sheet points ❌
- Player subbed off at 60 mins with clean sheet, team concedes later → 4 points ✅
- Player subbed ON at 30 mins, plays to 90 mins (60 mins total), clean sheet → 4 points ✅

#### 1.4.5 Goals Conceded Points (GK and DEF only)

| Goals Conceded | Points |
|----------------|--------|
| 0 | 0 (but clean sheet bonus applies) |
| 1 | 0 |
| 2 | -1 |
| 3 | -1 |
| 4 | -2 |
| 5 | -2 |
| n | -floor(n/2) |

```
IF player.position IN ['GK', 'DEF']:
    goals_conceded_points = -floor(goals_conceded / 2)
ELSE:
    goals_conceded_points = 0
```

**Note**: Only applies while player is on pitch. If subbed off, only counts goals conceded during their time.

#### 1.4.6 Goalkeeper Save Points

| Action | Points |
|--------|--------|
| Every 3 saves | 1 |

```
save_points = floor(saves / 3)
```

**Examples**:
- 2 saves → 0 points
- 3 saves → 1 point
- 5 saves → 1 point
- 6 saves → 2 points
- 10 saves → 3 points

#### 1.4.7 Penalty Points

| Action | Points |
|--------|--------|
| Penalty saved (GK) | 5 |
| Penalty missed (any) | -2 |

**Definitions**:
- Penalty saved = Goalkeeper stops the penalty
- Penalty missed = Shot misses target (hits post/bar or off target)
- Penalty scored = Normal goal points apply (no bonus for penalties)

#### 1.4.8 Card Points

| Action | Points |
|--------|--------|
| Yellow card | -1 |
| Red card (direct) | -3 |
| Red card (two yellows) | -3 total (-1 first yellow, -2 for red) |

```
IF yellow_cards == 1 AND red_cards == 0: card_points = -1
ELSE IF yellow_cards == 2 AND red_cards == 1: card_points = -3  # Two yellows = red
ELSE IF yellow_cards == 0 AND red_cards == 1: card_points = -3  # Straight red
```

#### 1.4.9 Own Goal Points

| Action | Points |
|--------|--------|
| Own goal | -2 |

Applied to any player who scores own goal, regardless of position.

#### 1.4.10 Bonus Points System (BPS)

After each match, bonus points awarded to top 3 players by BPS score:

| BPS Rank | Bonus Points |
|----------|--------------|
| 1st | 3 |
| 2nd | 2 |
| 3rd | 1 |

**Tie-breaking rules**:
- If players tie for 1st: Both get 3 bonus points
- If 2 players tie for 1st: 3rd place gets 1 bonus point
- If 3+ players tie for 1st: All get 3 bonus points, no 2nd/3rd awarded
- If players tie for 2nd: Both get 2 bonus points
- Etc.

**BPS scoring factors** (simplified):
- Goals, assists, clean sheets, saves increase BPS
- Cards, own goals, penalties missed decrease BPS
- Detailed BPS calculation is complex and done by FPL

#### 1.4.11 NEW: Defensive Contributions (DEFCON) - 2025/26

| Position | Requirement | Points |
|----------|-------------|--------|
| Defender | 10 CBIT (Clearances, Blocks, Interceptions, Tackles) | 2 |
| Midfielder/Forward | 12 CBIRT (includes Ball Recoveries) | 2 |

```
IF player.position == 'DEF' AND (clearances + blocks + interceptions + tackles) >= 10:
    defcon_points = 2
ELSE IF player.position IN ['MID', 'FWD'] AND (clearances + blocks + interceptions + tackles + recoveries) >= 12:
    defcon_points = 2
ELSE:
    defcon_points = 0
```

---

### 1.5 Transfer Rules

#### 1.5.1 Free Transfers

| Rule | Value |
|------|-------|
| Free transfers per gameweek | 1 |
| Maximum banked transfers | 5 (NEW for 2025/26, was 2) |
| Rollover rule | Unused FT rolls to next week |
| Maximum possible FTs | 5 (with 4 banked + 1 new) |

```
new_gameweek_FT = min(previous_unused_FT + 1, 5)
```

**Examples**:
- GW1: Start with 1 FT, use 0 → GW2: 2 FT
- GW2: Have 2 FT, use 0 → GW3: 3 FT
- GW3: Have 3 FT, use 0 → GW4: 4 FT
- GW4: Have 4 FT, use 0 → GW5: 5 FT (maximum)
- GW5: Have 5 FT, use 0 → GW6: 5 FT (capped, doesn't become 6)

#### 1.5.2 Transfer Hits

| Transfers | Free Transfers Available | Cost |
|-----------|-------------------------|------|
| 1 | 1+ | 0 points |
| 2 | 2+ | 0 points |
| 2 | 1 | -4 points |
| 3 | 1 | -8 points |
| 5 | 3 | -8 points |

```
hit_cost = max(0, (transfers_made - free_transfers) × 4)
```

**Formula**:
```
points_deducted = max(0, transfers_made - free_transfers_available) × 4
```

#### 1.5.3 Player Selling Price

**Critical rule often misunderstood**:

```
selling_price = purchase_price + floor((current_price - purchase_price) / 2)
```

You only get **HALF** the profit (rounded down) when selling.

**Examples**:
| Bought At | Current Price | Profit | Your Share | Selling Price |
|-----------|---------------|--------|------------|---------------|
| £7.0m | £7.5m | £0.5m | £0.2m | £7.2m |
| £7.0m | £8.0m | £1.0m | £0.5m | £7.5m |
| £7.0m | £8.3m | £1.3m | £0.6m | £7.6m |
| £7.0m | £6.5m | -£0.5m | -£0.5m | £6.5m |

**Loss scenario**: If price drops, you lose the FULL amount (no protection).

#### 1.5.4 Transfer Deadline

| Rule | Details |
|------|---------|
| Deadline | 90 minutes before first kick-off of gameweek |
| After deadline | No transfers possible until next GW |
| Deadline during BGW | Still 90 mins before first match |

**Edge cases**:
- Friday 8pm kick-off → Deadline is Friday 6:30pm
- Saturday 12:30pm kick-off → Deadline is Saturday 11:00am
- If matches span multiple days, deadline is before FIRST match

#### 1.5.5 GW16 Special Rule (2025/26)

| Rule | Details |
|------|---------|
| GW16 bonus | All managers receive 5 free transfers |
| Purpose | AFCON planning (African players absent) |
| Stacking | Replaces current FT count, doesn't add to it |

```
IF gameweek == 16:
    free_transfers = 5  # Regardless of what you had
```

---

### 1.6 Auto-Substitution Rules

**When auto-subs happen**: After all matches complete, if starting player played 0 minutes.

#### 1.6.1 Substitution Order

1. Check bench in order: Slot 1 (GK), Slot 2, Slot 3, Slot 4
2. For each bench player, check if substitution is VALID
3. First valid sub replaces the non-playing starter
4. Maximum 3 outfield subs (GK can only replace GK)

#### 1.6.2 Valid Substitution Rules

```
FUNCTION is_valid_substitution(starter, bench_player, current_formation):
    # GK can only be replaced by GK
    IF starter.position == 'GK':
        RETURN bench_player.position == 'GK'

    # Check if formation remains valid after swap
    new_formation = calculate_formation(starting_11 - starter + bench_player)

    RETURN (
        new_formation.DEF >= 3 AND
        new_formation.MID >= 2 AND
        new_formation.FWD >= 1 AND
        new_formation.total == 11
    )
```

#### 1.6.3 Auto-Sub Examples

**Example 1**: Simple substitution
```
Starting: 1 GK, 4 DEF, 4 MID, 2 FWD (4-4-2)
Bench: GK, DEF, MID, FWD

Scenario: One MID doesn't play
Result: First bench outfield player (DEF) comes in → 5-3-2 ✅
```

**Example 2**: Formation constraint blocks sub
```
Starting: 1 GK, 3 DEF, 5 MID, 2 FWD (3-5-2)
Bench: GK, FWD, MID, DEF

Scenario: One DEF doesn't play
- Bench slot 2 is FWD → Would make 2-5-3 (only 2 DEF) → INVALID ❌
- Skip to bench slot 3 (MID) → Would make 2-6-2 (only 2 DEF) → INVALID ❌
- Skip to bench slot 4 (DEF) → Makes 3-5-2 → VALID ✅
```

**Example 3**: No valid sub available
```
Starting: 1 GK, 3 DEF, 5 MID, 2 FWD (3-5-2)
Bench: GK, FWD, FWD, FWD

Scenario: One DEF doesn't play
- All bench outfield are FWD → No valid sub exists
- Team plays with 10 effective players
- No points from 4th bench slot (would need DEF)
```

---

### 1.7 Chip Rules (2025/26 - Two Sets)

#### 1.7.1 Chip Overview

| Chip | Set 1 (GW1-19) | Set 2 (GW20-38) | Total Available |
|------|----------------|-----------------|-----------------|
| Wildcard | 1 | 1 | 2 |
| Free Hit | 1 | 1 | 2 |
| Triple Captain | 1 | 1 | 2 |
| Bench Boost | 1 | 1 | 2 |

**Critical rule**: Set 1 chips EXPIRE after GW19. Cannot be used in GW20+.

#### 1.7.2 Wildcard Rules

| Rule | Details |
|------|---------|
| Effect | Unlimited free transfers for one gameweek |
| Hits | No point deductions regardless of transfer count |
| Transfer rollover | Resets to 1 FT after wildcard week |
| Team value | Buy at current price, sell at selling price |
| Activation | Must be activated before deadline |
| Cancellation | Cannot cancel once deadline passes |

```
IF wildcard_active:
    transfer_cost = 0  # No matter how many transfers
    next_week_FT = 1   # Resets to 1
```

**Wildcard edge cases**:
- Make 15 transfers on wildcard → 0 point hit ✅
- Activate wildcard, make 0 transfers → Wildcard still consumed ✅
- Activate wildcard, deadline passes → Cannot deactivate ✅

#### 1.7.3 Free Hit Rules

| Rule | Details |
|------|---------|
| Effect | Unlimited transfers for ONE gameweek only |
| Reversion | Team reverts to pre-Free Hit squad after gameweek |
| Budget | Use current team value + bank for Free Hit team |
| Transfer rollover | FT count preserved (not reset) |
| Team value | Does NOT affect team value (temporary team) |

```
IF free_hit_active:
    transfer_cost = 0
    # After gameweek ends:
    team = pre_free_hit_team
    bank = pre_free_hit_bank
    FT = pre_free_hit_FT  # Preserved, not reset
```

**Free Hit edge cases**:
- Team value £105m, bank £1m → Can spend £106m on Free Hit team ✅
- Player prices change during Free Hit week → Your original team unaffected ✅
- Free Hit team can exceed 3-player-per-team if original team did? → No, rules still apply ❌

#### 1.7.4 Triple Captain Rules

| Rule | Details |
|------|---------|
| Effect | Captain scores ×3 instead of ×2 |
| Vice-captain | If captain plays 0 mins, VC gets ×3 |
| Stacking | Cannot use with Bench Boost (only one chip per GW) |

```
IF triple_captain_active:
    captain_multiplier = 3  # Instead of 2
```

#### 1.7.5 Bench Boost Rules

| Rule | Details |
|------|---------|
| Effect | All 15 squad players' points count |
| Bench points | Added to gameweek total |
| Auto-subs | Still occur if starter doesn't play |
| Captain | Still counts (×2 or ×3 if TC also active) |

```
IF bench_boost_active:
    total_points = sum(all_15_players.points)
    # Auto-subs still happen for captain/VC purposes
```

**Bench Boost edge cases**:
- Bench player plays 0 minutes → Gets 0 points (no sub for bench) ✅
- Starter plays 0 mins, bench player comes in via auto-sub → Both counted anyway with BB ✅

#### 1.7.6 Chip Restrictions

| Rule | Details |
|------|---------|
| One chip per gameweek | Cannot use TC + BB together |
| Wildcard + other chip | CAN use wildcard + BB/TC/FH same week |
| Free Hit + other chip | CAN use Free Hit + BB/TC same week |

**Wait, clarification needed**:
- Wildcard is a "planning" chip, can combine with "points" chips
- Actually in FPL: Only ONE chip per gameweek. Period.

```
VALIDATION: chips_used_this_gw <= 1
```

---

### 1.8 Gameweek and Fixture Rules

#### 1.8.1 Standard Gameweek

| Rule | Details |
|------|---------|
| Matches per GW | Usually 10 (each team plays once) |
| Duration | Typically Sat-Mon |
| Points finalization | After last match completes + BPS calculation |

#### 1.8.2 Blank Gameweek (BGW)

| Rule | Details |
|------|---------|
| Definition | Some teams don't play (FA Cup, rescheduling) |
| Player points | Players from non-playing teams score 0 |
| Auto-subs | Still apply if starter's team has no fixture |

**BGW impact**:
- If your player's team doesn't play → 0 points
- They can still be auto-subbed out if bench player's team plays

#### 1.8.3 Double Gameweek (DGW)

| Rule | Details |
|------|---------|
| Definition | Some teams play twice in one GW |
| Player points | Sum of both matches |
| Captain | Doubled/tripled across BOTH matches |
| Clean sheets | Evaluated per match |

```
DGW_player_points = match_1_points + match_2_points
IF captain:
    DGW_captain_points = (match_1_points + match_2_points) × 2
```

**DGW edge cases**:
- Player plays 45 mins in match 1, 45 mins in match 2 → Gets 1+1 = 2 appearance points
- Player plays 60 mins in match 1 only → Gets 2 appearance points (from match 1)
- Clean sheet in match 1, concedes 3 in match 2 → Gets 4 - 1 = 3 from those

---

### 1.9 Price Change Rules

#### 1.9.1 Price Change Mechanics

| Rule | Details |
|------|---------|
| Timing | Overnight (approximately 2:30 AM UK) |
| Maximum change | ±£0.3m per gameweek |
| Trigger | Net transfer activity (in - out) |
| Algorithm | Proprietary (not published) |
| Threshold | ~10,000+ net transfers typically needed |

#### 1.9.2 Price Change Limits

| Rule | Details |
|------|---------|
| Daily max rise | £0.1m |
| Daily max fall | £0.1m (can be £0.2m-£0.3m in extreme cases) |
| Weekly max rise | £0.3m |
| Weekly max fall | £0.3m |
| Season floor | Price cannot fall below £0.1m below starting price? (unconfirmed) |

#### 1.9.3 Price Lock Periods

| Period | Price Changes |
|--------|---------------|
| Before GW1 | No changes |
| During GW (Sat-Mon) | Changes continue |
| After season ends | No changes |

---

### 1.10 League Rules

#### 1.10.1 Classic League Scoring

| Rule | Details |
|------|---------|
| Points | Cumulative gameweek points |
| Ranking | Total points (higher = better) |
| Tiebreaker | Total goals scored by players |

#### 1.10.2 Head-to-Head League

| Rule | Details |
|------|---------|
| Format | Weekly matchups against league members |
| Win | 3 league points |
| Draw | 1 league point each |
| Loss | 0 league points |
| Tiebreaker | Total FPL points scored |

---

### 1.11 Player Status Flags

| Flag | Meaning | Recommendation |
|------|---------|----------------|
| None | Fully fit | Safe to select |
| Yellow (75%) | Minor doubt | Monitor news |
| Orange (50%) | Significant doubt | Consider bench |
| Orange (25%) | Major doubt | Avoid starting |
| Red (0%) | Unavailable | Do not select |

**Note**: These percentages are estimates. Always check press conferences.

---

## 2. Problem Statement

### 2.1 Challenges FPL Managers Face

1. **Information Overload**: 500+ players, countless statistics, multiple data sources
2. **Time Constraints**: Analyzing fixtures, form, and injuries is time-consuming
3. **Cognitive Biases**: Recency bias, confirmation bias, and emotional decisions
4. **Complex Optimization**: Budget constraints, fixture planning, chip timing
5. **Competitive Pressure**: Mini-league rivals, overall rank targets

### 2.2 Market Gap

Existing tools (Fantasy Football Scout, Fantasy Football Hub, Fantasy Football Fix) provide:
- Raw statistics and data
- Basic recommendations
- Fixture difficulty ratings

**They lack**:
- Personalized optimization based on your specific team and rivals
- AI-powered predictive models with confidence intervals
- Integrated chip strategy planning
- Real-time price change alerts with action recommendations
- Mini-league differential analysis

---

## 3. Target Users

### 3.1 Primary Persona: "Competitive Chris"

- Plays FPL seriously, aims for top 100k overall
- Participates in multiple mini-leagues with friends/colleagues
- Spends 2-4 hours per week on FPL decisions
- Willing to pay for premium features that save time and improve results

### 3.2 Secondary Persona: "Data-Driven Dana"

- Loves statistics and analytics
- Wants to understand *why* certain players are recommended
- Interested in underlying metrics (xG, xA, ICT)
- May build custom models or exports

### 3.3 Tertiary Persona: "Casual Carl"

- Plays for fun with friends
- Wants quick, simple recommendations
- Limited time for research
- Prefers "set and forget" suggestions

---

## 4. Core Features

### 4.1 Dashboard (MVP)

**Purpose**: Single view of your FPL status and key actions needed

- Current team value and bank
- Gameweek points (live/projected)
- Next deadline countdown
- Quick action alerts (price rises/falls, injury news)
- Mini-league standings snapshot

### 4.2 Team Analyzer

**Purpose**: Deep analysis of your current squad

Features:
- Player-by-player rating with confidence score
- Fixture difficulty for next 5 gameweeks (color-coded)
- Expected points projection (with ranges)
- Ownership percentages vs mini-league rivals
- Identified weaknesses and recommended improvements
- Team structure analysis (balance across positions)

### 4.3 Transfer Recommender (Core Feature)

**Purpose**: AI-powered transfer suggestions

Features:
- **Best single transfer**: Highest expected point gain
- **Best 2-3 transfer combinations**: For accumulated free transfers
- **Differential picks**: Low-ownership players with high upside
- **Template avoidance**: Options to deviate from "template" teams
- **Budget optimization**: Best value picks at each price point
- Each recommendation includes:
  - Player comparison metrics
  - Fixture analysis
  - Form indicators
  - Price change likelihood
  - Injury/rotation risk

### 4.4 Captain Selector

**Purpose**: Optimize the most important weekly decision (~30% of season points)

Features:
- Ranked captain options with expected points
- Historical performance vs upcoming opponent
- Home/away splits
- Set-piece involvement indicators
- "Safe" vs "Differential" captain recommendations
- Vice-captain optimization

#### Advanced Captaincy Analysis

**Ownership-Adjusted Captaincy**:
- Mini-league captain EO (Effective Ownership) - not overall ownership
- "Parity vs Swing" indicator: captaining 80% owned Haaland maintains position; differential captain creates movement
- Captain EO breakeven calculator: "Salah needs X points to justify over Haaland given ownership"

**Fixture Intelligence**:
- Fixture stacking analysis: newly promoted sides, defensive injuries, historically leaky defenses
- "Big game" performance tracking: some players over/underperform in favorable fixtures
- Team defensive form vs player historical output

**Penalty Certainty Tracking**:
- Confirmed penalty taker status (penalties = 0.76 xG)
- Penalty order hierarchy when primary taker is absent
- Recent penalty wins by team

### 4.5 Set-Piece Intelligence

**Purpose**: Identify hidden value from dead-ball situations (~30% of PL goals)

**Set-Piece Role Tracking**:
| Role | Points Impact | Data Source |
|------|---------------|-------------|
| Penalty taker | High (0.76 xG per pen) | FBref, manual tracking |
| Direct free kick taker | Medium | FBref, Opta |
| Corner taker (inswing/outswing) | Low-Medium | FBref |
| Indirect FK taker | Low | Manual tracking |
| Target man (headers from set pieces) | Medium | Opta |

**Player Set-Piece Profile**:
```
┌─────────────────────────────────────────────────┐
│ Cole Palmer - Set Piece Profile                 │
├─────────────────────────────────────────────────┤
│ Penalties: PRIMARY (100% of Chelsea pens)       │
│ Direct FKs: PRIMARY (82% of attempts)           │
│ Corners: SECONDARY (right-side only)            │
│                                                 │
│ Set-Piece xG: 0.31/90 (42% of total xG)        │
│ Set-Piece xA: 0.18/90 (38% of total xA)        │
│                                                 │
│ ⚠️ Without set pieces, xGI drops from 0.82 to 0.47
└─────────────────────────────────────────────────┘
```

**Team Set-Piece Quality**:
- Rank teams by set-piece xG created and conceded
- Identify undervalued defenders on high set-piece teams
- Flag "set-piece merchants" - players whose value depends on dead balls

**Set-Piece Vulnerability Analysis**:
- Teams that concede most from corners/free kicks
- Target defenders/forwards playing against vulnerable teams

### 4.6 Fixture Planner

**Purpose**: Long-term planning and transfer strategy

Features:
- Interactive fixture difficulty calendar (FDR)
- Custom difficulty ratings (user can adjust)
- Team rotation patterns identification
- Double/Blank Gameweek tracker and predictor
- Best teams to target for next N gameweeks
- Fixture swing alerts

### 4.7 Chip Strategy Advisor

**Purpose**: Optimize chip usage throughout the season with game-theory awareness

Features:
- Recommended chip timing based on fixtures
- Double Gameweek chip calculator
- Wildcard + Bench Boost combination planner
- Chip usage simulation (what-if scenarios)
- Second-half season chip refresh reminders
- Personalized chip pathway recommendations

#### Game Theory: Chip Timing vs Rivals

**Mini-League Chip Tracker**:
- Track which chips each rival has remaining
- Identify when rivals are likely to use chips (fixture analysis)
- Alert when rivals use chips (requires monitoring their teams)

**Strategic Chip Scenarios**:
- **"Chip Chicken"**: When protecting a lead, using your chip early on a moderate DGW may force rivals into suboptimal usage
- **Defensive Chip Usage**: Match rival chip timing to neutralize their advantage
- **Aggressive Chip Usage**: Use chips when rivals can't respond (e.g., they've already used theirs)

**Position-Based Chip Strategy**:
| League Position | Recommended Approach |
|-----------------|---------------------|
| Leading by 50+ pts | Defensive - mirror rival chip timing |
| Leading by <50 pts | Moderate - slight risk on chip timing |
| Within 30 pts of leader | Balanced - optimize for absolute points |
| Chasing (50+ behind) | Aggressive - differentiate chip timing from leader |

**Chip Combination Planning**:
- Wildcard → Bench Boost pathway (build 15-player squad for DGW)
- Free Hit for BGWs to preserve team structure
- Triple Captain on premium asset DGWs with favorable fixtures

### 4.8 Price Change Predictor

**Purpose**: Buy low, sell high - but strategically

Features:
- Real-time transfer activity monitoring
- Price rise/fall probability percentages
- Alerts for imminent price changes
- Recommended actions based on your team
- Historical accuracy tracking

#### Advanced Price Strategy

**Team Value vs Flexibility Tradeoff**:
```
High Team Value (£105m+):
- Pros: Access to premium players, flexibility
- Cons: Value locked in players you might not want

Liquid Funds (£2m+ ITB):
- Pros: Can react to injuries, form changes
- Cons: Money not working for you in points
```

**"Dead Money" Identification**:
- Players you bought at £7.0m now worth £6.5m = £0.5m dead money
- Calculate: "If you sold X, you'd lose £Y in value"
- Recommend: Hold losers if still good picks, sell if not

**Early Transfer vs Wait Decision**:
```
┌─────────────────────────────────────────────────┐
│ Transfer Timing Decision: Saka                  │
├─────────────────────────────────────────────────┤
│ Price rise probability tonight: 94%             │
│ Price if you wait: +£0.1m cost                  │
│                                                 │
│ Injury news expected: Press conf Friday         │
│ Value of waiting for news: ~5% chance of issue  │
│                                                 │
│ Recommendation: TRANSFER NOW                    │
│ Reasoning: 94% × £0.1m > 5% × wasted transfer   │
└─────────────────────────────────────────────────┘
```

**Price Rise Chasing Warning**:
- Flag "bandwagon" transfers that are price-driven, not performance-driven
- Show: "This player has risen £0.4m but xGI hasn't changed"
- Identify sustainable vs unsustainable price rises

### 4.9 Mini-League Analyzer

**Purpose**: Beat your friends and rivals (opponent-aware optimization)

**Key Insight**: In a mini-league, you're not trying to score the most points—you're trying to score more than specific rivals.

Features:
- Rival team comparison
- Differential player identification
- "What they have that you don't" analysis
- Points swing scenarios
- Optimal strategy based on league position
- Effective ownership calculations

#### Mini-League Effective Ownership (ML-EO)

**Why ML-EO Matters**:
- Global ownership is irrelevant; only your mini-league matters
- A 40% globally owned player with 0% mini-league ownership is a 100% differential for you
- Player points only help you if rivals don't also have them

**ML-EO Calculations**:
```
ML_EO = Σ(Rival_Owns_Player × Rival_Weight) / Σ(Rival_Weight)

Where:
- Rival_Weight = Based on proximity in standings (closer rivals weighted higher)
- Captain_EO = ML_EO × 2 for captained players
```

**ML-EO Dashboard**:
| Player | Global EO | Your ML-EO | Status |
|--------|-----------|------------|--------|
| Haaland | 85% | 90% | Parity player |
| Salah | 45% | 20% | Differential for you |
| Palmer | 50% | 80% | Risk - you don't own |

**EO Breakeven Calculator**:
- "How many points does your differential need to outscore the template pick?"
- Factors in: ownership difference, captain rates, points projection

#### Rival-Specific Recommendations

**Direct Rival Targeting**:
- Identify your 2-3 closest rivals by points
- Show exact team differences
- Calculate "swing scenarios" - what happens if Player X scores big?

**Strategic Moves**:
- "Cover" recommendations: players to match rivals and neutralize their advantage
- "Attack" recommendations: differentials to gain ground
- Risk/reward analysis for each move relative to specific rivals

### 4.10 Template Deviation Advisor

**Purpose**: Determine when to follow vs deviate from the "template" team

The "template" is the consensus team structure used by top managers. Deviating carries risk but is necessary to gain ground in mini-leagues.

**Template Analysis**:
- Identify current template players (high ownership among top 10k managers)
- Calculate your template alignment percentage
- Show which template players you're missing and their impact

**Deviation Scoring System**:
```
Deviation_Value = (Differential_xPts - Template_xPts) × Ownership_Swing_Factor

Where:
- Differential_xPts = Expected points of non-template pick
- Template_xPts = Expected points of template player
- Ownership_Swing_Factor = Based on mini-league ownership differential
```

**Position-Based Strategy Recommendations**:
| Mini-League Position | Strategy | Template Alignment |
|---------------------|----------|-------------------|
| Leading comfortably | Match template, minimize variance | 80-90% |
| Leading narrowly | Selective deviation on high-conviction picks | 70-80% |
| Mid-table | Balance - template core with 2-3 differentials | 60-70% |
| Chasing | Maximize variance, embrace differentials | 40-60% |
| Far behind | High-risk differentials, punt on low-owned players | 30-50% |

**Variance Control**:
- "Safe floor" recommendations: high-floor template players
- "Ceiling chasers": volatile differentials for when you need big swings
- Weekly variance budget based on league position

### 4.11 Live Gameweek Tracker

**Purpose**: Follow your team's performance in real-time

Features:
- Live points calculation
- Bonus point projections (BPS)
- Auto-sub scenarios
- Rank movement tracking
- Rival score comparison
- Red zone alerts (players at risk of negative points)

### 4.12 Historical Analysis & Learning

**Purpose**: Learn from the past

Features:
- Season review and insights
- "What if" historical scenarios
- Model performance tracking
- Personal decision audit trail

### 4.13 End-Game Strategy Advisor

**Purpose**: Optimize the final 5-10 gameweeks when strategy fundamentally changes

The end of season requires completely different strategy than mid-season. This feature provides specialized guidance for the run-in.

#### Overall Rank Scenarios (GW30+)

**"Points Needed" Calculator**:
```
Based on historical data, calculate weekly averages needed to hit targets:

Current: 1,850 pts | Rank: 45,000 | GW: 32
┌─────────────────────────────────────────────────┐
│ Target          │ Points Needed │ Avg/GW (6 left)│
├─────────────────────────────────────────────────┤
│ Top 10k         │ 2,180         │ 55.0/GW       │
│ Top 50k (hold)  │ 2,050         │ 33.3/GW       │
│ Top 100k        │ 1,980         │ 21.7/GW       │
└─────────────────────────────────────────────────┘
Recommendation: Top 10k unlikely. Focus on defending top 50k.
```

**Rank-Dependent Chip Usage**:
| Your Rank | Chip Strategy |
|-----------|---------------|
| Top 10k | Optimize for ceiling - aggressive TC timing |
| 10k-50k | Balance - solid BB/TC choices |
| 50k-100k | Match the field - don't get left behind |
| 100k+ | High variance - differentiate chip timing |

#### Mini-League End-Game (Final 5 GWs)

**Points Gap Analysis**:
```
You: 1,847 | Leader: 1,892 | Gap: -45 points

With 5 GWs left, scenarios to close the gap:
┌─────────────────────────────────────────────────┐
│ Scenario                    │ Probability      │
├─────────────────────────────────────────────────┤
│ Match template, hope leader│                   │
│ makes mistakes              │ 15%              │
│                             │                   │
│ 2-3 differential picks      │ 25%              │
│                             │                   │
│ Full differential strategy  │ 35%              │
│ (higher variance)           │                   │
└─────────────────────────────────────────────────┘
Recommendation: Go differential - nothing to lose.
```

**"Protecting a Lead" Mode**:
- Identify which template players your chasers DON'T have
- Recommend: "Match their differentials to neutralize"
- Calculate: "If you both have Haaland, his points don't matter"
- Risk assessment: "Taking a -8 hit when leading is rarely wise"

**Final GW Chip Strategy**:
- GW38: Free Hit often optimal (fixture uncertainty, nothing to save for)
- TC on confirmed starters with DGW or elite fixture
- BB only if you've built for it

#### Simulation Engine

**Monte Carlo Season Finish**:
- Run 10,000 simulations of remaining gameweeks
- Show probability distributions of final rank/position
- Factor in: your team, rival teams, chips remaining, fixtures

**"What Needs to Happen" Scenarios**:
- "For you to win your mini-league, X needs to happen"
- Identify key fixtures/players that determine outcomes
- Suggest: "Root for Team A vs Team B because..."

### 4.14 Historical Season Analyzer & Backtesting Engine

**Purpose**: Learn from past seasons to validate the system and discover winning strategies

This feature serves two critical functions:
1. **System Validation**: Backtest our recommendations against historical data
2. **Strategy Discovery**: Identify patterns that separate winners from losers

---

#### 4.14.1 Historical Data Repository

**Seasons Available**: 2016/17 onwards (FPL API historical data)

**Data Captured Per Season**:
| Data Type | Source | Granularity |
|-----------|--------|-------------|
| All player gameweek scores | FPL API archive | Per GW |
| Player prices throughout season | FPL API archive | Daily |
| Fixture results & stats | FPL API archive | Per match |
| Top 10k manager teams | Scraped/archived | Per GW |
| Chip usage patterns | Calculated | Per GW |
| Transfer trends | Archived | Daily |
| xG/xA data | Understat archive | Per match |

**Elite Manager Archive**:
- Store top 1k/10k/100k teams from each historical season
- Track their decisions: transfers, captains, chips, bench
- Build "what the best managers did" database

---

#### 4.14.2 Backtesting Framework

**Purpose**: Validate every recommendation algorithm against historical reality

**Backtest Types**:

```
┌─────────────────────────────────────────────────────────────┐
│ BACKTEST DASHBOARD                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Captain Selector Backtest (2023/24)                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Our #1 captain pick vs actual best captain:            │ │
│ │                                                         │ │
│ │ Correct (was best):     12/38 GWs (31.6%)              │ │
│ │ Top 3 scorer:           24/38 GWs (63.2%)              │ │
│ │ Outperformed average:   29/38 GWs (76.3%)              │ │
│ │                                                         │ │
│ │ Points if followed our picks:    2,847                 │ │
│ │ Points with perfect captaincy:   3,124                 │ │
│ │ Points with average captaincy:   2,651                 │ │
│ │                                                         │ │
│ │ Value added: +196 points vs average                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Transfer Recommender Backtest (2023/24)                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Recommended transfer outperformed kept player:         │ │
│ │ 1-week horizon:  58.2%                                 │ │
│ │ 4-week horizon:  61.4%                                 │ │
│ │ 8-week horizon:  64.1%                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Algorithm Validation Process**:
```python
def backtest_algorithm(algorithm, seasons=['2021/22', '2022/23', '2023/24']):
    results = []

    for season in seasons:
        for gameweek in range(1, 39):
            # Get data available AT THAT TIME (no future leakage)
            historical_state = get_state_at_gw(season, gameweek)

            # Run algorithm with only past data
            recommendation = algorithm.predict(historical_state)

            # Compare to actual outcomes
            actual_outcome = get_actual_outcome(season, gameweek)

            results.append({
                'season': season,
                'gw': gameweek,
                'recommended': recommendation,
                'actual_best': actual_outcome,
                'points_gained': calculate_gain(recommendation, actual_outcome)
            })

    return BacktestReport(results)
```

**Critical Rule**: No future data leakage - algorithms only see data available at decision time

---

#### 4.14.3 Strategy Pattern Discovery

**Purpose**: What do winning managers do differently?

**Analysis: Top 1k vs Average Manager**

```
┌─────────────────────────────────────────────────────────────┐
│ WINNING PATTERNS: Top 1k vs Average (2023/24 Season)       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ TRANSFER BEHAVIOR                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                          Top 1k    Average   Delta     │ │
│ │ Total transfers made:     42.3      51.7    -9.4      │ │
│ │ Hits taken:               6.2       8.9     -2.7      │ │
│ │ Transfers before price rise: 68%    52%     +16%      │ │
│ │ Knee-jerk transfers:      8%        24%     -16%      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ CAPTAIN CHOICES                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                          Top 1k    Average   Delta     │ │
│ │ Unique captains used:     8.2       6.1     +2.1      │ │
│ │ Differential captains:    12%       5%      +7%       │ │
│ │ Captain in top 3 scorers: 71%       58%     +13%      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ CHIP TIMING                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Chip              Top 1k Avg GW   Optimal GW   Diff    │ │
│ │ Wildcard 1:       GW8.2           GW8          +0.2    │ │
│ │ Bench Boost:      GW34.1          GW34 (DGW)   +0.1    │ │
│ │ Triple Captain:   GW29.3          GW29 (DGW)   +0.3    │ │
│ │ Free Hit:         GW32.8          BGW          ✓       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ KEY INSIGHT: Top managers make FEWER transfers but         │
│ time them better. They're more patient and less reactive.  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Mistake Pattern Analysis**:

```
┌─────────────────────────────────────────────────────────────┐
│ COMMON MISTAKES (Correlated with poor finish)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. EARLY WILDCARD (before GW6)                             │
│    Correlation with finish: -0.23                          │
│    Why: Not enough data, teams still settling              │
│                                                             │
│ 2. CHASING LAST WEEK'S POINTS                              │
│    Transferring in player who just hauled: -0.18           │
│    Why: Regression to mean, price already risen            │
│                                                             │
│ 3. IGNORING FIXTURE SWINGS                                 │
│    Not transferring at fixture turns: -0.21                │
│    Why: Missing easy points from fixture runs              │
│                                                             │
│ 4. BENCH BOOST ON SINGLE GW                                │
│    Using BB outside DGW: -0.31                             │
│    Why: Wasting chip on 4-6 points instead of 15-20        │
│                                                             │
│ 5. HOLDING INJURED PLAYERS TOO LONG                        │
│    Keeping flagged player >2 GWs: -0.15                    │
│    Why: Opportunity cost of points from replacement        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

#### 4.14.4 Season Replay Mode

**Purpose**: Replay any historical season to test strategies

```
┌─────────────────────────────────────────────────────────────┐
│ SEASON REPLAY: 2023/24                                      │
├─────────────────────────────────────────────────────────────┤
│ Currently viewing: Gameweek 15                              │
│ [◀ GW14] [▶ GW16] [Jump to GW: ___]                        │
│                                                             │
│ YOUR SIMULATED TEAM          DECISION POINT                │
│ ┌─────────────────────┐     ┌─────────────────────────────┐│
│ │ Raya                │     │ What would you do?          ││
│ │ TAA  Saliba  Gabriel│     │                             ││
│ │ Saka  Palmer  Foden │     │ Available FT: 2             ││
│ │ Haaland  Watkins    │     │ Budget: £1.3m               ││
│ │                     │     │                             ││
│ │ Points so far: 847  │     │ [ ] Make transfer           ││
│ │ Rank: 156,234       │     │ [ ] Use Wildcard            ││
│ └─────────────────────┘     │ [ ] Bank transfer           ││
│                              │                             ││
│ WHAT ACTUALLY HAPPENED:      │ Hindsight info (hidden):    ││
│ [Show] [Hide]                │ [Reveal after decision]     ││
│                              └─────────────────────────────┘│
│                                                             │
│ COMPARE YOUR DECISIONS TO:                                  │
│ ○ What you actually did (if imported)                      │
│ ○ What top 1k managers did                                 │
│ ○ What our algorithm recommended                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Learning Mode Features**:
- Hide future outcomes until decision made
- Compare your choice to optimal hindsight
- Track cumulative "what if" score
- Identify decision patterns: "You tend to hold too long"

---

#### 4.14.5 Personal Season Audit

**Purpose**: Analyze your own historical seasons

**Import Your History**:
- Connect FPL account to import all past seasons
- Or manually enter FPL ID to fetch public history

```
┌─────────────────────────────────────────────────────────────┐
│ YOUR SEASON AUDIT: 2023/24                                  │
├─────────────────────────────────────────────────────────────┤
│ Final Rank: 89,247 | Points: 2,341 | Value: £103.2m        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ POINTS LEFT ON TABLE                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Category                    Points Lost    Fixable?    │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ Suboptimal captains:        -87 pts        Yes         │ │
│ │ Bad transfers (hindsight):  -124 pts       Partially   │ │
│ │ Mistimed chips:             -34 pts        Yes         │ │
│ │ Wrong bench order:          -18 pts        Yes         │ │
│ │ Held injured players:       -41 pts        Yes         │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │ TOTAL RECOVERABLE:          ~200 pts                   │ │
│ │ Potential rank with fixes:  ~25,000                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ YOUR BIGGEST MISTAKES                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. GW22: Sold Salah before 18-pt haul (-14 pts swing)  │ │
│ │ 2. GW29: Captained Haaland (2) over Palmer (15) (-13)  │ │
│ │ 3. GW8: Used WC too early, team value suffered (-45)   │ │
│ │ 4. GW34: BB on SGW instead of DGW35 (-12 pts)          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ YOUR BEST DECISIONS                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1. GW12: Early Palmer transfer before £1.2m rise       │ │
│ │ 2. GW28: TC Haaland in DGW (24 pts × 3 = 72)           │ │
│ │ 3. GW3-8: Patient with Haaland despite blanks          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ PATTERN ANALYSIS                                            │
│ "You make good long-term holds but panic-sell after blanks"│
│ "Your chip timing is good but captain choices are average" │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

#### 4.14.6 Model Training & Validation Split

**Purpose**: Ensure our ML models are trained properly

**Data Split Strategy**:
```
Training Data:    2016/17 - 2021/22 (6 seasons)
Validation Data:  2022/23 (1 season)
Test Data:        2023/24 (1 season)
Current Season:   2024/25 (live predictions)

CRITICAL: Never train on test data. Ever.
```

**Walk-Forward Validation**:
```
For each gameweek in test season:
  1. Train model on all data BEFORE that gameweek
  2. Make predictions for that gameweek
  3. Record predictions vs actuals
  4. Move to next gameweek

This simulates real-world usage where we only have past data.
```

**Model Performance Dashboard**:
```
┌─────────────────────────────────────────────────────────────┐
│ MODEL PERFORMANCE TRACKER                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Point Prediction Model v2.3                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Metric              Train    Validation  Test (live)   │ │
│ │ MAE:                1.82     1.94        2.01          │ │
│ │ RMSE:               2.41     2.58        2.67          │ │
│ │ R²:                 0.42     0.38        0.35          │ │
│ │                                                         │ │
│ │ Status: ✓ Acceptable (test within 10% of validation)   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Drift Detection:                                           │
│ Current season MAE trending: 2.01 → 2.08 (⚠️ +3.5%)       │
│ Action: Consider retraining with recent data               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

#### 4.14.7 Historical Data API

**Purpose**: Allow power users to query historical data

```python
# Example API endpoints for historical analysis

GET /api/historical/seasons
# Returns: List of available seasons

GET /api/historical/season/2023-24/gameweek/15
# Returns: Full state at GW15 (players, prices, points, fixtures)

GET /api/historical/player/123/season/2023-24
# Returns: Player's full season data (points, minutes, xG, price changes)

GET /api/historical/top-managers/2023-24?rank_min=1&rank_max=1000
# Returns: Aggregated decisions of top 1k managers

GET /api/historical/backtest/captain-algo?seasons=2022-23,2023-24
# Returns: Backtest results for captain algorithm

POST /api/historical/simulate
{
  "season": "2023-24",
  "starting_team": [...],
  "strategy": "follow_recommendations"
}
# Returns: Simulated season outcome following our recommendations
```

---

## 5. Data Sources & API Integration

### 5.1 Official FPL API Endpoints

| Endpoint | Data | Update Frequency |
|----------|------|------------------|
| `/bootstrap-static/` | All players, teams, gameweeks, game settings | Every few hours |
| `/element-summary/{id}/` | Individual player history and fixtures | On demand |
| `/fixtures/` | Match schedule and results | After each match |
| `/entry/{id}/` | Manager info, history, leagues | On demand |
| `/entry/{id}/event/{gw}/picks/` | Manager's team for specific GW | After deadline |
| `/event/{gw}/live/` | Live gameweek data | During matches |

**API Limitations**:
- CORS policy prevents direct frontend calls
- Rate limiting (be respectful)
- Brief unavailability after deadlines
- No official documentation (reverse-engineered)

### 5.2 Third-Party Data Sources

| Source | Data | Access Method |
|--------|------|---------------|
| **Understat** | xG, xA, shot maps | Web scraping |
| **FBref** | Advanced statistics | Web scraping |
| **Opta** (via providers) | Detailed match events | Partnership/API |
| **Transfermarkt** | Player values, injuries | Web scraping |
| **Twitter/X** | Team news, injury updates | API |
| **Official Club Sources** | Injury updates, press conferences | RSS/Scraping |

### 5.3 Data Availability for Strategic Features

**Critical Assessment**: Can we actually get the data for these features?

| Feature | Data Needed | Source | Available? | Notes |
|---------|-------------|--------|------------|-------|
| **Mini-League EO** | Rival team compositions | `/entry/{id}/event/{gw}/picks/` | **Yes** | Public via entry ID |
| **Rival Chip Tracking** | Chips used per GW | `/entry/{id}/history/` | **Yes** | Shows chip usage history |
| **Captain Choices** | Who rivals captained | `/entry/{id}/event/{gw}/picks/` | **Yes** | Includes captain flag |
| **League Standings** | Points, rank | `/leagues-classic/{id}/standings/` | **Yes** | Paginated |
| **Set-Piece Takers** | Who takes what | FBref, manual tracking | **Partial** | Requires scraping + curation |
| **Minutes Probability** | Historical patterns | FPL API + calculated | **Yes** | Need to build model |
| **Template Players** | Top 10k ownership | Calculated from bootstrap | **Yes** | Need sampling approach |

**API Call Considerations**:
```
Mini-league with 20 rivals:
- Initial sync: 20 calls to /entry/{id}/ + 20 calls to /entry/{id}/history/
- Weekly update: 20 calls to /entry/{id}/event/{gw}/picks/
- Total: ~60 calls per sync

Rate limiting strategy:
- Cache aggressively (rival teams don't change until deadline)
- Background job updates (not real-time)
- Batch calls with delays (respect the API)
```

**Data We Cannot Get Directly**:
| Data | Workaround |
|------|------------|
| Mini-league specific ownership % | Calculate from fetched rival teams |
| Real-time transfer activity | Use third-party sites (FPL Statistics, LiveFPL) |
| Set-piece assignments | Manual curation + FBref scraping |
| Press conference quotes | RSS feeds, Twitter API |

### 5.4 Historical Data Sources (For Backtesting)

**Critical for**: Model validation, strategy discovery, season replay

| Data Type | Source | Availability | Notes |
|-----------|--------|--------------|-------|
| **Player GW scores (2016+)** | [vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League) | **Excellent** | Community-maintained, updated daily |
| **Player prices history** | Same GitHub repo | **Excellent** | Daily snapshots |
| **Fixture results** | FPL API + GitHub | **Excellent** | Complete history |
| **Top manager teams** | Needs scraping/archiving | **Partial** | We need to build this archive |
| **Historical xG/xA** | Understat archive | **Good** | Available back to 2014/15 |
| **Transfer trends** | FPL Statistics archive | **Partial** | Some historical data available |

**Key Historical Data Repository**:
```
https://github.com/vaastav/Fantasy-Premier-League

Structure:
/data/2023-24/
  /gws/
    gw1.csv, gw2.csv, ... gw38.csv  (player scores per GW)
  /players/
    player_123.csv  (individual player season history)
  /teams/
    team_1.csv  (team-level stats)
  cleaned_players.csv  (full season summary)
  fixtures.csv
```

**Data Collection Strategy for Missing Historical Data**:
```
Top Manager Archive (build ourselves):
1. At season end, scrape top 10k manager IDs
2. For each: fetch /entry/{id}/history/ and all GW picks
3. Store in our database for backtesting
4. Repeat each season to build multi-year archive

Cost: ~100k API calls per season (one-time, end of season)
Value: Enables "what did winners do" analysis
```

**Historical Data Schema**:
```sql
-- Historical player gameweek data
CREATE TABLE historical_player_gw (
  season VARCHAR(10),
  gameweek INTEGER,
  player_id INTEGER,
  points INTEGER,
  minutes INTEGER,
  goals INTEGER,
  assists INTEGER,
  clean_sheets INTEGER,
  bonus INTEGER,
  price DECIMAL(4,1),
  selected_by DECIMAL(5,2),
  transfers_in INTEGER,
  transfers_out INTEGER,
  xg DECIMAL(4,2),
  xa DECIMAL(4,2),
  PRIMARY KEY (season, gameweek, player_id)
);

-- Historical top manager decisions
CREATE TABLE historical_top_manager_gw (
  season VARCHAR(10),
  gameweek INTEGER,
  manager_rank INTEGER,  -- final season rank
  manager_id INTEGER,
  team JSONB,  -- 15 player IDs
  captain_id INTEGER,
  chip_used VARCHAR(20),
  transfers_made INTEGER,
  hits_taken INTEGER,
  points_scored INTEGER,
  PRIMARY KEY (season, gameweek, manager_id)
);
```

### 5.5 Data Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Data Collection Layer                    │
├─────────────────┬─────────────────┬─────────────────────────┤
│   FPL API       │  Third-Party    │   Real-time Feeds       │
│   (Scheduled)   │  (Daily)        │   (Continuous)          │
└────────┬────────┴────────┬────────┴────────────┬────────────┘
         │                 │                      │
         ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Processing Layer                     │
│  - Normalization    - Cleaning    - Enrichment              │
│  - Aggregation      - Validation  - Feature Engineering     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Storage Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  PostgreSQL  │  │    Redis     │  │   S3/Blob    │       │
│  │  (Primary)   │  │   (Cache)    │  │  (Historical)│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Technical Architecture

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Web App       │  │   Mobile App    │  │   Browser Ext   │  │
│  │   (React/Next)  │  │   (React Native)│  │   (Chrome)      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│               (Authentication, Rate Limiting, Routing)           │
└────────────────────────────────┬────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│  Core API       │  │  Analytics      │  │  Notification       │
│  Service        │  │  Service        │  │  Service            │
│  (User, Team,   │  │  (ML Models,    │  │  (Email, Push,      │
│   Leagues)      │  │   Predictions)  │  │   Webhooks)         │
└─────────────────┘  └─────────────────┘  └─────────────────────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ PostgreSQL  │  │   Redis     │  │  ML Model   │              │
│  │             │  │   Cache     │  │  Storage    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Recommended Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 14+ (React) | SSR, API routes, excellent DX |
| **Mobile** | React Native / Expo | Code sharing with web |
| **Backend API** | Node.js (Fastify) or Python (FastAPI) | Fast, type-safe, async |
| **Database** | PostgreSQL | Relational data, JSON support |
| **Cache** | Redis | Session, real-time data |
| **ML/Analytics** | Python (scikit-learn, XGBoost) | Industry standard |
| **Job Queue** | BullMQ / Celery | Background tasks |
| **Hosting** | Vercel (frontend) + Railway/Render (backend) | Easy deployment |
| **Auth** | NextAuth.js / Auth0 | Secure, FPL OAuth support |

### 6.3 Database Schema (Core Tables)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  fpl_team_id INTEGER,
  created_at TIMESTAMP,
  subscription_tier VARCHAR(50)
);

-- Players table (synced from FPL API)
CREATE TABLE players (
  id INTEGER PRIMARY KEY,  -- FPL element ID
  name VARCHAR(255),
  team_id INTEGER,
  position VARCHAR(10),
  price DECIMAL(4,1),
  total_points INTEGER,
  form DECIMAL(3,1),
  selected_by_percent DECIMAL(5,2),
  -- Advanced stats
  xg_per_90 DECIMAL(4,2),
  xa_per_90 DECIMAL(4,2),
  xgi DECIMAL(5,2),
  ict_index DECIMAL(6,1),
  updated_at TIMESTAMP
);

-- Fixtures table
CREATE TABLE fixtures (
  id INTEGER PRIMARY KEY,
  gameweek INTEGER,
  home_team_id INTEGER,
  away_team_id INTEGER,
  kickoff_time TIMESTAMP,
  home_difficulty INTEGER,
  away_difficulty INTEGER,
  finished BOOLEAN
);

-- Predictions table
CREATE TABLE predictions (
  id UUID PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  gameweek INTEGER,
  predicted_points DECIMAL(4,1),
  confidence DECIMAL(3,2),
  model_version VARCHAR(50),
  created_at TIMESTAMP
);

-- User teams snapshot
CREATE TABLE user_teams (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  gameweek INTEGER,
  players JSONB,  -- Array of player IDs with captain/vice info
  created_at TIMESTAMP
);
```

### 6.4 User Authentication and Roles System

> **IMPORTANT**: The system must support multiple users with different roles and permissions.

#### 6.4.1 User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin/Developer** | System administrator (you) | Full access, debug tools, data management |
| **Standard User** | Regular users (your friend) | Full feature access, own data only |
| **Demo User** | Trial/limited access | Read-only, sample data |

#### 6.4.2 Authentication Methods

**Primary: Email + Password**
```
- Email/password registration
- Email verification required
- Password requirements: 8+ chars, 1 uppercase, 1 number
- Password reset via email
```

**Secondary: FPL Account Linking**
```
- OAuth-style flow with FPL (cookie-based, not official OAuth)
- Links FPL Team ID to user account
- Enables automatic team sync
- Optional but recommended
```

**Future: Social Login**
```
- Google OAuth (optional)
- Apple Sign-In (for iOS app)
```

#### 6.4.3 User Database Schema

```sql
-- Extended users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,

  -- Profile
  display_name VARCHAR(100),
  avatar_url VARCHAR(500),

  -- FPL Linking
  fpl_team_id INTEGER UNIQUE,  -- Their FPL team ID
  fpl_team_name VARCHAR(255),
  fpl_linked_at TIMESTAMP,
  fpl_cookies_encrypted TEXT,  -- For authenticated FPL requests

  -- Role and permissions
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'demo')),

  -- Subscription
  subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'elite')),
  subscription_expires_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  login_count INTEGER DEFAULT 0
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Audit log for admin actions
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User preferences
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  primary_mini_league_id INTEGER,  -- Their main mini-league to track
  notification_email BOOLEAN DEFAULT TRUE,
  notification_push BOOLEAN DEFAULT TRUE,
  notification_price_alerts BOOLEAN DEFAULT TRUE,
  notification_deadline_reminder BOOLEAN DEFAULT TRUE,
  deadline_reminder_hours INTEGER DEFAULT 24,
  theme VARCHAR(20) DEFAULT 'system',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 6.4.4 Role-Based Access Control (RBAC)

**Admin Role Capabilities**:
```
✅ View all users and their data
✅ Access debug/diagnostic tools
✅ View system metrics and logs
✅ Manually trigger data sync jobs
✅ View and edit FPL rules engine
✅ Run backtests and view all results
✅ Impersonate users for debugging (with audit log)
✅ Manage subscription tiers
✅ Access raw database queries (read-only in prod)
```

**Standard User Capabilities**:
```
✅ Full access to all features
✅ View/manage own FPL team data
✅ View own mini-league analysis
✅ Make recommendations for own team
✅ Access historical analysis (own account)
❌ Cannot view other users' data
❌ Cannot access admin tools
❌ Cannot modify system settings
```

**Demo User Capabilities**:
```
✅ View sample/demo data
✅ Try recommendation features (with sample team)
✅ View feature demos
❌ Cannot link real FPL account
❌ Cannot save preferences
❌ Limited historical data access
```

#### 6.4.5 API Authentication

**JWT-Based Authentication**:
```
Authorization: Bearer <jwt_token>

JWT Payload:
{
  "sub": "user_uuid",
  "email": "user@example.com",
  "role": "admin|user|demo",
  "tier": "free|pro|elite",
  "fpl_team_id": 123456,
  "iat": 1234567890,
  "exp": 1234654290
}
```

**API Endpoints by Role**:
```
Public (no auth):
  GET  /api/health
  POST /api/auth/register
  POST /api/auth/login
  POST /api/auth/forgot-password

User (requires auth):
  GET  /api/me
  PUT  /api/me
  GET  /api/me/team
  GET  /api/me/recommendations
  GET  /api/me/mini-leagues
  POST /api/me/link-fpl

Admin (requires admin role):
  GET  /api/admin/users
  GET  /api/admin/users/:id
  GET  /api/admin/metrics
  GET  /api/admin/logs
  POST /api/admin/sync/trigger
  GET  /api/admin/debug/rules-engine
  POST /api/admin/impersonate/:user_id
```

#### 6.4.6 Multi-User Data Isolation

**Critical**: Users must NEVER see other users' data (except admin).

```sql
-- All user-specific queries must include user_id filter
-- Example: Get user's team recommendations

-- CORRECT ✅
SELECT * FROM recommendations
WHERE user_id = $current_user_id
ORDER BY created_at DESC;

-- WRONG ❌ (data leak vulnerability)
SELECT * FROM recommendations
ORDER BY created_at DESC;
```

**Row-Level Security (PostgreSQL)**:
```sql
-- Enable RLS on user data tables
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY user_isolation ON user_teams
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Admin bypass policy
CREATE POLICY admin_access ON user_teams
  FOR ALL
  TO admin_role
  USING (true);
```

#### 6.4.7 Initial User Setup

**For Your Development (Admin Account)**:
```sql
INSERT INTO users (email, password_hash, role, email_verified)
VALUES (
  'you@example.com',
  '$2b$12$...hashed_password...',
  'admin',
  TRUE
);
```

**For Your Friend (Standard User)**:
```sql
-- They'll register through normal flow, but you can pre-create:
INSERT INTO users (email, password_hash, role, email_verified)
VALUES (
  'friend@example.com',
  '$2b$12$...hashed_password...',
  'user',
  TRUE
);
```

#### 6.4.8 FPL Account Linking Flow

```
1. User clicks "Link FPL Account"
2. Redirect to FPL login page (in iframe or popup)
3. User enters FPL credentials (NOT stored by us)
4. FPL returns session cookies
5. We use cookies to fetch user's FPL Team ID
6. Store Team ID in our database
7. Optionally store encrypted cookies for background sync

SECURITY NOTES:
- We NEVER store FPL passwords
- Cookies are encrypted at rest
- User can unlink at any time
- If cookies expire, user re-links
```

#### 6.4.9 Session Management

```
Session Lifetime:
- Web: 7 days (refresh on activity)
- Mobile: 30 days
- Remember Me: 90 days

Session Invalidation:
- Password change → invalidate all sessions
- User request → invalidate specific session
- Admin action → can invalidate any session

Concurrent Sessions:
- Allowed (user can be logged in on multiple devices)
- Show active sessions in account settings
- Allow "log out everywhere" action
```

---

## 7. User Interface Design

### 7.1 Design Principles

1. **Mobile-first**: Most FPL decisions happen on mobile
2. **Data density**: Show key information without overwhelming
3. **Actionable**: Every screen should have clear next steps
4. **Fast**: Sub-second load times for critical features
5. **Accessible**: WCAG 2.1 AA compliance

### 7.2 Key Screens

#### Dashboard
```
┌─────────────────────────────────────────────┐
│  FPL Optimizer          GW22  ⏰ 2d 14h    │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ Your Team Value: £102.3m  Bank: £1.2m│   │
│  │ GW21 Points: 67  │  Overall: 1,847   │   │
│  └─────────────────────────────────────┘    │
│                                             │
│  ⚠️ ACTION NEEDED                           │
│  ┌─────────────────────────────────────┐    │
│  │ ▲ Saka price rise tonight (94%)     │    │
│  │ 🏥 Haaland doubtful - monitor        │    │
│  │ 📊 Transfer suggestion available     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  📊 MINI-LEAGUE: Work League               │
│  ┌─────────────────────────────────────┐    │
│  │ 1. You           1,847 pts          │    │
│  │ 2. Mike          1,832 pts  (-15)   │    │
│  │ 3. Sarah         1,798 pts  (-49)   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Dashboard] [Transfers] [Captain] [Plan]  │
└─────────────────────────────────────────────┘
```

#### Transfer Recommender
```
┌─────────────────────────────────────────────┐
│  Transfer Recommendations                   │
├─────────────────────────────────────────────┤
│  Free Transfers: 2  │  Budget: £1.2m       │
│                                             │
│  🎯 TOP RECOMMENDATION                      │
│  ┌─────────────────────────────────────┐    │
│  │ OUT: Rashford (£8.2m)               │    │
│  │ IN:  Palmer (£10.8m)                │    │
│  │                                     │    │
│  │ Expected gain: +4.2 pts/GW          │    │
│  │ Fixtures (next 5): 🟢🟢🟡🟢🟢       │    │
│  │ xGI: 0.78/90  │  Form: 8.2          │    │
│  │                                     │    │
│  │ [View Analysis]  [Make Transfer]    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  📊 ALTERNATIVES                            │
│  ┌─────────────────────────────────────┐    │
│  │ 2. Saka (+3.8 pts) - Price rise!    │    │
│  │ 3. Gordon (+3.1 pts) - Differential │    │
│  │ 4. Mbeumo (+2.9 pts) - Set pieces   │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 7.3 Color Scheme & Visual Language

| Element | Color | Usage |
|---------|-------|-------|
| Primary | `#37003C` (PL Purple) | Headers, CTAs |
| Secondary | `#00FF85` (PL Green) | Success, positive |
| Accent | `#E90052` (PL Pink) | Highlights, alerts |
| Danger | `#FF4444` | Negative, warnings |
| Background | `#F5F5F5` | Page background |
| Card | `#FFFFFF` | Content cards |

---

## 8. FPL Rules Engine

> **CRITICAL COMPONENT**: This engine validates ALL operations against FPL rules. No recommendation, transfer, or team selection should bypass this engine. This prevents the system from suggesting invalid actions.

### 8.1 Rules Engine Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ALL SYSTEM OPERATIONS                        │
│  (Transfers, Team Selection, Recommendations, Chip Usage)        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FPL RULES ENGINE                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Squad      │  │  Transfer   │  │  Chip                   │  │
│  │  Validator  │  │  Validator  │  │  Validator              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Formation  │  │  Budget     │  │  Points                 │  │
│  │  Validator  │  │  Validator  │  │  Calculator             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       ┌─────────────┐              ┌─────────────┐
       │   VALID     │              │   INVALID   │
       │   (proceed) │              │   (reject + │
       │             │              │    reason)  │
       └─────────────┘              └─────────────┘
```

### 8.2 Squad Validator

**Purpose**: Ensures squad composition is always valid

```typescript
interface SquadValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  code: string;
  message: string;
  field?: string;
  expected?: any;
  actual?: any;
}

function validateSquad(squad: Player[]): SquadValidationResult {
  const errors: ValidationError[] = [];

  // Rule 1: Exactly 15 players
  if (squad.length !== 15) {
    errors.push({
      code: 'SQUAD_SIZE_INVALID',
      message: `Squad must have exactly 15 players`,
      expected: 15,
      actual: squad.length
    });
  }

  // Rule 2: Position counts
  const positions = countPositions(squad);

  if (positions.GK !== 2) {
    errors.push({
      code: 'GK_COUNT_INVALID',
      message: `Must have exactly 2 goalkeepers`,
      expected: 2,
      actual: positions.GK
    });
  }

  if (positions.DEF !== 5) {
    errors.push({
      code: 'DEF_COUNT_INVALID',
      message: `Must have exactly 5 defenders`,
      expected: 5,
      actual: positions.DEF
    });
  }

  if (positions.MID !== 5) {
    errors.push({
      code: 'MID_COUNT_INVALID',
      message: `Must have exactly 5 midfielders`,
      expected: 5,
      actual: positions.MID
    });
  }

  if (positions.FWD !== 3) {
    errors.push({
      code: 'FWD_COUNT_INVALID',
      message: `Must have exactly 3 forwards`,
      expected: 3,
      actual: positions.FWD
    });
  }

  // Rule 3: Max 3 players per team
  const teamCounts = countByTeam(squad);
  for (const [teamId, count] of Object.entries(teamCounts)) {
    if (count > 3) {
      errors.push({
        code: 'TEAM_LIMIT_EXCEEDED',
        message: `Cannot have more than 3 players from ${getTeamName(teamId)}`,
        expected: 3,
        actual: count,
        field: teamId
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}
```

### 8.3 Formation Validator

**Purpose**: Ensures starting 11 follows valid football formations

```typescript
interface FormationValidationResult {
  valid: boolean;
  formation: string;  // e.g., "4-4-2"
  errors: ValidationError[];
}

const VALID_FORMATIONS = [
  { def: 3, mid: 4, fwd: 3 },  // 3-4-3
  { def: 3, mid: 5, fwd: 2 },  // 3-5-2
  { def: 4, mid: 3, fwd: 3 },  // 4-3-3
  { def: 4, mid: 4, fwd: 2 },  // 4-4-2
  { def: 4, mid: 5, fwd: 1 },  // 4-5-1
  { def: 5, mid: 2, fwd: 3 },  // 5-2-3
  { def: 5, mid: 3, fwd: 2 },  // 5-3-2
  { def: 5, mid: 4, fwd: 1 },  // 5-4-1
];

function validateFormation(starting11: Player[]): FormationValidationResult {
  const errors: ValidationError[] = [];

  // Must have exactly 11 starters
  if (starting11.length !== 11) {
    errors.push({
      code: 'STARTING_11_SIZE_INVALID',
      message: `Starting XI must have exactly 11 players`,
      expected: 11,
      actual: starting11.length
    });
    return { valid: false, formation: 'INVALID', errors };
  }

  const positions = countPositions(starting11);

  // Must have exactly 1 GK
  if (positions.GK !== 1) {
    errors.push({
      code: 'STARTING_GK_INVALID',
      message: `Must start exactly 1 goalkeeper`,
      expected: 1,
      actual: positions.GK
    });
  }

  // Check formation validity
  const formation = { def: positions.DEF, mid: positions.MID, fwd: positions.FWD };
  const isValidFormation = VALID_FORMATIONS.some(
    f => f.def === formation.def && f.mid === formation.mid && f.fwd === formation.fwd
  );

  if (!isValidFormation) {
    errors.push({
      code: 'FORMATION_INVALID',
      message: `Invalid formation: ${formation.def}-${formation.mid}-${formation.fwd}. ` +
               `Must have 3-5 DEF, 2-5 MID, 1-3 FWD.`,
      actual: `${formation.def}-${formation.mid}-${formation.fwd}`
    });
  }

  return {
    valid: errors.length === 0,
    formation: `${formation.def}-${formation.mid}-${formation.fwd}`,
    errors
  };
}
```

### 8.4 Transfer Validator

**Purpose**: Validates transfer operations

```typescript
interface TransferValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  costBreakdown: {
    playersOut: { player: Player; salePrice: number }[];
    playersIn: { player: Player; buyPrice: number }[];
    totalSaleValue: number;
    totalBuyValue: number;
    hitPoints: number;
    freeTransfersUsed: number;
    additionalTransfers: number;
  };
}

function validateTransfer(
  currentSquad: Player[],
  playersOut: Player[],
  playersIn: Player[],
  currentBank: number,
  freeTransfers: number,
  isWildcardActive: boolean,
  isFreeHitActive: boolean
): TransferValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Rule 1: Same number of players in and out
  if (playersOut.length !== playersIn.length) {
    errors.push({
      code: 'TRANSFER_COUNT_MISMATCH',
      message: `Must transfer same number of players in and out`,
      expected: playersOut.length,
      actual: playersIn.length
    });
  }

  // Rule 2: Players out must be in current squad
  for (const player of playersOut) {
    if (!currentSquad.find(p => p.id === player.id)) {
      errors.push({
        code: 'PLAYER_NOT_IN_SQUAD',
        message: `Cannot transfer out ${player.name} - not in squad`,
        field: player.id.toString()
      });
    }
  }

  // Rule 3: Players in must not already be in squad
  const squadAfterSales = currentSquad.filter(p => !playersOut.find(po => po.id === p.id));
  for (const player of playersIn) {
    if (squadAfterSales.find(p => p.id === player.id)) {
      errors.push({
        code: 'PLAYER_ALREADY_IN_SQUAD',
        message: `Cannot transfer in ${player.name} - already in squad`,
        field: player.id.toString()
      });
    }
  }

  // Calculate sale prices (you get half the profit rounded down)
  const salePrices = playersOut.map(player => {
    const purchasePrice = getPlayerPurchasePrice(player.id); // From user's purchase history
    const currentPrice = player.currentPrice;
    const profit = currentPrice - purchasePrice;
    const salePrice = purchasePrice + Math.floor(profit / 2 * 10) / 10; // Round to 0.1
    return { player, salePrice: Math.max(salePrice, currentPrice) }; // Handle price drops
  });

  // Actually, correction: if price dropped, you sell at current (lower) price
  const correctedSalePrices = playersOut.map(player => {
    const purchasePrice = getPlayerPurchasePrice(player.id);
    const currentPrice = player.currentPrice;

    if (currentPrice <= purchasePrice) {
      // Price dropped or same: sell at current price (full loss)
      return { player, salePrice: currentPrice };
    } else {
      // Price rose: sell at purchase + half profit
      const profit = currentPrice - purchasePrice;
      const yourShare = Math.floor(profit * 5) / 10; // Half, rounded down to 0.1
      return { player, salePrice: purchasePrice + yourShare };
    }
  });

  const totalSaleValue = correctedSalePrices.reduce((sum, p) => sum + p.salePrice, 0);
  const totalBuyValue = playersIn.reduce((sum, p) => sum + p.currentPrice, 0);
  const availableBudget = currentBank + totalSaleValue;

  // Rule 4: Budget check
  if (totalBuyValue > availableBudget) {
    errors.push({
      code: 'INSUFFICIENT_BUDGET',
      message: `Insufficient funds: need £${totalBuyValue.toFixed(1)}m, have £${availableBudget.toFixed(1)}m`,
      expected: totalBuyValue,
      actual: availableBudget
    });
  }

  // Rule 5: Validate new squad composition
  const newSquad = [...squadAfterSales, ...playersIn];
  const squadValidation = validateSquad(newSquad);
  errors.push(...squadValidation.errors);

  // Calculate hit cost
  const transferCount = playersOut.length;
  const hitPoints = isWildcardActive || isFreeHitActive
    ? 0
    : Math.max(0, transferCount - freeTransfers) * 4;

  if (hitPoints > 0) {
    warnings.push({
      code: 'POINT_HIT',
      message: `This transfer will cost ${hitPoints} points`,
      severity: hitPoints >= 8 ? 'high' : 'medium'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    costBreakdown: {
      playersOut: correctedSalePrices,
      playersIn: playersIn.map(p => ({ player: p, buyPrice: p.currentPrice })),
      totalSaleValue,
      totalBuyValue,
      hitPoints,
      freeTransfersUsed: Math.min(transferCount, freeTransfers),
      additionalTransfers: Math.max(0, transferCount - freeTransfers)
    }
  };
}
```

### 8.5 Chip Validator

**Purpose**: Validates chip usage

```typescript
interface ChipValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

function validateChipUsage(
  chip: 'wildcard' | 'free_hit' | 'triple_captain' | 'bench_boost',
  gameweek: number,
  userChipHistory: ChipUsage[],
  otherChipThisWeek?: string
): ChipValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Rule 1: Only one chip per gameweek
  if (otherChipThisWeek) {
    errors.push({
      code: 'MULTIPLE_CHIPS',
      message: `Cannot use ${chip} - already using ${otherChipThisWeek} this gameweek`,
    });
  }

  // Rule 2: Check if chip is available in current set
  const set = gameweek <= 19 ? 1 : 2;
  const chipUsedInSet = userChipHistory.find(
    usage => usage.chip === chip && usage.set === set
  );

  if (chipUsedInSet) {
    errors.push({
      code: 'CHIP_ALREADY_USED',
      message: `${chip} already used in set ${set} (GW${chipUsedInSet.gameweek})`,
    });
  }

  // Rule 3: Cannot use set 1 chips after GW19
  if (set === 2 && gameweek > 19) {
    const set1ChipRemaining = !userChipHistory.find(
      usage => usage.chip === chip && usage.set === 1
    );
    if (set1ChipRemaining && chip !== 'wildcard') {
      // Set 1 chip expired
      warnings.push({
        code: 'SET1_EXPIRED',
        message: `Note: Set 1 ${chip} has expired (was not used before GW20)`,
        severity: 'info'
      });
    }
  }

  // Chip-specific warnings
  if (chip === 'bench_boost') {
    // Check if it's a DGW
    const isDGW = checkIfDoubleGameweek(gameweek);
    if (!isDGW) {
      warnings.push({
        code: 'BB_NOT_DGW',
        message: `Bench Boost typically best used in Double Gameweeks`,
        severity: 'medium'
      });
    }
  }

  if (chip === 'triple_captain') {
    const isDGW = checkIfDoubleGameweek(gameweek);
    if (!isDGW) {
      warnings.push({
        code: 'TC_NOT_DGW',
        message: `Triple Captain typically best used in Double Gameweeks`,
        severity: 'medium'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

### 8.6 Points Calculator

**Purpose**: Calculates points according to FPL rules

```typescript
interface PointsBreakdown {
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  goalsConceded: number;
  saves: number;
  penaltySaves: number;
  penaltyMisses: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  bonus: number;
  defcon: number;  // NEW 2025/26
  total: number;
}

function calculatePlayerPoints(
  player: Player,
  matchStats: MatchStats
): PointsBreakdown {
  const breakdown: PointsBreakdown = {
    appearance: 0,
    goals: 0,
    assists: 0,
    cleanSheet: 0,
    goalsConceded: 0,
    saves: 0,
    penaltySaves: 0,
    penaltyMisses: 0,
    yellowCards: 0,
    redCards: 0,
    ownGoals: 0,
    bonus: 0,
    defcon: 0,
    total: 0
  };

  // Appearance points
  if (matchStats.minutes === 0) {
    breakdown.appearance = 0;
  } else if (matchStats.minutes < 60) {
    breakdown.appearance = 1;
  } else {
    breakdown.appearance = 2;
  }

  // Goals
  const goalPoints = {
    'GK': 6, 'DEF': 6, 'MID': 5, 'FWD': 4
  };
  breakdown.goals = matchStats.goals * goalPoints[player.position];

  // Assists
  breakdown.assists = matchStats.assists * 3;

  // Clean sheet (only if played 60+ mins)
  if (matchStats.minutes >= 60 && matchStats.teamGoalsConceded === 0) {
    if (player.position === 'GK' || player.position === 'DEF') {
      breakdown.cleanSheet = 4;
    } else if (player.position === 'MID') {
      breakdown.cleanSheet = 1;
    }
  }

  // Goals conceded (GK and DEF only)
  if (player.position === 'GK' || player.position === 'DEF') {
    breakdown.goalsConceded = -Math.floor(matchStats.goalsConcededWhilePlaying / 2);
  }

  // Saves (GK only)
  if (player.position === 'GK') {
    breakdown.saves = Math.floor(matchStats.saves / 3);
  }

  // Penalties
  breakdown.penaltySaves = matchStats.penaltySaves * 5;
  breakdown.penaltyMisses = matchStats.penaltyMisses * -2;

  // Cards
  breakdown.yellowCards = matchStats.yellowCards * -1;
  if (matchStats.redCard) {
    // Check if straight red or two yellows
    if (matchStats.yellowCards === 2) {
      breakdown.redCards = -2;  // -1 for first yellow already counted, -2 more for red
    } else {
      breakdown.redCards = -3;  // Straight red
    }
  }

  // Own goals
  breakdown.ownGoals = matchStats.ownGoals * -2;

  // Bonus
  breakdown.bonus = matchStats.bonus;

  // DEFCON (NEW 2025/26)
  if (player.position === 'DEF') {
    const cbit = matchStats.clearances + matchStats.blocks +
                 matchStats.interceptions + matchStats.tackles;
    if (cbit >= 10) {
      breakdown.defcon = 2;
    }
  } else if (player.position === 'MID' || player.position === 'FWD') {
    const cbirt = matchStats.clearances + matchStats.blocks +
                  matchStats.interceptions + matchStats.tackles +
                  matchStats.recoveries;
    if (cbirt >= 12) {
      breakdown.defcon = 2;
    }
  }

  // Total
  breakdown.total = Object.values(breakdown).reduce((a, b) => a + b, 0) - breakdown.total;

  return breakdown;
}
```

### 8.7 Auto-Substitution Engine

**Purpose**: Calculates auto-subs according to FPL rules

```typescript
interface AutoSubResult {
  substitutions: { starter: Player; sub: Player }[];
  finalStarting11: Player[];
  reasoning: string[];
}

function calculateAutoSubs(
  originalStarting11: Player[],
  bench: Player[],  // Ordered: [GK, Outfield1, Outfield2, Outfield3]
  playerMinutes: Map<string, number>
): AutoSubResult {
  const substitutions: { starter: Player; sub: Player }[] = [];
  const reasoning: string[] = [];

  let currentStarting11 = [...originalStarting11];

  // Find starters who didn't play
  const nonPlayingStarters = currentStarting11.filter(
    p => (playerMinutes.get(p.id.toString()) || 0) === 0
  );

  for (const starter of nonPlayingStarters) {
    // Try each bench player in order
    for (const benchPlayer of bench) {
      // Skip if bench player already used as sub
      if (substitutions.find(s => s.sub.id === benchPlayer.id)) continue;

      // Skip if bench player didn't play
      if ((playerMinutes.get(benchPlayer.id.toString()) || 0) === 0) continue;

      // Check if substitution is valid
      const testStarting11 = currentStarting11
        .filter(p => p.id !== starter.id)
        .concat([benchPlayer]);

      const formationResult = validateFormation(testStarting11);

      if (formationResult.valid) {
        substitutions.push({ starter, sub: benchPlayer });
        currentStarting11 = testStarting11;
        reasoning.push(
          `${starter.name} (0 mins) → ${benchPlayer.name} (bench slot ${bench.indexOf(benchPlayer) + 1})`
        );
        break;  // Move to next non-playing starter
      } else {
        reasoning.push(
          `${benchPlayer.name} cannot replace ${starter.name} - would create invalid formation ` +
          `(${formationResult.formation})`
        );
      }
    }
  }

  return {
    substitutions,
    finalStarting11: currentStarting11,
    reasoning
  };
}
```

### 8.8 Recommendation Validator

**Purpose**: ALL recommendations must pass through this before being shown to user

```typescript
interface Recommendation {
  type: 'transfer' | 'captain' | 'chip' | 'formation';
  action: any;
  expectedPoints: number;
  confidence: number;
}

interface ValidatedRecommendation extends Recommendation {
  isValid: boolean;
  validationErrors: ValidationError[];
  validationWarnings: ValidationWarning[];
}

function validateRecommendation(
  recommendation: Recommendation,
  userContext: UserContext
): ValidatedRecommendation {
  let errors: ValidationError[] = [];
  let warnings: ValidationWarning[] = [];

  switch (recommendation.type) {
    case 'transfer':
      const transferResult = validateTransfer(
        userContext.currentSquad,
        recommendation.action.playersOut,
        recommendation.action.playersIn,
        userContext.bank,
        userContext.freeTransfers,
        userContext.activeChip === 'wildcard',
        userContext.activeChip === 'free_hit'
      );
      errors = transferResult.errors;
      warnings = transferResult.warnings;
      break;

    case 'captain':
      // Captain must be in starting 11
      if (!userContext.starting11.find(p => p.id === recommendation.action.captainId)) {
        errors.push({
          code: 'CAPTAIN_NOT_IN_STARTING_11',
          message: `Recommended captain is not in starting 11`
        });
      }
      break;

    case 'chip':
      const chipResult = validateChipUsage(
        recommendation.action.chip,
        userContext.currentGameweek,
        userContext.chipHistory,
        userContext.activeChip
      );
      errors = chipResult.errors;
      warnings = chipResult.warnings;
      break;

    case 'formation':
      const formationResult = validateFormation(recommendation.action.starting11);
      errors = formationResult.errors;
      break;
  }

  return {
    ...recommendation,
    isValid: errors.length === 0,
    validationErrors: errors,
    validationWarnings: warnings
  };
}

// CRITICAL: This must be called before returning any recommendation to the UI
function filterInvalidRecommendations(
  recommendations: Recommendation[],
  userContext: UserContext
): ValidatedRecommendation[] {
  return recommendations
    .map(rec => validateRecommendation(rec, userContext))
    .filter(rec => rec.isValid);  // Only return valid recommendations
}
```

### 8.9 Rules Engine Test Suite

**Purpose**: Ensure rules engine is correct with comprehensive tests

```typescript
// These tests MUST pass before deployment

describe('FPL Rules Engine', () => {

  describe('Squad Validation', () => {
    test('rejects squad with 14 players', () => {
      const squad = createSquadWithNPlayers(14);
      const result = validateSquad(squad);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'SQUAD_SIZE_INVALID' })
      );
    });

    test('rejects squad with 4 players from same team', () => {
      const squad = createSquadWith4ArsenalPlayers();
      const result = validateSquad(squad);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'TEAM_LIMIT_EXCEEDED' })
      );
    });

    test('accepts valid 15-player squad', () => {
      const squad = createValidSquad();
      const result = validateSquad(squad);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Formation Validation', () => {
    test('accepts 4-4-2 formation', () => {
      const starting11 = createFormation(1, 4, 4, 2);
      const result = validateFormation(starting11);
      expect(result.valid).toBe(true);
      expect(result.formation).toBe('4-4-2');
    });

    test('rejects 2-5-3 formation (only 2 defenders)', () => {
      const starting11 = createFormation(1, 2, 5, 3);
      const result = validateFormation(starting11);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'FORMATION_INVALID' })
      );
    });

    test('rejects formation with 0 forwards', () => {
      const starting11 = createFormation(1, 5, 5, 0);
      const result = validateFormation(starting11);
      expect(result.valid).toBe(false);
    });
  });

  describe('Transfer Validation', () => {
    test('rejects transfer exceeding budget', () => {
      const result = validateTransfer(
        squad, [cheapPlayer], [expensivePlayer],
        0.5,  // Only £0.5m in bank
        1, false, false
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INSUFFICIENT_BUDGET' })
      );
    });

    test('calculates correct sale price (half profit)', () => {
      // Bought at £7.0m, now worth £8.0m
      // Should sell at £7.5m (half of £1.0m profit)
      const result = validateTransfer(...);
      expect(result.costBreakdown.playersOut[0].salePrice).toBe(7.5);
    });

    test('calculates correct hit points', () => {
      // 3 transfers with 1 FT = 2 extra = 8 point hit
      const result = validateTransfer(
        squad, [p1, p2, p3], [newP1, newP2, newP3],
        10.0, 1, false, false
      );
      expect(result.costBreakdown.hitPoints).toBe(8);
    });
  });

  describe('Points Calculation', () => {
    test('gives 2 points for 60+ minutes', () => {
      const stats = { minutes: 60, goals: 0, assists: 0, ... };
      const points = calculatePlayerPoints(midfielder, stats);
      expect(points.appearance).toBe(2);
    });

    test('gives 1 point for 59 minutes', () => {
      const stats = { minutes: 59, goals: 0, assists: 0, ... };
      const points = calculatePlayerPoints(midfielder, stats);
      expect(points.appearance).toBe(1);
    });

    test('no clean sheet if subbed at 59 mins', () => {
      const stats = { minutes: 59, teamGoalsConceded: 0, ... };
      const points = calculatePlayerPoints(defender, stats);
      expect(points.cleanSheet).toBe(0);
    });

    test('clean sheet awarded if played exactly 60 mins', () => {
      const stats = { minutes: 60, teamGoalsConceded: 0, ... };
      const points = calculatePlayerPoints(defender, stats);
      expect(points.cleanSheet).toBe(4);
    });
  });

  describe('Auto-Substitution', () => {
    test('skips bench player that would create invalid formation', () => {
      // 3-5-2 with 1 DEF not playing
      // Bench: GK, FWD, FWD, DEF
      // Should skip FWDs and use DEF from slot 4
      const result = calculateAutoSubs(starting11, bench, minutes);
      expect(result.substitutions[0].sub.position).toBe('DEF');
    });
  });

});
```

---

## 9. Analytics Engine

### 8.1 Key Metrics Calculated

#### Player Value Score (PVS)
```
PVS = (Expected_Points × Form_Multiplier × Fixture_Multiplier) / Price

Where:
- Expected_Points = Base prediction from ML model
- Form_Multiplier = Recent performance weighting (1.0 - 1.5)
- Fixture_Multiplier = Based on opponent difficulty (0.8 - 1.3)
```

#### Expected Points Model Inputs

| Feature | Weight | Source |
|---------|--------|--------|
| xG per 90 | High | Understat |
| xA per 90 | High | Understat |
| Minutes per game | High | FPL API |
| ICT Index | Medium | FPL API |
| Fixture difficulty | Medium | FPL API |
| Home/Away | Medium | FPL API |
| Historical vs opponent | Low | Calculated |
| Set piece involvement | Medium | Third-party |
| Clean sheet probability | High (DEF/GK) | Model |
| Team form | Medium | Calculated |

### 8.2 Prediction Models

#### Point Prediction (Regression)
- **Algorithm**: XGBoost Regressor / LightGBM
- **Features**: 30+ engineered features
- **Output**: Expected points (with confidence interval)
- **Training**: Historical seasons data
- **Validation**: Walk-forward cross-validation

#### Clean Sheet Probability (Classification)
- **Algorithm**: Logistic Regression / Random Forest
- **Features**: Team defensive stats, opponent attacking stats
- **Output**: Probability 0-1
- **Usage**: Defensive player valuations

#### Price Change Prediction
- **Algorithm**: Time-series analysis + transfer velocity
- **Features**: Net transfers, current price, ownership %
- **Output**: Rise/Fall probability, timing

#### Minutes Probability Model (Rotation Risk)

**Purpose**: Predict playing time to avoid 0-pointers and optimize bench order

**Algorithm**: Gradient Boosting Classification + Regression hybrid

**Features**:
| Feature | Weight | Source |
|---------|--------|--------|
| Recent minutes (last 5 GWs) | High | FPL API |
| UCL/EL midweek fixture | High | Fixture list |
| Days since last match | Medium | Calculated |
| Manager rotation history | High | Historical analysis |
| Player age | Low | Static |
| Recent injury return | High | News/FPL flags |
| Team's league position | Low | Table |
| Match importance | Medium | Calculated |

**Outputs**:
```
┌─────────────────────────────────────────────────┐
│ Saka - Minutes Probability                      │
├─────────────────────────────────────────────────┤
│ Starts: 85%                                     │
│ Plays 60+ mins: 78%                             │
│ Plays 1-59 mins: 12%                            │
│ Does not play: 10%                              │
│                                                 │
│ Risk factors:                                   │
│ - UCL match 3 days before (-8%)                 │
│ - Played 90 mins in last 3 matches (-5%)        │
│ - Arsenal have no midweek next GW (+3%)         │
└─────────────────────────────────────────────────┘
```

**Manager Profiles** (Pep Roulette, etc.):
- Track historical rotation patterns by manager
- Identify "safe" vs "risky" players under each manager
- Special flags for managers known for rotation (Guardiola, Slot, Arteta)

**Bench Order Optimization**:
- First sub should be high-floor (likely to play 60+ if called upon)
- Order based on: (Minutes_Probability × Expected_Points_If_Playing)
- Alert when bench order is suboptimal

### 8.3 Model Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Point prediction MAE | < 2.0 | Mean Absolute Error |
| Captain success rate | > 60% | Captain in top 3 scorers |
| Transfer recommendation accuracy | > 55% | Recommended player outscores alternative |
| Price change prediction | > 80% | Correct direction prediction |

---

## 9. Optimization Algorithms

### 9.1 Team Selection Optimization

**Problem**: Select 15 players maximizing expected points within constraints

```
Maximize: Σ (Expected_Points × Selection[i])

Subject to:
- Σ Price[i] × Selection[i] ≤ Budget
- Σ Selection[i] = 15
- Σ Selection[i] for team[t] ≤ 3 (for each team)
- GK = 2, DEF = 5, MID = 5, FWD = 3
```

**Algorithm**: Mixed Integer Linear Programming (MILP) using PuLP/OR-Tools

### 9.2 Transfer Optimization

**Problem**: Find optimal transfer(s) given current team

```python
def optimize_transfers(current_team, budget, free_transfers):
    best_score = current_expected_points
    best_transfers = []

    for num_transfers in range(1, free_transfers + 3):
        hit_cost = max(0, (num_transfers - free_transfers) * 4)

        for out_combination in combinations(current_team, num_transfers):
            available_budget = budget + sum(selling_price(p) for p in out_combination)

            # Use MILP to find best replacements
            best_in = find_optimal_players(
                available_budget,
                excluded=current_team - out_combination,
                num_players=num_transfers
            )

            new_score = calculate_expected_points(new_team) - hit_cost
            if new_score > best_score:
                best_score = new_score
                best_transfers = (out_combination, best_in)

    return best_transfers
```

#### Transfer Threshold Analysis

**When NOT to Transfer**:
The spec must address when making NO transfer is optimal.

**Hit Worthiness Calculator**:
```
A -4 hit requires the incoming player to outscore the outgoing player by 4+ points.

But this is simplified. True calculation:

Hit_Threshold = 4 / Remaining_GWs_With_Player

Example:
- GW5: Player for 30 GWs → needs +0.13 pts/GW advantage
- GW30: Player for 8 GWs → needs +0.5 pts/GW advantage
- GW36: Player for 2 GWs → needs +2.0 pts/GW advantage

Late-season hits require MUCH higher point differentials.
```

**Rolling Transfer Value**:
```
Rolling_Value = Expected_Gain_This_GW vs Expected_Gain_If_Rolled

Consider:
- This week's best transfer: +1.5 expected points
- Next week with 2 FTs: +4.0 expected points (can do 2-player moves)
- Decision: ROLL the transfer
```

**Transfer Efficiency Tracking**:
- Log all transfers with expected vs actual points
- Calculate user's historical transfer accuracy
- Identify patterns: "You tend to transfer too early after price rises"
- Show: "Your transfers have net +X/-Y points this season"

**Knee-Jerk Prevention**:
- Flag transfers made within 24 hours of a player blanking
- Show: "Wait for more data" recommendations
- Price change urgency vs decision quality tradeoff

### 9.3 Chip Optimization

**Wildcard Timing**:
- Identify optimal restructuring points (fixture swings)
- Calculate team value vs expected points tradeoff
- Factor in upcoming double/blank gameweeks

**Bench Boost Timing** (Advanced):
- Simple trigger (bench > 20 pts) is insufficient
- Requires **full 15-player squad optimization** for BB weeks

**BB Squad Building Strategy**:
```
1. Pre-BB Wildcard: Restructure entire team for 15 starters
2. Target DGW players with TWO favorable fixtures (not one hard, one easy)
3. Price efficiency shifts: £4.5m bench fodder → £5.5m DGW players
4. Maximize players from teams with confirmed DGW dates
5. Consider BGW the following week (avoid players who blank)
```

**BB Scoring**:
```
BB_Value = Σ All_15_Players_Expected_Points - Normal_11_Expected_Points
         = Bench_Expected + (Upgraded_Starters - Original_Starters)
```

**BB Requirements Checklist**:
- [ ] 15 players with confirmed double gameweek
- [ ] No players with rotation risk in either fixture
- [ ] Favorable fixtures in BOTH games (not just one)
- [ ] Wildcard used to build optimal BB squad
- [ ] Consider rival BB timing (defensive vs aggressive)

**Triple Captain Timing**:
- Score = Best_Captain_Expected_Points × 3
- Trigger when premium player has favorable DGW

---

## 10. Development Phases

### Phase 1: MVP (8-10 weeks)

**Goal**: Launch with core value proposition

| Week | Deliverable |
|------|-------------|
| 1-2 | Project setup, FPL API integration, basic data pipeline |
| 3-4 | User authentication, team sync from FPL |
| 5-6 | Dashboard, basic team analyzer |
| 7-8 | Transfer recommender (rule-based initially) |
| 9-10 | Captain selector, testing, soft launch |

**MVP Features**:
- ✅ Dashboard with team overview
- ✅ Basic transfer recommendations (top 5)
- ✅ Captain selector with fixture analysis
- ✅ Fixture planner (next 5 GWs)
- ✅ Price change alerts

### Phase 2: Analytics Enhancement (6-8 weeks)

**Goal**: Introduce ML-powered predictions

| Week | Deliverable |
|------|-------------|
| 1-2 | Historical data collection, feature engineering |
| 3-4 | Point prediction model training and validation |
| 5-6 | Integrate predictions into recommendations |
| 7-8 | A/B testing, model refinement |

**Phase 2 Features**:
- ✅ ML-powered point predictions
- ✅ Confidence intervals on recommendations
- ✅ Advanced metrics (xG, xA, xGI) integration
- ✅ Historical performance analysis

### Phase 3: Social & Competition (4-6 weeks)

**Goal**: Mini-league competitive features

**Phase 3 Features**:
- ✅ Mini-league integration
- ✅ Rival comparison and differential analysis
- ✅ Effective ownership calculations
- ✅ "Beat your rival" recommendations

### Phase 4: Advanced Optimization (6-8 weeks)

**Goal**: Full optimization suite

**Phase 4 Features**:
- ✅ Chip strategy advisor
- ✅ Season-long planning tools
- ✅ Double/Blank GW predictor
- ✅ Team value optimization
- ✅ "Set and forget" mode

### Phase 5: Mobile & Expansion (8-10 weeks)

**Goal**: Multi-platform presence

**Phase 5 Features**:
- ✅ Native mobile app (iOS/Android)
- ✅ Browser extension
- ✅ Push notifications
- ✅ Premium subscription tier

---

## 11. Success Metrics

### 11.1 Product Metrics

| Metric | Target (Year 1) | Measurement |
|--------|-----------------|-------------|
| Monthly Active Users | 50,000 | Analytics |
| User Retention (30-day) | > 40% | Cohort analysis |
| Premium Conversion | > 5% | Revenue / MAU |
| NPS Score | > 50 | User surveys |

### 11.2 Prediction Accuracy Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Captain Success Rate | > 60% | Captain in top 3 scorers |
| Transfer Recommendation Accuracy | > 55% | Backtesting |
| Point Prediction MAE | < 2.0 | Weekly comparison |
| User Rank Improvement | +10% | Before/after comparison |

### 11.3 Winning-Focused Metrics (NEW)

**These are the metrics that matter for actually winning leagues:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mini-League Win Rate | > 25% | % of users who win at least one mini-league |
| Mini-League Top 3 Rate | > 50% | % of users finishing top 3 in primary league |
| Overall Rank Improvement | > 15% | Season-over-season improvement |
| Chip Timing Success | > 65% | Chip used in optimal or near-optimal week |
| Differential Hit Rate | > 40% | % of differential picks that outperform template |
| "Swing Week" Identification | > 70% | Correctly identified weeks where differentials matter |

**User Outcome Tracking**:
- Track mini-league finishing positions for all users
- Compare to baseline (random expectation for league size)
- Identify which features correlate with winning

**The Ultimate Metric**:
```
"Did using this app help you beat your friends?"

Survey at season end:
- Where did you finish in your main mini-league?
- Did you finish higher than last season?
- Which feature helped most?
```

### 11.4 Business Metrics

| Metric | Target (Year 1) | Notes |
|--------|-----------------|-------|
| Monthly Recurring Revenue | £10,000 | Premium subscriptions |
| Customer Acquisition Cost | < £5 | Marketing efficiency |
| Lifetime Value | > £30 | Retention × ARPU |

---

## 12. Competitive Analysis

### 12.1 Existing Competitors

| Product | Strengths | Weaknesses | Price |
|---------|-----------|------------|-------|
| **Fantasy Football Scout** | Comprehensive stats, community, member area content | Expensive, overwhelming UI | £25/season |
| **Fantasy Football Hub** | Ben Crellin's planning tools, clean UI | Less depth than Scout | £19/season |
| **Fantasy Football Fix** | AI recommendations, elite manager tracking | Accuracy concerns | £15/season |
| **FPL Review** | Free tier, transparent model | Limited features, basic UI | Free/£10 |

### 12.2 Our Differentiation

1. **Personalized Optimization**: Not just "best players" but "best players for YOUR team"
2. **Mini-League Focus**: Beat your friends, not just improve overall rank
3. **Chip Integration**: Holistic season planning, not just weekly tips
4. **Transparency**: Show why recommendations are made, not black-box AI
5. **Modern UX**: Mobile-first, fast, delightful experience
6. **Fair Pricing**: Generous free tier, reasonable premium

### 12.3 Pricing Strategy

| Tier | Price | Features |
|------|-------|----------|
| **Free** | £0 | Dashboard, basic recommendations, fixture planner |
| **Pro** | £2.99/month | Full recommendations, mini-league analysis, chip advisor |
| **Elite** | £7.99/month | Everything + historical analysis, API access, priority support |

---

## Appendix A: FPL API Reference

### Key Endpoints

```
Base URL: https://fantasy.premierleague.com/api/

GET /bootstrap-static/          # All static data
GET /fixtures/                  # All fixtures
GET /fixtures/?event={gw}       # Fixtures for specific GW
GET /element-summary/{id}/      # Player detailed stats
GET /entry/{id}/                # Manager info
GET /entry/{id}/history/        # Manager history
GET /entry/{id}/event/{gw}/picks/  # Manager's picks
GET /event/{gw}/live/           # Live GW data
GET /leagues-classic/{id}/standings/  # League standings
```

### Authentication
For personal team data, authenticate via:
1. POST to `https://users.premierleague.com/accounts/login/`
2. Use returned session cookie for subsequent requests

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **BGW** | Blank Gameweek - some teams don't play |
| **DGW** | Double Gameweek - some teams play twice |
| **xG** | Expected Goals - goal probability from shots |
| **xA** | Expected Assists - assist probability from passes |
| **xGI** | Expected Goal Involvement (xG + xA) |
| **ICT** | Influence, Creativity, Threat index |
| **BPS** | Bonus Points System |
| **DEFCON** | Defensive Contributions (new 2025/26) |
| **FDR** | Fixture Difficulty Rating (1-5 scale) |
| **EO** | Effective Ownership (ownership-weighted by captain) |
| **Template** | Common team structure used by many managers |
| **Differential** | Low-ownership player pick |
| **Hits** | Point deductions for extra transfers (-4 each) |

---

## Appendix C: Research Sources

- [Premier League Official FPL Rules](https://fantasy.premierleague.com/help/rules)
- [FPL API Guide - Medium](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19)
- [Fantasy Football Scout](https://www.fantasyfootballscout.co.uk/)
- [Fantasy Football Hub](https://www.fantasyfootballhub.co.uk/)
- [xG Explained - FBref](https://fbref.com/en/expected-goals-model-explained/)
- [2025/26 Rule Changes](https://www.premierleague.com/en/news/4373187/whats-new-for-202526-changes-in-fantasy-premier-league)

---

## Appendix D: Acceptance Criteria & Test Cases

> **PURPOSE**: These are specific, testable criteria that MUST pass before any feature is complete. Use these to verify the system understands FPL rules correctly. **ALL CRITICAL tests must pass before deployment.**

---

### D.1 Squad Composition Tests

| ID | Scenario | Expected | Priority |
|----|----------|----------|----------|
| SQ-01 | Squad with 14 players | REJECT "Must have 15 players" | Critical |
| SQ-02 | Squad with 16 players | REJECT "Must have 15 players" | Critical |
| SQ-03 | Squad with 1 GK | REJECT "Must have 2 GKs" | Critical |
| SQ-04 | Squad with 3 GK | REJECT "Must have 2 GKs" | Critical |
| SQ-05 | Squad with 4 DEF | REJECT "Must have 5 DEFs" | Critical |
| SQ-06 | Squad with 4 Arsenal players | REJECT "Max 3 from Arsenal" | Critical |
| SQ-07 | Valid squad (2 GK, 5 DEF, 5 MID, 3 FWD) | ACCEPT | Critical |

### D.2 Formation Tests

| ID | Formation | Expected | Priority |
|----|-----------|----------|----------|
| FM-01 | 4-4-2 | ACCEPT | Critical |
| FM-02 | 3-5-2 | ACCEPT | Critical |
| FM-03 | 5-4-1 | ACCEPT | Critical |
| FM-04 | 2-5-3 (only 2 DEF) | REJECT "Min 3 DEF" | Critical |
| FM-05 | 4-1-5 (only 1 MID) | REJECT "Min 2 MID" | Critical |
| FM-06 | 5-5-0 (no FWD) | REJECT "Min 1 FWD" | Critical |
| FM-07 | 2 GK starting | REJECT "Exactly 1 GK" | Critical |

### D.3 Transfer & Budget Tests

| ID | Scenario | Expected | Priority |
|----|----------|----------|----------|
| TR-01 | 1 transfer with 1 FT | 0 hit | Critical |
| TR-02 | 2 transfers with 1 FT | -4 hit | Critical |
| TR-03 | 3 transfers with 1 FT | -8 hit | Critical |
| TR-04 | Roll 4 FT → next GW | 5 FT (capped) | High |
| TR-05 | Roll 5 FT → next GW | 5 FT (not 6) | High |
| TR-06 | Buy £12m with £10m available | REJECT | Critical |

### D.4 Sale Price Tests (CRITICAL - Often Wrong)

| ID | Bought | Current | Sale Price | Reason |
|----|--------|---------|------------|--------|
| SP-01 | £7.0m | £7.5m | £7.2m | Half of £0.5m = £0.2m |
| SP-02 | £7.0m | £8.0m | £7.5m | Half of £1.0m = £0.5m |
| SP-03 | £7.0m | £6.5m | £6.5m | Full loss on drops |
| SP-04 | £7.0m | £7.0m | £7.0m | No change |

### D.5 Points Calculation Tests

| ID | Scenario | Points | Priority |
|----|----------|--------|----------|
| PT-01 | MID 90 mins, 1 goal | 2 + 5 = 7 | Critical |
| PT-02 | DEF 90 mins, clean sheet | 2 + 4 = 6 | Critical |
| PT-03 | DEF 59 mins, clean sheet | 1 + 0 = 1 (no CS) | Critical |
| PT-04 | DEF 60 mins, clean sheet | 2 + 4 = 6 | Critical |
| PT-05 | GK 6 saves | 2 + 2 = 4 | High |
| PT-06 | Yellow + straight red | -1 + -3 = -4 | High |
| PT-07 | 2 yellows = red | -1 + -2 = -3 | High |
| PT-08 | 0 minutes played | 0 | Critical |

### D.6 Captain Tests

| ID | Scenario | Expected | Priority |
|----|----------|----------|----------|
| CP-01 | Captain scores 6 | 12 (doubled) | Critical |
| CP-02 | Captain 0 mins, VC scores 5 | VC = 10 | Critical |
| CP-03 | Captain 1 min, scores 1 | 2 (still doubled) | Critical |
| CP-04 | Captain 0, VC 0 | 0 doubled | Critical |
| CP-05 | Set captain from bench | REJECT | Critical |
| CP-06 | Triple Captain scores 6 | 18 | Critical |

### D.7 Chip Tests

| ID | Scenario | Expected | Priority |
|----|----------|----------|----------|
| CH-01 | WC in GW5, WC again GW10 | REJECT (WC1 used) | Critical |
| CH-02 | BB + TC same GW | REJECT (1 chip/GW) | Critical |
| CH-03 | WC, make 10 transfers | 0 hit | Critical |
| CH-04 | Free Hit, next GW | Team reverts | Critical |
| CH-05 | Unused Set 1 chip after GW19 | Expired | High |

### D.8 Auto-Sub Tests

| ID | Starting | Bench | Non-Player | Expected Sub |
|----|----------|-------|------------|--------------|
| AS-01 | 3-5-2, 1 DEF out | [GK,FWD,FWD,DEF] | DEF | DEF slot 4 (skip FWDs) |
| AS-02 | 4-4-2, GK out | [GK,DEF,MID,FWD] | GK | Bench GK |
| AS-03 | 3-5-2, 1 DEF out | [GK,FWD,FWD,FWD] | DEF | No valid sub |

### D.9 User Auth Tests

| ID | Scenario | Expected | Priority |
|----|----------|----------|----------|
| UA-01 | Admin → admin panel | ACCEPT | Critical |
| UA-02 | User → admin panel | 403 Forbidden | Critical |
| UA-03 | User A → User B data | 403 Forbidden | Critical |
| UA-04 | No token → /api/me | 401 Unauthorized | Critical |

---

### D.10 Test Execution Checklist

**Before ANY release:**
```
[ ] All SQ tests pass (Squad)
[ ] All FM tests pass (Formation)
[ ] All TR tests pass (Transfer)
[ ] All SP tests pass (Sale Price)  ← VERIFY CAREFULLY
[ ] All PT tests pass (Points)
[ ] All CP tests pass (Captain)
[ ] All CH tests pass (Chips)
[ ] All AS tests pass (Auto-Sub)
[ ] All UA tests pass (Auth)

Critical tests: 35+
ALL must pass: YES
```

---

## Appendix E: Development Anti-Patterns

> **PURPOSE**: Mistakes from previous attempts. DO NOT repeat.

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Allowing 4+ from same team | Always validate team count |
| Recommending bench player as captain | Validate captain in starting XI |
| Wrong sale price calculation | Use half-profit rule, rounded down |
| Showing invalid recommendations | Validate ALL through Rules Engine |
| Not testing edge cases | 100% test coverage on Rules Engine |
| Mixing UI and business logic | Separate Rules Engine |
| No user data isolation | Filter by user_id, use RLS |
| Hardcoding FPL rules | Configurable rules engine |

---

## Next Steps

1. **Review this specification** with your friend
2. **Prioritize features** - what's most important for the first version?
3. **Define scope for MVP** - start small, iterate fast
4. **Choose technology stack** - based on team skills and preferences
5. **Begin Phase 1 development**

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Author: Claude (AI Assistant)*
