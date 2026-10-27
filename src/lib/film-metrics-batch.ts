/**
 * The contract of `GET /api/film-metrics?ids=1,2,3`, shared by the route (which validates the
 * query) and the browser store (which builds it). Pure, so the rules are testable on their own.
 */

/** Most films one request may ask for; the client chunks longer lists. */
export const MAX_BATCH_IDS = 50;
/** TMDB ids as the single-film route accepts them: positive integers of at most ten digits. */
const MOVIE_ID = /^[1-9]\d{0,9}$/;
/** Longest `ids` value worth parsing: MAX_BATCH_IDS full-width ids and their commas, with a little slack. */
const MAX_RAW_LENGTH = MAX_BATCH_IDS * 11 + 16;

export type IdListResult = { ok: true; ids: number[] } | { ok: false; error: string };

/**
 * The film ids in an `ids` query value: comma separated positive integers, deduplicated in the
 * order given. Anything else (missing, empty, a stray comma, a non-integer, more than
 * MAX_BATCH_IDS distinct ids) is an error with a message safe to send back.
 */
export function parseIdList(raw: string | null): IdListResult {
  if (raw === null || raw.length === 0) return { ok: false, error: "ids is required" };
  if (raw.length > MAX_RAW_LENGTH) return { ok: false, error: `ids must list at most ${MAX_BATCH_IDS} films` };

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const token of raw.split(",")) {
    if (!MOVIE_ID.test(token)) return { ok: false, error: "ids must be comma separated positive integers" };
    const id = Number(token);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (ids.length > MAX_BATCH_IDS) return { ok: false, error: `ids must list at most ${MAX_BATCH_IDS} films` };
  return { ok: true, ids };
}

/**
 * Splits a list of ids into requests of at most MAX_BATCH_IDS, each in ascending order so the same
 * set of films always produces the same URL (and so the same entry in shared caches).
 */
export function batchChunks(ids: readonly number[]): number[][] {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const chunks: number[][] = [];
  for (let start = 0; start < sorted.length; start += MAX_BATCH_IDS) {
    chunks.push(sorted.slice(start, start + MAX_BATCH_IDS));
  }
  return chunks;
}

export const batchUrl = (ids: readonly number[]): string => `/api/film-metrics?ids=${ids.join(",")}`;
