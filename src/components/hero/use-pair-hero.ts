"use client";

import { useMemo } from "react";
import type { TableRow } from "@/lib/film-rows";
import { activeYears, bestKnownChips, heroSubtitle, mainRoleLabels, orderChips, soloRolesLabel, type HeroChip } from "@/lib/pair-hero";
import type { PersonTimeline } from "@/lib/types";

interface PairHeroInput {
  timelines: readonly PersonTimeline[];
  /** The films the page lists (the table's rows): the films the people made together, or one person's films. Their count is the one the pill used to say. */
  rows: readonly TableRow[];
  includeMinor: boolean;
  /** yyyy-mm-dd (UTC), from the server: the years a person has been active end with the last film that is out. */
  today: string;
}

/**
 * What the pair hero says that depends on the films shown, the same on every view: the line under the names and the film chips. For a pair: each person's main role over
 * the films made together and the count the table lists, and the chips in release order. For one person, whose masthead this is: their main roles, the years they have
 * been active and the count the table lists ("Director, Actor · 1966–2005 · 31 films"), and their best-known films first.
 */
export function usePairHero({ timelines, rows, includeMinor, today }: PairHeroInput): { subtitle: string; chips: HeroChip[] } {
  const several = timelines.length > 1;
  const subtitle = useMemo(() => {
    if (!several) {
      // The films the table lists are the ones the roles and the years are over.
      const listed = new Set(rows.map((row) => row.id));
      const films = (timelines[0]?.films ?? []).filter((film) => listed.has(film.id));
      return heroSubtitle([soloRolesLabel(films, includeMinor)], rows.length, false, activeYears(films, today));
    }
    const together = new Set(rows.map((row) => row.id));
    return heroSubtitle(mainRoleLabels(timelines, together, includeMinor), rows.length, several);
  }, [timelines, rows, includeMinor, several, today]);
  const chips = useMemo(() => {
    if (several) return orderChips(rows);
    const listed = new Set(rows.map((row) => row.id));
    return bestKnownChips((timelines[0]?.films ?? []).filter((film) => listed.has(film.id)));
  }, [timelines, rows, several]);
  return { subtitle, chips };
}
