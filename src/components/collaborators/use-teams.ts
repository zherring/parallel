"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson, isAbortError } from "@/lib/api-client";
import type { TeamSuggestion, TeamSuggestions } from "@/lib/types";

export type TeamsState =
  | { status: "idle" | "loading" | "hidden" }
  | { status: "ready"; results: TeamSuggestion[] }
  /** The request failed: `retry` asks again. */
  | { status: "error"; retry: () => void };

/** Lists per person for this tab. Failures are not kept. */
const cache = new Map<number, TeamSuggestion[]>();

/**
 * Loads the teams of one person from `/api/teams/{id}` (Kevin Bacon mode's "Teams"), only once `enabled`, as
 * `useCollaborators` loads the frequent collaborators: a list already loaded in this tab is returned at once. Unlike the
 * collaborators, a shortcut that hides when it fails, the teams are what the mode is known for: a failure is "error" (the
 * field says so, and `retry` asks again), and only a person with no teams is "hidden". The first answer for a person can take several seconds.
 */
export function useTeams(personId: number | null, enabled: boolean): TeamsState {
  // The answer for one person (an answer for another person is stale and ignored); null results is a failure.
  const [data, setData] = useState<{ personId: number; results: TeamSuggestion[] | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setData(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (personId === null || !enabled || cache.has(personId)) return;
    const controller = new AbortController();
    getJson<TeamSuggestions>(`/api/teams/${personId}`, controller.signal).then(
      (body) => {
        if (controller.signal.aborted) return;
        cache.set(personId, body.results);
        setData({ personId, results: body.results });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setData({ personId, results: null });
      },
    );
    return () => {
      controller.abort();
      // A failure is the answer of the request that ended with it: whoever asks next (the mode entered again) starts from loading.
      setData((now) => (now?.results === null ? null : now));
    };
  }, [personId, enabled, attempt]);

  if (personId === null) return { status: "idle" };
  const answer = data?.personId === personId ? data.results : undefined;
  const results = cache.get(personId) ?? answer;
  if (results === null) return { status: "error", retry };
  if (results === undefined) return { status: enabled ? "loading" : "idle" };
  return results.length > 0 ? { status: "ready", results } : { status: "hidden" };
}
