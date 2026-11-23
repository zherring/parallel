/**
 * What the landing hero's montage draws past its 3 x 3 core: the posters of the columns that run on to the screen's edge. Read from portrait-backdrops.json, written by
 * `npm run portraits:cut -- --posters` with the core (`posters` in portrait-cuts.json) so that nothing is repeated beside itself and no franchise clusters
 * (src/lib/backdrop-posters.ts). Only the landing hero imports this, so the cards and the pair pages, which draw the core alone, do not carry it.
 */

import backdrops from "@/lib/portrait-backdrops.json";
import { CORE_POSTERS, EXTENSION_POSTERS, arrangeBackdrop } from "@/lib/backdrop-posters";

const STORED = backdrops as Record<string, string[]>;

/** The fallback's arrangements, by person and core: the search behind them is the montage's most expensive step, and the panel draws it again on every scene change. */
const MADE = new Map<string, readonly string[]>();

/**
 * The `EXTENSION_POSTERS` posters of the columns past the core of a person whose core is `core`, column by column from the core outward, each column top to bottom: the stored
 * list, else (a person the file does not list, which a data test holds to nobody on the landing page) the core's own posters arranged to keep like ones apart; none for a person with
 * no posters. An arrangement made is kept, so the search runs once for a person and a core, not on every render; the list is shared, so a caller must not change it.
 */
export function extensionPosters(personId: number, core: readonly string[]): readonly string[] {
  const stored = STORED[String(personId)];
  if (stored?.length === EXTENSION_POSTERS) return stored;
  if (core.length === 0) return [];
  const key = `${personId}:${core.join(",")}`;
  let made = MADE.get(key);
  if (!made) {
    const films = core.map((poster, index) => ({ id: index, poster, votes: core.length - index, collection: null }));
    made = arrangeBackdrop(films).posters.slice(CORE_POSTERS);
    MADE.set(key, made);
  }
  return made;
}
