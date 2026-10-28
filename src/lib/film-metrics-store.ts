/**
 * Browser-side store for /api/film-metrics: what the hover card and the "films together" table
 * ask for, kept for the session. Successful results are cached by film id (module scope, cleared
 * on reload); a failure is remembered for FAILURE_MEMORY_MS so a card that keeps reopening on a
 * broken film does not hit the API every time; concurrent requests for a film share one fetch,
 * which is only aborted once every caller has given up. The table asks for many films in one
 * batch request and fills the same per-film cache, so the cards of those films open instantly.
 */

import { getJson, isAbortError } from "@/lib/api-client";
import { batchChunks, batchUrl } from "@/lib/film-metrics-batch";
import type { FilmMetrics } from "@/lib/types";

export const FAILURE_MEMORY_MS = 30_000;
const CACHE_LIMIT = 300;

export type FilmMetricsLookup = { status: "ready"; metrics: FilmMetrics } | { status: "failed" };

const FAILED: FilmMetricsLookup = { status: "failed" };

/** Insertion order is recency order: the first key is the next to go. */
const loaded = new Map<number, FilmMetricsLookup & { status: "ready" }>();
const failedAt = new Map<number, number>();

interface Shared {
  /** Stops the fetch behind this film; a batch fetch stops only once every film in it has been given up on. */
  cancel: () => void;
  /** Callers still waiting; `cancel` runs when the last one leaves. */
  watchers: number;
  result: Promise<FilmMetricsLookup>;
}
const inflight = new Map<number, Shared>();

function abortError(): DOMException {
  return new DOMException("The request was aborted", "AbortError");
}

function remember(id: number, metrics: FilmMetrics): FilmMetricsLookup {
  const entry = { status: "ready", metrics } as const;
  loaded.delete(id);
  loaded.set(id, entry);
  if (loaded.size > CACHE_LIMIT) loaded.delete(loaded.keys().next().value!);
  failedAt.delete(id);
  return entry;
}

/** What is already known about a film without asking: its cached metrics or a remembered failure. */
export function peekFilmMetrics(id: number): FilmMetricsLookup | undefined {
  const entry = loaded.get(id);
  if (entry) return entry;

  const failed = failedAt.get(id);
  if (failed === undefined) return undefined;
  if (Date.now() - failed < FAILURE_MEMORY_MS) return FAILED;
  failedAt.delete(id);
  return undefined;
}

async function fetchMetrics(id: number, controller: AbortController): Promise<FilmMetricsLookup> {
  try {
    return remember(id, await getJson<FilmMetrics>(`/api/film-metrics/${id}`, controller.signal));
  } catch (error) {
    // An abort is the caller leaving, not the film failing: remember nothing.
    if (!controller.signal.aborted && !isAbortError(error)) failedAt.set(id, Date.now());
    return FAILED;
  }
}

/** Registers `shared` as the fetch for `id` until it settles. */
function track(id: number, shared: Shared): void {
  inflight.set(id, shared);
  void shared.result.then(() => {
    if (inflight.get(id) === shared) inflight.delete(id);
  });
}

function startSingle(id: number): Shared {
  const controller = new AbortController();
  const shared: Shared = { cancel: () => controller.abort(), watchers: 0, result: fetchMetrics(id, controller) };
  track(id, shared);
  return shared;
}

/** One request for `ids`. A film the response has no body for (null) is remembered as failed, like a 404. */
async function fetchBatch(ids: number[], controller: AbortController): Promise<Map<number, FilmMetricsLookup>> {
  const lookups = new Map<number, FilmMetricsLookup>();
  try {
    const body = await getJson<{ results?: Record<string, FilmMetrics | null> }>(batchUrl(ids), controller.signal);
    const results = body?.results;
    if (!results || typeof results !== "object") throw new Error("Malformed batch response");
    for (const id of ids) {
      const metrics = results[String(id)];
      if (metrics && typeof metrics === "object") {
        lookups.set(id, remember(id, metrics));
      } else {
        failedAt.set(id, Date.now());
        lookups.set(id, FAILED);
      }
    }
  } catch (error) {
    // Same rule as a single fetch: an abort is the callers leaving, so remember nothing.
    if (!controller.signal.aborted && !isAbortError(error)) {
      for (const id of ids) failedAt.set(id, Date.now());
    }
    for (const id of ids) lookups.set(id, FAILED);
  }
  return lookups;
}

/** Starts one batch request for `ids` and registers it as the in-flight fetch of each of them. */
function startBatch(ids: number[]): void {
  const controller = new AbortController();
  let live = ids.length;
  const cancel = () => {
    if (--live === 0) controller.abort();
  };
  const fetched = fetchBatch(ids, controller);
  for (const id of ids) {
    track(id, { cancel, watchers: 0, result: fetched.then((lookups) => lookups.get(id) ?? FAILED) });
  }
}

/** Registers `leave` to run when the caller gives up; returns the function that unregisters it. */
type AbortRegistrar = (leave: () => void) => () => void;

/** Waits for the in-flight fetch `request` of `id` as one more caller. */
function watch(id: number, request: Shared, onAbort: AbortRegistrar): Promise<FilmMetricsLookup> {
  request.watchers++;
  return new Promise<FilmMetricsLookup>((resolve, reject) => {
    const unregister = onAbort(() => {
      reject(abortError());
      if (--request.watchers > 0) return;
      request.cancel();
      if (inflight.get(id) === request) inflight.delete(id);
    });
    void request.result.then((lookup) => {
      unregister();
      resolve(lookup);
    });
  });
}

/**
 * The metrics for a film: from the cache or a remembered failure at once, otherwise from the
 * API (one shared fetch per film, however many callers). Failures resolve to `{ status: "failed" }`
 * rather than rejecting. Aborting `signal` rejects with an AbortError and, when no other caller
 * is waiting for the film, cancels the fetch.
 */
export function loadFilmMetrics(id: number, signal: AbortSignal): Promise<FilmMetricsLookup> {
  const known = peekFilmMetrics(id);
  if (known) return Promise.resolve(known);
  if (signal.aborted) return Promise.reject(abortError());

  return watch(id, inflight.get(id) ?? startSingle(id), (leave) => {
    signal.addEventListener("abort", leave, { once: true });
    return () => signal.removeEventListener("abort", leave);
  });
}

/**
 * The metrics for many films with as few requests as possible: what is cached (or a remembered
 * failure) comes back at once, films already being fetched are joined, and the rest go out in
 * one request per MAX_BATCH_IDS films. Every film that comes back is stored for the session, so
 * `loadFilmMetrics` and the hover cards answer for it without a request. Resolves with a lookup
 * per film (failures are `{ status: "failed" }`, never a rejection). Aborting `signal` rejects
 * with an AbortError and cancels each request that no other caller is waiting on.
 */
export async function loadFilmMetricsBatch(
  ids: readonly number[],
  signal: AbortSignal,
): Promise<Map<number, FilmMetricsLookup>> {
  const unique = [...new Set(ids)];
  const unknown = unique.filter((id) => !peekFilmMetrics(id));
  if (unknown.length > 0 && signal.aborted) throw abortError();

  for (const chunk of batchChunks(unknown.filter((id) => !inflight.has(id)))) startBatch(chunk);

  // One listener for the whole batch: a long list must not pile listeners onto the caller's signal.
  const leaves = new Set<() => void>();
  const onAbort = () => [...leaves].forEach((leave) => leave());
  signal.addEventListener("abort", onAbort, { once: true });
  const registrar: AbortRegistrar = (leave) => {
    leaves.add(leave);
    return () => leaves.delete(leave);
  };

  try {
    const lookups = await Promise.all(
      unique.map(async (id): Promise<[number, FilmMetricsLookup]> => {
        const known = peekFilmMetrics(id);
        return [id, known ?? (await watch(id, inflight.get(id) ?? startSingle(id), registrar))];
      }),
    );
    return new Map(lookups);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

/** Forgets everything (tests). */
export function resetFilmMetricsStore(): void {
  for (const request of inflight.values()) request.cancel();
  inflight.clear();
  loaded.clear();
  failedAt.clear();
}
