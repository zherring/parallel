/**
 * What the minimap marks on the separate layout (one lane per person): green nodes for the films
 * every lane shows, and a tick for every other film, in the colour it has on the lanes (its
 * person's, or its connection's), or muted when the page has only one person. The combined
 * track has its own (see `combinedMinimapFilms`).
 */

import { minimapFilm, type MinimapFilm } from "@/lib/minimap";
import { personColor } from "@/lib/person-colors";
import type { Film, PersonSummary } from "@/lib/types";

/**
 * `lanes` are the people drawn (in lane order). `membership` is the lanes (by index) that show
 * each film as placed on the track, `accents` the colour of each film that more than one lane
 * shows, `slots` every person's palette slot, and `colored` whether the page has several people
 * (and so colours to tell apart).
 */
export function separateMinimapFilms(
  lanes: readonly { person: Pick<PersonSummary, "id">; films: readonly Film[] }[],
  membership: ReadonlyMap<number, number[]>,
  accents: ReadonlyMap<number, string>,
  slots: ReadonlyMap<number, number>,
  colored: boolean,
): { shared: MinimapFilm[]; ticks: MinimapFilm[] } {
  const byId = new Map<number, { film: Film; shownIn: number[] }>();
  lanes.forEach((lane, index) => {
    for (const film of lane.films) {
      const entry = byId.get(film.id);
      if (entry) {
        if (!entry.shownIn.includes(index)) entry.shownIn.push(index);
      } else byId.set(film.id, { film, shownIn: [index] });
    }
  });

  const shared: MinimapFilm[] = [];
  const ticks: MinimapFilm[] = [];
  for (const { film, shownIn } of byId.values()) {
    if (lanes.length > 1 && membership.get(film.id)?.length === lanes.length) {
      shared.push(minimapFilm(film));
      continue;
    }
    const color = !colored
      ? undefined
      : shownIn.length === 1
        ? personColor(slots.get(lanes[shownIn[0]].person.id) ?? 0)
        : accents.get(film.id);
    ticks.push(minimapFilm(film, color));
  }
  return { shared, ticks };
}
