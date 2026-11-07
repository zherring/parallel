/**
 * The combined timeline: every visible person's films on one track, each film knowing who
 * worked on it.
 *
 * "Shared" is decided among the visible people only (see `sharedAcrossLanes`): with one person
 * visible nothing is shared and every film is in that person's colour; hide a person and the
 * films they made with the others stop being green. An announced film is never shared.
 */

import { joinNames } from "@/lib/format";
import { minimapFilm, type MinimapFilm } from "@/lib/minimap";
import { personColor, personGlow, type PersonTint } from "@/lib/person-colors";
import { roleSummary } from "@/lib/roles";
import { shortName } from "@/lib/short-name";
import { sharedAcrossLanes } from "@/lib/timeline-layout";
import type { Film, PersonSummary } from "@/lib/types";

/** A person's films on the page, already filtered for the minor toggle. */
export interface CombinedLane {
  person: Pick<PersonSummary, "id">;
  films: readonly Film[];
}

export interface CombinedFilm {
  /** The film as the first of its contributors lists it (title, date and poster are the same for everyone). */
  film: Film;
  /** Ids of the visible people who worked on it, in URL order. */
  personIds: number[];
  /** Their palette slots (see `personSlots`), parallel to `personIds`. */
  slots: number[];
  /** Released and made by two or more visible people: the green treatment. */
  shared: boolean;
}

/**
 * One entry per film of the lanes given (the visible people, in URL order), oldest first, with
 * its contributors. `slotOf` is every person's palette slot, so a colour never depends on who is visible.
 */
export function combineLanes(lanes: readonly CombinedLane[], slotOf: ReadonlyMap<number, number>, today: string): CombinedFilm[] {
  const shared = sharedAcrossLanes(lanes, today);
  const byFilm = new Map<number, CombinedFilm>();

  for (const lane of lanes) {
    for (const film of lane.films) {
      const entry = byFilm.get(film.id);
      if (entry) {
        if (!entry.personIds.includes(lane.person.id)) {
          entry.personIds.push(lane.person.id);
          entry.slots.push(slotOf.get(lane.person.id) ?? 0);
        }
      } else {
        byFilm.set(film.id, {
          film,
          personIds: [lane.person.id],
          slots: [slotOf.get(lane.person.id) ?? 0],
          shared: shared.has(film.id),
        });
      }
    }
  }

  return [...byFilm.values()].sort((a, b) => a.film.releaseDate.localeCompare(b.film.releaseDate) || a.film.id - b.film.id);
}

/** What the combined track tells about one film. */
export interface CombinedFilmInfo {
  /** What a screen reader hears of it: who made it, and what each of them did ("Ann: Director. Bo: Writer"). */
  roles: string;
  /** "Shared by Ann & Bo" for a released film several people made, else empty. */
  note: string;
  /** The colour of its node and card ring: the one person's, or null when several made it (the dots say so). */
  tint: PersonTint | null;
  /** One colour per contributor, in URL order. */
  dots: string[];
}

/**
 * What the combined track tells about each film (by film id): the colour of its node and of its
 * card's ring and dots, and what a screen reader hears. `lanes` are the visible people and the
 * films they list, `includeMinor` decides which of their credits count towards the roles.
 */
export function describeCombined(
  entries: readonly CombinedFilm[],
  lanes: readonly { person: Pick<PersonSummary, "id" | "name">; films: readonly Film[] }[],
  includeMinor: boolean,
): Map<number, CombinedFilmInfo> {
  const filmsOf = new Map(lanes.map((lane) => [lane.person.id, new Map(lane.films.map((film) => [film.id, film]))]));
  const nameOf = new Map(lanes.map((lane) => [lane.person.id, lane.person.name]));
  const info = new Map<number, CombinedFilmInfo>();
  for (const entry of entries) {
    const names = entry.personIds.map((personId) => shortName(nameOf.get(personId) ?? "", personId));
    const roles = entry.personIds.map((personId, index) => {
      const credits = filmsOf.get(personId)?.get(entry.film.id)?.credits ?? [];
      const summary = roleSummary(credits.filter((credit) => includeMinor || !credit.minor));
      return summary ? `${names[index]}: ${summary}` : names[index];
    });
    const dots = entry.slots.map(personColor);
    info.set(entry.film.id, {
      roles: roles.join(". "),
      note: entry.shared ? `Shared by ${joinNames(names)}` : "",
      // One person made it: that person's colour. Several (and not out yet): the dots say so, the ring stays neutral.
      tint: entry.slots.length === 1 ? { color: dots[0], glow: personGlow(entry.slots[0]) } : null,
      dots,
    });
  }
  return info;
}

/**
 * What the minimap marks on the combined track: green nodes for the films several people made and
 * a tick for each of the others, in their one person's colour (muted for a film not yet out that
 * several are making).
 */
export function combinedMinimapFilms(entries: readonly CombinedFilm[]): { shared: MinimapFilm[]; ticks: MinimapFilm[] } {
  return {
    shared: entries.filter((entry) => entry.shared).map((entry) => minimapFilm(entry.film)),
    ticks: entries
      .filter((entry) => !entry.shared)
      .map((entry) => minimapFilm(entry.film, entry.slots.length === 1 ? personColor(entry.slots[0]) : undefined)),
  };
}

/**
 * The hidden set after pressing a person's eye. Hiding the last visible person is refused (the
 * same set comes back), so the track is never empty.
 */
export function toggleHidden(hidden: ReadonlySet<number>, personId: number, everyone: readonly number[]): ReadonlySet<number> {
  const next = new Set(hidden);
  if (next.delete(personId)) return next;
  const stillVisible = everyone.filter((id) => id !== personId && !hidden.has(id));
  if (stillVisible.length === 0) return hidden;
  next.add(personId);
  return next;
}
