/**
 * Which films have no poster while "Show all films" is off, for the Depth view: the same ones the flat timeline leaves as bare nodes.
 *
 * The flat timeline decides it by packing the films into a lane with a cap of `DEFAULT_MAX_ROWS` rows of poster cards (see
 * `packTrackLanes`): the films several people made are placed first and always keep a card, then the rest by votes (high first), each into
 * the lowest row it fits, and a film that fits none of the rows is left without a poster. So it is a packing, not a rank: how many
 * films keep a poster depends on how close together they came out, which depends on the zoom (more years to the screen, more room).
 * Nothing in it depends on the viewport. The Depth view has no zoom, so it asks the question at the timeline's default zoom
 * (`DEFAULT_ZOOM`), the one every page opens at, with the same function, and so shows the same set a visitor sees on the timeline when
 * they first arrive. (A flat timeline that was zoomed in, or opened on a period link, has room for more films than that; the Depth view
 * does not follow it.) Pure and independent of the clock and the window, so the server and the browser agree.
 */

import { combineLanes } from "@/lib/combined-track";
import { DEFAULT_ZOOM, axisRange, makeScale, packTrackLanes, sharedAcrossLanes } from "@/lib/timeline-layout";
import type { Film } from "@/lib/types";

/** A person's films on the page, already filtered for the minor toggle. */
export interface CapLane {
  person: { id: number };
  films: readonly Film[];
}

/**
 * The ids of the films the flat timeline would leave without a poster (at its default zoom, with the people's `lanes` as the page shows
 * them, the minor toggle applied) while "Show all films" is off. Several people share one combined track, with the films they made
 * together placed first; one person's films are their own lane. `slotOf` is every person's palette slot (see `personSlots`) and `today`
 * the page's date (yyyy-mm-dd).
 */
export function postersLeftOut(lanes: readonly CapLane[], slotOf: ReadonlyMap<number, number>, today: string): Set<number> {
  const together = lanes.length > 1;
  const entries = together ? combineLanes(lanes, slotOf, today) : [];
  const trackLanes = together ? [{ films: entries.map((entry) => entry.film) }] : lanes;

  const range = axisRange(trackLanes.flatMap((lane) => lane.films.map((film) => film.year)), Number(today.slice(0, 4)));
  const scale = makeScale(range, DEFAULT_ZOOM);
  const base = { pxPerYear: DEFAULT_ZOOM, axisStartYear: scale.axisStartYear };
  const priorityIds = together
    ? new Set(entries.filter((entry) => entry.shared).map((entry) => entry.film.id))
    : sharedAcrossLanes(trackLanes, today);

  const { capped } = packTrackLanes(trackLanes, lanes, priorityIds, base, today);
  return new Set(capped.flatMap((lane) => lane.filter((item) => item.overflow).map((item) => item.film.id)));
}
