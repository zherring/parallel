"use client";

import { useEffect, useState } from "react";
import { getJson, isAbortError } from "@/lib/api-client";
import type { CollaboratorSuggestion, CollaboratorSuggestions } from "@/lib/types";

export type CollaboratorsState =
  | { status: "idle" | "loading" | "hidden" }
  | { status: "ready"; results: CollaboratorSuggestion[] };

const CACHE_LIMIT = 20;

/** Lists per person for this tab, so coming back to a page does not spend rate limit. Failures are not kept. */
const cache = new Map<number, CollaboratorSuggestion[]>();

function remember(personId: number, results: CollaboratorSuggestion[]) {
  cache.delete(personId);
  cache.set(personId, results);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

/**
 * Loads the frequent collaborators of one person from `/api/collaborators/{id}`, only once
 * `enabled` (the Add a person field has been focused: a visit that never touches the field costs
 * no request) and never during server rendering. A list already loaded for the person in this tab
 * is returned at once. Any failure is the same as no suggestions ("hidden"): the suggestions are
 * a shortcut, so they never show an error. `personId` null means the field has none to offer.
 */
export function useCollaborators(personId: number | null, enabled: boolean): CollaboratorsState {
  // The answer for one person; an answer for another person is stale and ignored.
  const [data, setData] = useState<{ personId: number; results: CollaboratorSuggestion[] } | null>(null);

  useEffect(() => {
    if (personId === null || !enabled || cache.has(personId)) return;
    const controller = new AbortController();
    getJson<CollaboratorSuggestions>(`/api/collaborators/${personId}`, controller.signal).then(
      (body) => {
        if (controller.signal.aborted) return;
        remember(personId, body.results);
        setData({ personId, results: body.results });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setData({ personId, results: [] });
      },
    );
    return () => controller.abort();
  }, [personId, enabled]);

  if (personId === null) return { status: "idle" };
  const results = cache.get(personId) ?? (data?.personId === personId ? data.results : undefined);
  if (results === undefined) return { status: enabled ? "loading" : "idle" };
  return results.length > 0 ? { status: "ready", results } : { status: "hidden" };
}
