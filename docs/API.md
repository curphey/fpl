# FPL Insights API Documentation

This document describes the API endpoints available in FPL Insights.

## Overview

The API consists of:

- **FPL Proxy Routes**: Proxy endpoints to the official FPL API with caching
- **AI Endpoints**: Claude-powered optimization and news search
- **Notification Endpoints**: Push notification and email management

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

## Authentication

Most endpoints are public. Protected endpoints require authentication via API key.

| Endpoint                        | Authentication   |
| ------------------------------- | ---------------- |
| `/api/fpl/*`                    | None (public)    |
| `/api/news/*`                   | None (public)    |
| `/api/optimize`                 | None (public)    |
| `/api/notifications/send`       | API Key required |
| `/api/notifications/send-email` | API Key required |

For protected endpoints, include the API key in the header:

```
x-api-key: your-notifications-api-key
```

---

## FPL Proxy Routes

These endpoints proxy requests to the official Fantasy Premier League API with server-side caching.

### GET /api/fpl/bootstrap-static

Fetch all static FPL data (players, teams, gameweeks).

**Response**: `BootstrapStatic` object

```json
{
  "elements": [...],      // All players
  "teams": [...],         // All teams
  "events": [...],        // All gameweeks
  "element_types": [...], // Position types
  "game_settings": {...}, // Game rules
  "phases": [...],        // Season phases
  "total_players": 12000000
}
```

**Cache**: 5 minutes

---

### GET /api/fpl/fixtures

Fetch all fixtures for the season.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | number | Optional. Filter by gameweek |

**Response**: Array of `Fixture` objects

```json
[
  {
    "id": 1,
    "event": 1,
    "team_h": 1,
    "team_a": 2,
    "team_h_difficulty": 3,
    "team_a_difficulty": 2,
    "kickoff_time": "2024-08-16T19:00:00Z",
    "finished": false,
    "team_h_score": null,
    "team_a_score": null
  }
]
```

**Cache**: 5 minutes

---

### GET /api/fpl/element-summary/[id]

Fetch detailed statistics for a specific player.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Player element ID |

**Response**: `ElementSummary` object

```json
{
  "history": [...],         // Past gameweek stats
  "history_past": [...],    // Previous seasons
  "fixtures": [...]         // Upcoming fixtures
}
```

---

### GET /api/fpl/event/[gw]/live

Fetch live gameweek data with real-time points.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `gw` | number | Gameweek number (1-38) |

**Response**: `LiveGameweek` object

```json
{
  "elements": [
    {
      "id": 1,
      "stats": {
        "minutes": 90,
        "goals_scored": 1,
        "assists": 0,
        "bonus": 3,
        "bps": 45,
        "total_points": 12
      }
    }
  ]
}
```

---

### GET /api/fpl/entry/[id]

Fetch manager entry data.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Manager ID |

**Response**: `Entry` object

```json
{
  "id": 123456,
  "player_first_name": "John",
  "player_last_name": "Doe",
  "name": "My Team FC",
  "summary_overall_points": 1500,
  "summary_overall_rank": 100000
}
```

---

### GET /api/fpl/entry/[id]/history

Fetch manager's season history.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Manager ID |

**Response**: `EntryHistory` object

```json
{
  "current": [...],  // Current season GW-by-GW
  "past": [...],     // Previous seasons
  "chips": [...]     // Chips used
}
```

---

### GET /api/fpl/entry/[id]/event/[gw]/picks

Fetch manager's picks for a specific gameweek.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Manager ID |
| `gw` | number | Gameweek number (1-38) |

**Response**: `EntryPicks` object

```json
{
  "picks": [
    {
      "element": 1,
      "position": 1,
      "is_captain": false,
      "is_vice_captain": false,
      "multiplier": 1
    }
  ],
  "active_chip": null,
  "entry_history": {...}
}
```

---

### GET /api/fpl/leagues-classic/[id]/standings

Fetch classic league standings.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | League ID |

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `page_standings` | number | Page number (default: 1) |

**Response**: `LeagueStandings` object

```json
{
  "league": {
    "id": 12345,
    "name": "My Mini League"
  },
  "standings": {
    "results": [
      {
        "entry": 123456,
        "player_name": "John Doe",
        "entry_name": "Team FC",
        "total": 1500,
        "rank": 1
      }
    ],
    "has_next": false
  }
}
```

---

## AI Endpoints

### POST /api/optimize

Run Claude AI optimization for transfer, chip, or wildcard recommendations.

**Request Body**:

```json
{
  "type": "transfer",
  "query": "Who should I transfer in?",
  "constraints": {
    "budget": 2.5,
    "maxTransfers": 1,
    "positionNeeds": ["MID"],
    "preferDifferentials": false,
    "lookAheadWeeks": 5
  },
  "currentTeam": {
    "players": [...],
    "bank": 0.5,
    "freeTransfers": 1,
    "chipsUsed": ["wildcard"]
  },
  "leagueContext": {
    "rank": 50,
    "totalManagers": 100,
    "gapToLeader": 25,
    "gameweeksRemaining": 10
  }
}
```

**Optimization Types**:
| Type | Description |
|------|-------------|
| `transfer` | Transfer recommendations |
| `chip` | Chip timing advice |
| `wildcard` | Full squad rebuild |

**Response**:

```json
{
  "type": "transfer",
  "thinking": "...",
  "summary": "Recommendation summary",
  "recommendations": [...],
  "warnings": ["Any caveats"],
  "processingTime": 5000
}
```

**Error Codes**:
| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Missing required fields |
| `API_ERROR` | Claude API error |
| `RATE_LIMITED` | Too many requests |
| `TIMEOUT` | Request timed out |

**Timeout**: 60 seconds

---

### GET /api/news

Search for FPL-related news using Claude web search.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `players` | string | Comma-separated player names |
| `teams` | string | Comma-separated team names |
| `categories` | string | Comma-separated: injury, transfer, team_news, press_conference, suspension, general |
| `limit` | number | Max results (default: 10) |

**Response**:

```json
{
  "items": [
    {
      "id": "news-123",
      "title": "Haaland injury update",
      "summary": "...",
      "category": "injury",
      "players": ["Erling Haaland"],
      "teams": ["Manchester City"],
      "source": "BBC Sport",
      "sourceUrl": "https://...",
      "publishedAt": "2024-01-15T10:00:00Z",
      "relevanceScore": 95,
      "fplImpact": "negative",
      "impactDetails": "May miss next gameweek"
    }
  ],
  "searchQuery": "...",
  "timestamp": "2024-01-15T12:00:00Z",
  "cached": false
}
```

**Cache**: 15 minutes

---

### GET /api/news/injuries

Get injury updates for players.

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `players` | string | Comma-separated player names (optional) |

**Response**:

```json
{
  "injuries": [
    {
      "playerName": "Kevin De Bruyne",
      "team": "Manchester City",
      "status": "injured",
      "details": "Hamstring injury",
      "expectedReturn": "GW25",
      "source": "Manchester City",
      "updatedAt": "2024-01-15"
    }
  ]
}
```

---

### GET /api/news/team/[team]

Get team news for upcoming gameweek.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `team` | string | Team name (URL encoded) |

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `gw` | number | Gameweek number |

**Response**:

```json
{
  "team": "Manchester City",
  "gameweek": 22,
  "predictedLineup": ["Ederson", "Walker", ...],
  "absentPlayers": [
    {"name": "Haaland", "reason": "Injured"}
  ],
  "returnees": [
    {"name": "De Bruyne", "details": "Back from injury"}
  ],
  "managerQuotes": ["Pep said..."],
  "source": "...",
  "updatedAt": "2024-01-15"
}
```

---

## Notification Endpoints

### POST /api/notifications/send

Send push notifications to users. **Requires API key.**

**Headers**:

```
x-api-key: your-notifications-api-key
```

**Request Body**:

```json
{
  "user_id": "uuid",
  "type": "deadline",
  "title": "Deadline Reminder",
  "body": "GW22 deadline in 1 hour!",
  "url": "/team",
  "data": {},
  "criteria": {
    "push_deadline_reminder": true
  }
}
```

**Notification Types**:
| Type | Description |
|------|-------------|
| `deadline` | GW deadline reminder |
| `price_change` | Price rise/fall alert |
| `injury` | Player injury news |
| `transfer_rec` | Transfer recommendations |
| `league_update` | Mini-league updates |

**Response**:

```json
{
  "success": 10,
  "failed": 2,
  "errors": ["User xyz: subscription expired"]
}
```

---

### POST /api/notifications/send-email

Send email notifications to users. **Requires API key.**

**Headers**:

```
x-api-key: your-notifications-api-key
```

**Request Body**:

```json
{
  "to": "user@example.com",
  "type": "deadline",
  "title": "Deadline Reminder",
  "data": {
    "gameweek": 22,
    "deadline": "2024-01-20T11:00:00Z",
    "hoursRemaining": 24,
    "transfers_made": 0,
    "captain": "Haaland"
  }
}
```

**Response**:

```json
{
  "success": true,
  "messageId": "email-123"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

**HTTP Status Codes**:
| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing/invalid API key |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable - External service down |
| 504 | Gateway Timeout - Request timed out |

---

## Rate Limits

Current rate limits (subject to change):

| Endpoint               | Limit                                   |
| ---------------------- | --------------------------------------- |
| `/api/fpl/*`           | No explicit limit (uses FPL API limits) |
| `/api/optimize`        | 10 requests/minute                      |
| `/api/news/*`          | 20 requests/minute                      |
| `/api/notifications/*` | 100 requests/minute                     |

---

## Types Reference

See `lib/fpl/types.ts` for complete TypeScript definitions of all FPL data types.

Key interfaces:

- `BootstrapStatic` - All static FPL data
- `Element` - Player data
- `Team` - Team data
- `Fixture` - Match fixture
- `Gameweek` - Gameweek/event data
- `Entry` - Manager entry
- `EntryPicks` - Manager's GW picks
