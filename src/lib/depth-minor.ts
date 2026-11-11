/**
 * Minor credits in the Depth view. With "Include minor credits" on, the films whose every credit is minor (a cameo, a
 * thank-you) join the scene as background posters: further back and fainter, like the most obscure films, whatever their
 * votes. They are never the films made together in front, even when two people both have a minor credit on one: that
 * layer is for the work the people made together, and a cameo is not that. Pure.
 */

import type { CombinedFilm } from "@/lib/combined-track";
import type { Film } from "@/lib/types";

/** The obscurity (0 to 1, see `obscurityOf`) a minor film is given at least: faint and far back, as the least known films of a page are. */
export const MINOR_OBSCURITY = 0.85;

/**
 * The ids of the films that are minor for everyone who has them: every lane that lists the film lists it as minor. (A film
 * that one person only has a cameo in but another made is not minor: it is the second person's work.)
 */
export function minorOnlyIds(lanes: readonly { films: readonly Film[] }[]): Set<number> {
  const major = new Set<number>();
  const minor = new Set<number>();
  for (const { films } of lanes) for (const film of films) (film.minor ? minor : major).add(film.id);
  for (const id of major) minor.delete(id);
  return minor;
}

/**
 * `entries` with the films in `minorIds` not counted as made together: released and shared by several people, a minor film is
 * an ordinary film of its first person here. Returns the same array when there is nothing to change.
 */
export function demoteMinor(entries: readonly CombinedFilm[], minorIds: ReadonlySet<number>): readonly CombinedFilm[] {
  if (minorIds.size === 0 || !entries.some((entry) => entry.shared && minorIds.has(entry.film.id))) return entries;
  return entries.map((entry) => (entry.shared && minorIds.has(entry.film.id) ? { ...entry, shared: false } : entry));
}
