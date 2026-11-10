"use client";

import { useMemo } from "react";
import type { TableRow } from "@/lib/film-rows";
import { heroSubtitle, mainRoleLabels, orderChips, type HeroChip } from "@/lib/pair-hero";
import type { PersonTimeline } from "@/lib/types";

interface PairHeroInput {
  timelines: readonly PersonTimeline[];
  /** The films the page lists (the table's rows): the films the people made together, or one person's films. Their count is the one the pill used to say. */
  rows: readonly TableRow[];
  includeMinor: boolean;
}

/**
 * What the pair hero says that depends on the films shown, the same on every view: the line under the names (each person's main role over the films made
 * together, and the count the table lists) and the film chips in release order.
 */
export function usePairHero({ timelines, rows, includeMinor }: PairHeroInput): { subtitle: string; chips: HeroChip[] } {
  const several = timelines.length > 1;
  const subtitle = useMemo(() => {
    const together = several ? new Set(rows.map((row) => row.id)) : null;
    return heroSubtitle(mainRoleLabels(timelines, together, includeMinor), rows.length, several);
  }, [timelines, rows, includeMinor, several]);
  const chips = useMemo(() => orderChips(rows), [rows]);
  return { subtitle, chips };
}
