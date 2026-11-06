/**
 * The combined timeline: every visible person's films on one track, each film knowing who
 * worked on it.
 *
 * "Shared" is decided among the visible people only (see `sharedAcrossLanes`): with one person
 * visible nothing is shared and every film is in that person's colour; hide a person and the
 * films they made with the others stop being green. An announced film is never shared.
 */

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
