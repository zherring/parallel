/** The longest a single retry waits, however long Retry-After asks for. */
export const MAX_RETRY_WAIT_MS = 10_000;

/**
 * The least time a retry is worth: a retry whose wait leaves less than this before the request's
 * deadline is not made, since an attempt given less would only time out.
 */
export const MIN_ATTEMPT_MS = 1_000;

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

/** Whether a retry that waits `delayMs` first still leaves MIN_ATTEMPT_MS before the deadline `remainingMs` away. */
export function retryFits(delayMs: number, remainingMs: number): boolean {
  return delayMs + MIN_ATTEMPT_MS <= remainingMs;
}

/** Codes Node puts on the error when the connection to the server (not our code) fails. */
const CONNECTION_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
]);
/** undici codes that mean the call itself was wrong or was cancelled by us, not that the connection failed. */
const NOT_A_CONNECTION_FAILURE = new Set([
  "UND_ERR_ABORTED",
  "UND_ERR_INVALID_ARG",
  "UND_ERR_INVALID_RETURN_VALUE",
  "UND_ERR_NOT_SUPPORTED",
]);

/**
 * Whether `error`, thrown by fetch or while reading a body, is the connection to the server
 * failing, which is worth retrying: "timeout" for a connect/headers/body timeout, "network" for
 * any other (reset, refused, DNS, socket closed). undici hides the real error in `cause` of a
 * `TypeError: fetch failed`, so the cause chain is searched for a known `code`. Null for anything
 * else (a bad URL or header, a bug of ours): those must surface as themselves, not as an outage.
 */
export function classifyConnectionError(error: unknown): "timeout" | "network" | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") {
      const connection =
        CONNECTION_CODES.has(code) || (code.startsWith("UND_ERR_") && !NOT_A_CONNECTION_FAILURE.has(code));
      if (connection) return code === "ETIMEDOUT" || code.endsWith("_TIMEOUT") ? "timeout" : "network";
    }
    current = current.cause;
  }
  return null;
}
