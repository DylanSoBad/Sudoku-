/**
 * Best-effort in-memory rate limiter for serverless API routes.
 * Not a substitute for Redis/Upstash on multi-instance deploys, but stops
 * casual scripted abuse against a single Vercel instance / warm lambda.
 */

type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as typeof globalThis & {
  __sudokuRateLimit?: Map<string, Bucket>;
};

function store(): Map<string, Bucket> {
  if (!globalStore.__sudokuRateLimit) {
    globalStore.__sudokuRateLimit = new Map();
  }
  return globalStore.__sudokuRateLimit;
}

export function rateLimit(key: string, limit: number, windowMs: number): {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
} {
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

export function clientKey(req: Request, extra = ""): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  const ip = fwd || real || "unknown";
  return `${ip}:${extra}`;
}
