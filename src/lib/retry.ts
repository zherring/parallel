/** The longest a single retry waits, however long Retry-After asks for. */
export const MAX_RETRY_WAIT_MS = 10_000;

/** Waits before the 2nd and the 3rd attempt when TMDB gave no Retry-After. */
const BACKOFF_MS = [500, 1500] as const;
/** Backoff is spread over +/-25% so clients that failed together do not retry together. */
const JITTER = 0.25;

/**
 * The wait a Retry-After header asks for, in ms: either a number of seconds or an HTTP date.
 * Null when the header is missing, unreadable, or asks for no wait at all. Not capped here.
 */
export function parseRetryAfterMs(header: string | null | undefined, now: number): number | null {
  const value = header?.trim();
  if (!value) return null;
  const ms = /^\d+(\.\d+)?$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * How long to wait after failed attempt number `attempt` (1-based) before the next one: what
 * Retry-After asks for, capped at MAX_RETRY_WAIT_MS, else exponential backoff (about 500ms, then
 * 1500ms) with jitter. `random` is injectable for tests.
 */
export function retryDelayMs(
  attempt: number,
  retryAfter: string | null | undefined,
  now: number,
  random: () => number = Math.random,
): number {
  const asked = parseRetryAfterMs(retryAfter, now);
  if (asked !== null) return Math.min(Math.ceil(asked), MAX_RETRY_WAIT_MS);
  const base = BACKOFF_MS[Math.min(Math.max(attempt, 1), BACKOFF_MS.length) - 1];
  return Math.round(base * (1 - JITTER + 2 * JITTER * random()));
}
