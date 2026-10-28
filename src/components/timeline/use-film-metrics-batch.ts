"use client";

import { useEffect, useMemo, useState } from "react";
import { loadFilmMetricsBatch, peekFilmMetrics } from "@/lib/film-metrics-store";
import type { FilmMetrics } from "@/lib/types";
import type { FilmMetricsState } from "./use-film-metrics";

/**
 * idle     - nothing asked for yet (the table has not come near the screen)
 * loading  - some films are still being fetched
 * ready    - every film is settled and at least one has metrics
 * failed   - every film is settled and none has metrics (the request failed)
 */
export type FilmMetricsBatchStatus = "idle" | "loading" | "ready" | "failed";

export interface FilmMetricsBatch {
  status: FilmMetricsBatchStatus;
  /** Films that have settled: their metrics, or null when there are none (a failure or an unknown film). Films still loading are absent. */
  metrics: ReadonlyMap<number, FilmMetrics | null>;
  /** One film's state in the hover card's terms: pending, failed or ready. */
  stateFor: (id: number) => FilmMetricsState;
}

const NONE: ReadonlyMap<number, FilmMetrics | null> = new Map();
const PENDING: FilmMetricsState = { status: "pending" };
const FAILED: FilmMetricsState = { status: "failed" };

/**
 * The metrics of a list of films, fetched with one batch request once `enabled` (and only for
 * films not already known: a hover card may have loaded some, and the batch fills the cache the
 * cards read, so they open instantly afterwards). Changing the list, as the minor-credits toggle
 * does, asks only for the new films. The request is cancelled if the list changes or the
 * component unmounts first. A film that failed stays failed for as long as the component lives,
 * so a broken request never loops.
 */
export function useFilmMetricsBatch(ids: readonly number[], enabled: boolean): FilmMetricsBatch {
  const [fetched, setFetched] = useState<ReadonlyMap<number, FilmMetrics | null>>(NONE);

  const metrics = useMemo(() => {
    const settled = new Map<number, FilmMetrics | null>();
    for (const id of ids) {
      if (fetched.has(id)) {
        settled.set(id, fetched.get(id) ?? null);
        continue;
      }
      const known = peekFilmMetrics(id);
      if (known) settled.set(id, known.status === "ready" ? known.metrics : null);
    }
    return settled;
  }, [ids, fetched]);

  useEffect(() => {
    if (!enabled) return;
    const missing = ids.filter((id) => !metrics.has(id));
    if (missing.length === 0) return;

    const controller = new AbortController();
    loadFilmMetricsBatch(missing, controller.signal).then(
      (lookups) => {
        if (controller.signal.aborted) return;
        setFetched((previous) => {
          const next = new Map(previous);
          for (const [id, lookup] of lookups) next.set(id, lookup.status === "ready" ? lookup.metrics : null);
          return next;
        });
      },
      () => {}, // aborted: the list changed or the table went away
    );
    return () => controller.abort();
  }, [ids, enabled, metrics]);

  const status = useMemo((): FilmMetricsBatchStatus => {
    if (ids.length === 0) return "ready";
    let anyReady = false;
    let anyPending = false;
    for (const id of ids) {
      if (!metrics.has(id)) anyPending = true;
      else if (metrics.get(id)) anyReady = true;
    }
    if (anyPending) return enabled ? "loading" : "idle";
    return anyReady ? "ready" : "failed";
  }, [ids, metrics, enabled]);

  // One state object per film, kept while the film's metrics do not change, so rows can be memoised on it.
  const stateFor = useMemo(() => {
    const states = new Map<number, FilmMetricsState>();
    for (const [id, film] of metrics) states.set(id, film ? { status: "ready", metrics: film } : FAILED);
    return (id: number): FilmMetricsState => states.get(id) ?? PENDING;
  }, [metrics]);

  return { status, metrics, stateFor };
}
