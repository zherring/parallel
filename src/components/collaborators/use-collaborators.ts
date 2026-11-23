"use client";

import { useEffect, useState } from "react";
import { getJson, isAbortError } from "@/lib/api-client";
import type { CollaboratorSuggestion, CollaboratorSuggestions } from "@/lib/types";

export type CollaboratorsState =
  | { status: "idle" | "loading" | "hidden" }
  | { status: "ready"; results: CollaboratorSuggestion[] };

const CACHE_LIMIT = 20;

/** Lists per person (and per `fill`) for this tab, so coming back to a page does not spend rate limit. Failures are not kept. */
const cache = new Map<string, CollaboratorSuggestion[]>();

/** A list asked to be filled is not the graph's list for the same person: each is kept under its own key, as the server keeps them under their own addresses. */
const cacheKey = (personId: number, fill: number | undefined) => (fill ? `${personId}+fill${fill}` : String(personId));

function remember(key: string, results: CollaboratorSuggestion[]) {
  cache.delete(key);
  cache.set(key, results);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

/**
 * Loads the frequent collaborators of one person from `/api/collaborators/{id}`, only once
 * `enabled` (the Add a person field has been focused: a visit that never touches the field costs
 * no request) and never during server rendering. A list already loaded for the person in this tab
 * is returned at once. Any failure is the same as no suggestions ("hidden"): the suggestions are
 * a shortcut, so they never show an error. `personId` null means the field has none to offer.
 *
 * `fill` asks the server to make the list at least that long (`?fill=`, see the route), which costs up to 80 credit
 * requests on a cold cache and which the server only does for the people a mode is about: leave it out unless the
 * list is Kevin Bacon mode's.
 */
export function useCollaborators(personId: number | null, enabled: boolean, fill?: number): CollaboratorsState {
  const key = personId === null ? null : cacheKey(personId, fill);
  // The answer for one list; an answer for another person (or another fill) is stale and ignored.
  const [data, setData] = useState<{ key: string; results: CollaboratorSuggestion[] } | null>(null);

  useEffect(() => {
    if (personId === null || key === null || !enabled || cache.has(key)) return;
    const controller = new AbortController();
    getJson<CollaboratorSuggestions>(`/api/collaborators/${personId}${fill ? `?fill=${fill}` : ""}`, controller.signal).then(
      (body) => {
        if (controller.signal.aborted) return;
        remember(key, body.results);
        setData({ key, results: body.results });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setData({ key, results: [] });
      },
    );
    return () => controller.abort();
  }, [personId, key, fill, enabled]);

  if (personId === null || key === null) return { status: "idle" };
  const results = cache.get(key) ?? (data?.key === key ? data.results : undefined);
  if (results === undefined) return { status: enabled ? "loading" : "idle" };
  return results.length > 0 ? { status: "ready", results } : { status: "hidden" };
}
