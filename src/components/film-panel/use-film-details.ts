"use client";

import { useEffect, useState } from "react";
import { ApiClientError, getJson, isAbortError, type ApiErrorKind } from "@/lib/api-client";
import type { FilmDetails } from "@/lib/types";

const CACHE_LIMIT = 60;

/** Per-session cache (module scope, cleared on reload) so reopening a film is instant. */
const filmCache = new Map<number, FilmDetails>();

function remember(film: FilmDetails) {
  filmCache.delete(film.id);
  filmCache.set(film.id, film);
  if (filmCache.size > CACHE_LIMIT) filmCache.delete(filmCache.keys().next().value!);
}

export type FilmState =
  | { status: "loading" }
  | { status: "error"; error: ApiErrorKind }
  | { status: "success"; film: FilmDetails };

type Settled = { id: number; film: FilmDetails } | { id: number; error: ApiErrorKind };

/**
 * Loads /api/movie/{id}. Cached films resolve on the first render. A change of id (or unmount)
 * aborts the request in flight, so a slow response can never replace a newer film.
 */
export function useFilmDetails(filmId: number): { state: FilmState; retry: () => void } {
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (filmCache.has(filmId)) return;

    const controller = new AbortController();
    getJson<FilmDetails>(`/api/movie/${filmId}`, controller.signal)
      .then((film) => {
        if (controller.signal.aborted) return;
        remember(film);
        setSettled({ id: filmId, film });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setSettled({
          id: filmId,
          error: error instanceof ApiClientError ? error.kind : "server",
        });
      });

    return () => controller.abort();
  }, [filmId, attempt]);

  const cached = filmCache.get(filmId);
  let state: FilmState = { status: "loading" };
  if (cached) state = { status: "success", film: cached };
  else if (settled?.id === filmId && "error" in settled) {
    state = { status: "error", error: settled.error };
  }

  return {
    state,
    retry: () => {
      setSettled(null);
      setAttempt((n) => n + 1);
    },
  };
}
