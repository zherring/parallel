"use client";

import { useEffect, useState } from "react";
import { loadFilmMetrics, peekFilmMetrics, type FilmMetricsLookup } from "@/lib/film-metrics-store";
import type { FilmMetrics } from "@/lib/types";

/**
 * How long a card must stay open on a film before its metrics are requested. The card opens after
 * its own hover delay and swaps instantly between neighbouring nodes, so a mouse sweeping across a
 * timeline opens many cards; only the ones that stay get a request.
 */
export const METRICS_DWELL_MS = 250;

export type FilmMetricsState =
  | { status: "pending" }
  | { status: "failed" }
  | { status: "ready"; metrics: FilmMetrics };

/**
 * The metrics for the film on an open card. Already-known films (cached for the session, or a
 * failure remembered for 30 s) resolve on the first render with no request. Otherwise the state is
 * "pending" while the card is `enabled`, a request goes out once the film has been on the card for
 * `dwellMs`, and it is aborted if the card closes or moves to another film first.
 */
export function useFilmMetrics(filmId: number, enabled: boolean, dwellMs = METRICS_DWELL_MS): FilmMetricsState {
  const [settled, setSettled] = useState<{ id: number; lookup: FilmMetricsLookup } | null>(null);
  const known = peekFilmMetrics(filmId);
  const isKnown = known !== undefined;

  useEffect(() => {
    if (!enabled || isKnown) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      loadFilmMetrics(filmId, controller.signal).then(
        (lookup) => {
          if (!controller.signal.aborted) setSettled({ id: filmId, lookup });
        },
        () => {}, // aborted: the card closed or moved on
      );
    }, dwellMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filmId, enabled, isKnown, dwellMs]);

  return known ?? (settled?.id === filmId ? settled.lookup : { status: "pending" });
}
