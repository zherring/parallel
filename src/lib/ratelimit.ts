export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. */
  retryAfter: number;
}

interface Options {
  limit?: number;
  windowMs?: number;
}

/** Fixed-window limiter held in process memory; fine for a single instance. */
export function createRateLimiter({ limit = 60, windowMs = 60_000 }: Options = {}) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();

  return function check(key: string): RateLimitResult {
    const now = Date.now();

    // Drop expired windows once per window so the map can't grow forever.
    if (now - lastSweep >= windowMs) {
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
      lastSweep = now;
    }

    let w = windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs };
      windows.set(key, w);
    }
    w.count += 1;

    return { allowed: w.count <= limit, retryAfter: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) };
  };
}

/** First hop of x-forwarded-for, which the platform proxy sets. */
export function clientIp(headers: Pick<Headers, "get">): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
