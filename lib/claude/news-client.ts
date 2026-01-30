/**
 * Claude-powered FPL news search client
 * Uses Claude's web search capability to fetch real-time FPL news
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  NewsItem,
  NewsSearchRequest,
  NewsSearchResponse,
  NewsCategory,
  InjuryUpdate,
  TeamNewsUpdate,
} from "./news-types";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8000;

// Simple in-memory cache with TTL
const newsCache = new Map<
  string,
  { data: NewsSearchResponse; expiry: number }
>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Deduplication cache - stores fingerprints of seen news items
const seenItemsCache = new Map<string, number>(); // fingerprint -> timestamp
const DEDUPE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Generate a fingerprint for a news item based on its content
 * Uses normalized text to detect similar articles
 */
function generateFingerprint(item: {
  title: string;
  players?: string[];
  teams?: string[];
  category?: string;
}): string {
  // Normalize title: lowercase, remove punctuation, collapse whitespace
  const normalizedTitle = item.title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Extract key terms (first 5 words of title)
  const keyTerms = normalizedTitle.split(" ").slice(0, 5).join(" ");

  // Include players and category for more precise matching
  const players = (item.players || [])
    .map((p) => p.toLowerCase())
    .sort()
    .join(",");
  const category = item.category || "general";

  return `${keyTerms}|${players}|${category}`;
}

/**
 * Check if a news item is a duplicate based on content similarity
 */
function isDuplicate(item: NewsItem): boolean {
  const fingerprint = generateFingerprint(item);

  // Check exact fingerprint match
  if (seenItemsCache.has(fingerprint)) {
    return true;
  }

  // Also check for similar fingerprints (Jaccard similarity on key terms)
  const itemTerms = new Set(fingerprint.split("|")[0].split(" "));
  for (const [cachedFingerprint, timestamp] of seenItemsCache.entries()) {
    // Skip expired entries
    if (Date.now() - timestamp > DEDUPE_WINDOW_MS) {
      seenItemsCache.delete(cachedFingerprint);
      continue;
    }

    const cachedTerms = new Set(cachedFingerprint.split("|")[0].split(" "));

    // Calculate Jaccard similarity
    const intersection = new Set(
      [...itemTerms].filter((x) => cachedTerms.has(x)),
    );
    const union = new Set([...itemTerms, ...cachedTerms]);
    const similarity = intersection.size / union.size;

    // If >70% similar and same players, consider duplicate
    if (similarity > 0.7) {
      const cachedPlayers = cachedFingerprint.split("|")[1];
      const itemPlayers = fingerprint.split("|")[1];
      if (
        cachedPlayers === itemPlayers ||
        cachedPlayers.includes(itemPlayers) ||
        itemPlayers.includes(cachedPlayers)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Mark an item as seen for deduplication
 */
function markAsSeen(item: NewsItem): void {
  const fingerprint = generateFingerprint(item);
  seenItemsCache.set(fingerprint, Date.now());

  // Clean up old entries periodically (keep max 500 entries)
  if (seenItemsCache.size > 500) {
    const now = Date.now();
    for (const [key, timestamp] of seenItemsCache.entries()) {
      if (now - timestamp > DEDUPE_WINDOW_MS) {
        seenItemsCache.delete(key);
      }
    }
  }
}

/**
 * Deduplicate a list of news items
 */
function deduplicateItems(items: NewsItem[]): NewsItem[] {
  const uniqueItems: NewsItem[] = [];

  for (const item of items) {
    if (!isDuplicate(item)) {
      uniqueItems.push(item);
      markAsSeen(item);
    }
  }

  return uniqueItems;
}

function getCacheKey(request: NewsSearchRequest): string {
  return JSON.stringify({
    query: request.query,
    players: request.players?.sort(),
    teams: request.teams?.sort(),
    categories: request.categories?.sort(),
  });
}

function getFromCache(key: string): NewsSearchResponse | null {
  const entry = newsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    newsCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NewsSearchResponse): void {
  // Limit cache size
  if (newsCache.size > 50) {
    const oldestKey = newsCache.keys().next().value;
    if (oldestKey) newsCache.delete(oldestKey);
  }
  newsCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

/**
 * Search for FPL-related news using Claude with web search
 */
export async function searchFPLNews(
  request: NewsSearchRequest,
): Promise<NewsSearchResponse> {
  const cacheKey = getCacheKey(request);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  // Build search query
  const searchQuery = buildSearchQuery(request);

  // Call Claude with web search
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
    ],
    messages: [
      {
        role: "user",
        content: buildNewsPrompt(searchQuery, request),
      },
    ],
  });

  // Parse response
  const items = parseNewsResponse(response);

  const result: NewsSearchResponse = {
    items,
    searchQuery,
    timestamp: new Date().toISOString(),
    cached: false,
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get injury updates for specific players or all flagged players
 */
export async function getInjuryUpdates(
  players?: string[],
): Promise<InjuryUpdate[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  const playerList = players?.length
    ? players.join(", ")
    : "Premier League players with current injuries or doubts";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Search for the latest injury news for: ${playerList}

For each injured/doubtful player found, provide:
1. Player name and team
2. Current status (injured, doubtful, fit, suspended)
3. Injury details
4. Expected return date if known
5. Source of information

Respond with a JSON array:
[
  {
    "playerName": "Player Name",
    "team": "Team Name",
    "status": "injured|doubtful|fit|suspended|unknown",
    "details": "Description of injury/issue",
    "expectedReturn": "GW25" or null,
    "source": "Source name",
    "updatedAt": "2025-01-29"
  }
]

Only include players with actual injury/fitness concerns. Focus on Fantasy Premier League relevance.`,
      },
    ],
  });

  return parseInjuryResponse(response);
}

/**
 * Get team news and predicted lineups for upcoming gameweek
 */
export async function getTeamNews(
  team: string,
  gameweek: number,
): Promise<TeamNewsUpdate | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Search for the latest team news for ${team} ahead of Premier League Gameweek ${gameweek}.

Look for:
1. Press conference updates
2. Injury news
3. Suspension news
4. Predicted lineup hints
5. Players returning from injury

Respond with JSON:
{
  "team": "${team}",
  "gameweek": ${gameweek},
  "predictedLineup": ["Player1", "Player2", ...] or null if unknown,
  "absentPlayers": [{"name": "Player", "reason": "Injury/Suspension"}],
  "returnees": [{"name": "Player", "details": "Back from knee injury"}],
  "managerQuotes": ["Relevant quote about team selection"],
  "source": "Source name",
  "updatedAt": "2025-01-29"
}

Focus on information relevant to Fantasy Premier League managers.`,
      },
    ],
  });

  return parseTeamNewsResponse(response);
}

function buildSearchQuery(request: NewsSearchRequest): string {
  const parts: string[] = [];

  if (request.query) {
    parts.push(request.query);
  }

  if (request.players?.length) {
    parts.push(`players: ${request.players.join(", ")}`);
  }

  if (request.teams?.length) {
    parts.push(`teams: ${request.teams.join(", ")}`);
  }

  if (request.categories?.length) {
    const categoryTerms = request.categories.map((c) => {
      switch (c) {
        case "injury":
          return "injury news";
        case "transfer":
          return "transfer news";
        case "team_news":
          return "team news lineup";
        case "press_conference":
          return "press conference";
        case "suspension":
          return "suspension ban";
        default:
          return c;
      }
    });
    parts.push(categoryTerms.join(" OR "));
  }

  if (parts.length === 0) {
    parts.push("Premier League FPL news");
  }

  return parts.join(" - ");
}

function buildNewsPrompt(
  searchQuery: string,
  request: NewsSearchRequest,
): string {
  const maxResults = request.maxResults ?? 10;

  return `Search for the latest Fantasy Premier League news related to: "${searchQuery}"

Focus on:
- Player injury updates and fitness concerns
- Press conference quotes about team selection
- Suspension and disciplinary news
- Transfer rumors affecting current Premier League players
- Team news and lineup hints

For each relevant news item, extract:
1. Title (clear, concise headline)
2. Summary (2-3 sentences with key facts)
3. Category (injury, transfer, team_news, press_conference, suspension, general)
4. Players mentioned
5. Teams involved
6. Source name and URL
7. How it impacts FPL (positive, negative, neutral)
8. Relevance score (0-100, how important for FPL managers)

Return up to ${maxResults} most relevant items as JSON:
{
  "items": [
    {
      "id": "unique-id-string",
      "title": "Clear headline",
      "summary": "2-3 sentence summary with key facts",
      "category": "injury|transfer|team_news|press_conference|suspension|general",
      "players": ["Player Name"],
      "teams": ["Team Name"],
      "source": "Source Name",
      "sourceUrl": "https://...",
      "publishedAt": "2025-01-29T10:00:00Z",
      "relevanceScore": 85,
      "fplImpact": "positive|negative|neutral|unknown",
      "impactDetails": "Brief explanation of FPL impact"
    }
  ]
}

Only include news from the last 48 hours. Prioritize by FPL relevance.`;
}

function parseNewsResponse(response: Anthropic.Message): NewsItem[] {
  // Find text content in response
  let textContent = "";
  for (const block of response.content) {
    if (block.type === "text") {
      textContent = block.text;
      break;
    }
  }

  if (!textContent) return [];

  // Extract JSON from response
  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [
    null,
    textContent,
  ];
  const jsonStr = jsonMatch[1]?.trim() || textContent.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    const items = parsed.items || parsed || [];

    // Validate and normalize items
    const normalizedItems = items
      .filter((item: Record<string, unknown>) => item.title && item.summary)
      .map((item: Record<string, unknown>) => ({
        id:
          item.id ||
          `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: String(item.title),
        summary: String(item.summary),
        category: validateCategory(item.category as string),
        players: Array.isArray(item.players) ? item.players.map(String) : [],
        teams: Array.isArray(item.teams) ? item.teams.map(String) : [],
        source: String(item.source || "Unknown"),
        sourceUrl: String(item.sourceUrl || ""),
        publishedAt: String(item.publishedAt || new Date().toISOString()),
        fetchedAt: new Date().toISOString(),
        relevanceScore: Number(item.relevanceScore) || 50,
        fplImpact: validateImpact(item.fplImpact as string),
        impactDetails: item.impactDetails
          ? String(item.impactDetails)
          : undefined,
      }));

    // Apply deduplication to remove similar articles
    return deduplicateItems(normalizedItems);
  } catch {
    console.error("Failed to parse news response");
    return [];
  }
}

function parseInjuryResponse(response: Anthropic.Message): InjuryUpdate[] {
  let textContent = "";
  for (const block of response.content) {
    if (block.type === "text") {
      textContent = block.text;
      break;
    }
  }

  if (!textContent) return [];

  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [
    null,
    textContent,
  ];
  const jsonStr = jsonMatch[1]?.trim() || textContent.trim();

  try {
    const items = JSON.parse(jsonStr);
    return (Array.isArray(items) ? items : []).map(
      (item: Record<string, unknown>) => ({
        playerName: String(item.playerName || ""),
        team: String(item.team || ""),
        status: validateStatus(item.status as string),
        details: String(item.details || ""),
        expectedReturn: item.expectedReturn
          ? String(item.expectedReturn)
          : undefined,
        source: String(item.source || "Unknown"),
        updatedAt: String(item.updatedAt || new Date().toISOString()),
      }),
    );
  } catch {
    return [];
  }
}

function parseTeamNewsResponse(
  response: Anthropic.Message,
): TeamNewsUpdate | null {
  let textContent = "";
  for (const block of response.content) {
    if (block.type === "text") {
      textContent = block.text;
      break;
    }
  }

  if (!textContent) return null;

  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [
    null,
    textContent,
  ];
  const jsonStr = jsonMatch[1]?.trim() || textContent.trim();

  try {
    const item = JSON.parse(jsonStr);
    return {
      team: String(item.team || ""),
      gameweek: Number(item.gameweek) || 0,
      predictedLineup: Array.isArray(item.predictedLineup)
        ? item.predictedLineup.map(String)
        : undefined,
      absentPlayers: Array.isArray(item.absentPlayers)
        ? item.absentPlayers.map((p: Record<string, unknown>) => ({
            name: String(p.name || ""),
            reason: String(p.reason || ""),
          }))
        : [],
      returnees: Array.isArray(item.returnees)
        ? item.returnees.map((p: Record<string, unknown>) => ({
            name: String(p.name || ""),
            details: String(p.details || ""),
          }))
        : [],
      managerQuotes: Array.isArray(item.managerQuotes)
        ? item.managerQuotes.map(String)
        : undefined,
      source: String(item.source || "Unknown"),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

function validateCategory(category: string): NewsCategory {
  const valid: NewsCategory[] = [
    "injury",
    "transfer",
    "team_news",
    "press_conference",
    "suspension",
    "general",
  ];
  return valid.includes(category as NewsCategory)
    ? (category as NewsCategory)
    : "general";
}

function validateImpact(
  impact: string,
): "positive" | "negative" | "neutral" | "unknown" {
  const valid = ["positive", "negative", "neutral", "unknown"];
  return valid.includes(impact)
    ? (impact as "positive" | "negative" | "neutral" | "unknown")
    : "unknown";
}

function validateStatus(
  status: string,
): "injured" | "doubtful" | "fit" | "suspended" | "unknown" {
  const valid = ["injured", "doubtful", "fit", "suspended", "unknown"];
  return valid.includes(status)
    ? (status as "injured" | "doubtful" | "fit" | "suspended" | "unknown")
    : "unknown";
}

/**
 * Clear all caches (useful for testing or manual refresh)
 */
export function clearNewsCaches(): void {
  newsCache.clear();
  seenItemsCache.clear();
}

/**
 * Get deduplication cache stats (for debugging)
 */
export function getDeduplicationStats(): {
  seenItemsCount: number;
  newsCacheCount: number;
} {
  return {
    seenItemsCount: seenItemsCache.size,
    newsCacheCount: newsCache.size,
  };
}
