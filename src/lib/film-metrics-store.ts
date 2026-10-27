/**
 * Browser-side store for /api/film-metrics: what the hover card asks for, kept for the session.
 * Successful results are cached by film id (module scope, cleared on reload); a failure is
 * remembered for FAILURE_MEMORY_MS so a card that keeps reopening on a broken film does not hit
 * the API every time; concurrent requests for a film share one fetch, which is only aborted
 * once every caller has given up.
 */

import { getJson, isAbortError } from "@/lib/api-client";
import type { FilmMetrics } from "@/lib/types";

export const FAILURE_MEMORY_MS = 30_000;
const CACHE_LIMIT = 300;

export type FilmMetricsLookup = { status: "ready"; metrics: FilmMetrics } | { status: "failed" };

const FAILED: FilmMetricsLookup = { status: "failed" };

/** Insertion order is recency order: the first key is the next to go. */
const loaded = new Map<number, FilmMetricsLookup & { status: "ready" }>();
const failedAt = new Map<number, number>();

interface Shared {
  controller: AbortController;
  /** Callers still waiting; the fetch is aborted when the last one leaves. */
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
  } finally {
    if (inflight.get(id)?.controller === controller) inflight.delete(id);
  }
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

  let shared = inflight.get(id);
  if (!shared) {
    const controller = new AbortController();
    shared = { controller, watchers: 0, result: fetchMetrics(id, controller) };
    inflight.set(id, shared);
  }
  const request = shared;
  request.watchers++;

  return new Promise<FilmMetricsLookup>((resolve, reject) => {
    const leave = () => {
      reject(abortError());
      if (--request.watchers > 0) return;
      request.controller.abort();
      if (inflight.get(id) === request) inflight.delete(id);
    };
    signal.addEventListener("abort", leave, { once: true });
    void request.result.then((lookup) => {
      signal.removeEventListener("abort", leave);
      resolve(lookup);
    });
  });
}

/** Forgets everything (tests). */
export function resetFilmMetricsStore(): void {
  for (const request of inflight.values()) request.controller.abort();
  inflight.clear();
  loaded.clear();
  failedAt.clear();
}
