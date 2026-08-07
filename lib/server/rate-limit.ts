/**
 * Rate limiter for serverless API routes.
 *
 * Backed by Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set, so the
 * counter is shared across every Vercel lambda instance. Without those vars it
 * degrades to a per-instance in-memory counter, which is enough for local dev
 * but does NOT hold on a multi-instance deploy: each cold lambda starts its own
 * empty map, so concurrent callers each get a fresh budget.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as typeof globalThis & {
  __sudokuRateLimit?: Map<string, Bucket>;
  __sudokuRateLimiters?: Map<string, Ratelimit>;
  __sudokuRedis?: Redis | null;
};

function store(): Map<string, Bucket> {
  if (!globalStore.__sudokuRateLimit) {
    globalStore.__sudokuRateLimit = new Map();
  }
  return globalStore.__sudokuRateLimit;
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const map = store();
  const cur = map.get(key);
  if (!cur || cur.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (cur.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
    };
  }
  cur.count += 1;
  return { ok: true, remaining: limit - cur.count, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
}

function redis(): Redis | null {
  if (globalStore.__sudokuRedis !== undefined) {
    return globalStore.__sudokuRedis;
  }
  // Vercel's Upstash integration injects UPSTASH_REDIS_REST_* on some install
  // paths and KV_REST_API_* on others, so accept either pair.
  const url = (
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  )?.trim();
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  )?.trim();
  globalStore.__sudokuRedis = url && token ? new Redis({ url, token }) : null;
  console.log(
    globalStore.__sudokuRedis
      ? "[rate-limit] using Upstash Redis (shared across instances)"
      : "[rate-limit] no Redis credentials — per-instance in-memory counters only",
  );
  return globalStore.__sudokuRedis;
}

/** One Ratelimit per (limit, window) pair — the window is fixed at construction. */
function limiterFor(client: Redis, limit: number, windowMs: number): Ratelimit {
  if (!globalStore.__sudokuRateLimiters) {
    globalStore.__sudokuRateLimiters = new Map();
  }
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = globalStore.__sudokuRateLimiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms` as `${number} ms`),
      prefix: "sudoku:rl",
      // Short-circuits already-blocked callers without a Redis round trip.
      ephemeralCache: new Map(),
    });
    globalStore.__sudokuRateLimiters.set(cacheKey, limiter);
  }
  return limiter;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const client = redis();
  if (!client) {
    return memoryLimit(key, limit, windowMs);
  }

  try {
    const res = await limiterFor(client, limit, windowMs).limit(key);
    return {
      ok: res.success,
      remaining: Math.max(0, res.remaining),
      retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  } catch (err) {
    // A Redis outage must not take the route down with it.
    console.warn("[rate-limit] redis unavailable, using in-memory fallback", err);
    return memoryLimit(key, limit, windowMs);
  }
}

export function clientKey(req: Request, extra = ""): string {
  // x-forwarded-for is client-settable at the edge, so prefer the headers the
  // platform writes itself and only fall back to the leftmost XFF hop.
  const vercel = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = vercel || real || fwd || "unknown";
  return `${ip}:${extra}`;
}
