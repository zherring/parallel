"use client";

import { useEffect, useState } from "react";
import { getJson, isAbortError } from "@/lib/api-client";
import type { TeamSuggestion, TeamSuggestions } from "@/lib/types";

export type TeamsState = { status: "idle" | "loading" | "hidden" } | { status: "ready"; results: TeamSuggestion[] };

/** Lists per person for this tab. Failures are not kept. */
const cache = new Map<number, TeamSuggestion[]>();

/**
 * Loads the teams of one person from `/api/teams/{id}` (Kevin Bacon mode's "Teams"), only once `enabled`, as
 * `useCollaborators` loads the frequent collaborators: a list already loaded in this tab is returned at once, and any
 * failure is the same as no teams ("hidden"). The first answer for a person can take several seconds.
 */
export function useTeams(personId: number | null, enabled: boolean): TeamsState {
  const [data, setData] = useState<{ personId: number; results: TeamSuggestion[] } | null>(null);

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
