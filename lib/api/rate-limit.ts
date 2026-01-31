import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Rate limit tiers
export type RateLimitTier = "fpl" | "claude" | "notifications";

// Rate limit configurations per tier
const RATE_LIMITS: Record<RateLimitTier, { requests: number; window: string }> =
  {
    // FPL proxy endpoints - more lenient
    fpl: { requests: 100, window: "1 m" },
    // Claude/AI endpoints - expensive, stricter limits
    claude: { requests: 10, window: "1 m" },
    // Notification endpoints - moderate limits
    notifications: { requests: 20, window: "1 m" },
  };

// In-memory fallback storage when Redis is not configured
class InMemoryStore {
  private store = new Map<string, { count: number; resetAt: number }>();

  async get(key: string): Promise<{ count: number; resetAt: number } | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.resetAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async set(
    key: string,
    value: { count: number; resetAt: number },
  ): Promise<void> {
    this.store.set(key, value);
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = await this.get(key);

    if (!entry) {
      await this.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }

    entry.count++;
    await this.set(key, entry);
    return entry.count;
  }

  async getResetTime(key: string): Promise<number> {
    const entry = await this.get(key);
    return entry?.resetAt ?? Date.now();
  }
}

const inMemoryStore = new InMemoryStore();

// Check if Upstash Redis is configured
function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Create Redis-backed rate limiter
function createRedisRateLimiter(tier: RateLimitTier): Ratelimit {
  const config = RATE_LIMITS[tier];
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(
      config.requests,
      config.window as `${number} ${"s" | "m" | "h" | "d"}`,
    ),
    analytics: true,
    prefix: `ratelimit:${tier}`,
  });
}

// In-memory rate limiting fallback
async function checkInMemoryRateLimit(
  identifier: string,
  tier: RateLimitTier,
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const config = RATE_LIMITS[tier];
  const windowMs = parseWindowToMs(config.window);
  const key = `${tier}:${identifier}`;

  const count = await inMemoryStore.increment(key, windowMs);
  const resetAt = await inMemoryStore.getResetTime(key);

  return {
    success: count <= config.requests,
    limit: config.requests,
    remaining: Math.max(0, config.requests - count),
    reset: Math.ceil(resetAt / 1000),
  };
}

// Parse window string to milliseconds
function parseWindowToMs(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return 60000; // Default 1 minute

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case "s":
      return num * 1000;
    case "m":
      return num * 60 * 1000;
    case "h":
      return num * 60 * 60 * 1000;
    case "d":
      return num * 24 * 60 * 60 * 1000;
    default:
      return 60000;
  }
}

// Get client identifier from request
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to a generic identifier (not ideal for production)
  return "anonymous";
}

// Rate limit result type
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  request: NextRequest,
  tier: RateLimitTier,
): Promise<RateLimitResult> {
  const identifier = getClientIdentifier(request);

  if (isRedisConfigured()) {
    const limiter = createRedisRateLimiter(tier);
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // Fallback to in-memory rate limiting
  return checkInMemoryRateLimit(identifier, tier);
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

/**
 * Create a 429 Too Many Requests response
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
): NextResponse {
  const retryAfter = Math.ceil((result.reset * 1000 - Date.now()) / 1000);

  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      code: "RATE_LIMITED",
      retryAfter: Math.max(1, retryAfter),
    },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        "Retry-After": Math.max(1, retryAfter).toString(),
      },
    },
  );
}

/**
 * Rate limit middleware helper
 * Returns null if rate limit is OK, or a 429 response if exceeded
 */
export async function withRateLimit(
  request: NextRequest,
  tier: RateLimitTier,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, tier);

  if (!result.success) {
    return rateLimitExceededResponse(result);
  }

  return null;
}

/**
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  const headers = rateLimitHeaders(result);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
