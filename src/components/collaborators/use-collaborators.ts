"use client";

import { useEffect, useState } from "react";
import { getJson, isAbortError } from "@/lib/api-client";
import type { CollaboratorSuggestion, CollaboratorSuggestions } from "@/lib/types";

export type CollaboratorsState =
  | { status: "loading" }
  | { status: "ready"; results: CollaboratorSuggestion[] }
  /** Nothing to show: no suggestions, or the request failed. The block renders nothing at all. */
  | { status: "hidden" };

const CACHE_LIMIT = 20;

/** Lists per person for this tab, so coming back to a page does not spend rate limit. Failures are not kept. */
const cache = new Map<number, CollaboratorSuggestion[]>();

function remember(personId: number, results: CollaboratorSuggestion[]) {
  cache.delete(personId);
  cache.set(personId, results);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
}

/**
 * Loads the frequent collaborators of one person from `/api/collaborators/{id}` once the page is
 * on screen (never during server rendering). Any failure is the same as no suggestions: the
 * suggestions are a shortcut, so they never show an error.
 */
export function useCollaborators(personId: number): CollaboratorsState {
  // The answer for one person; an answer for another person is stale and ignored.
  const [data, setData] = useState<{ personId: number; results: CollaboratorSuggestion[] } | null>(null);

  useEffect(() => {
    if (cache.has(personId)) return;
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
  }, [personId]);

  const results = cache.get(personId) ?? (data?.personId === personId ? data.results : undefined);
  if (results === undefined) return { status: "loading" };
  return results.length > 0 ? { status: "ready", results } : { status: "hidden" };
}
