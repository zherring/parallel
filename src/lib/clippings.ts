import { clippingYear } from "@/lib/clippings-view";
import { pairingKey } from "@/lib/examples";
import raw from "@/lib/clippings.json";

/**
 * Clippings: hand-curated quotes in which one artist of a pair talks about the other, each linked to
 * the article it came from. They live in `clippings.json`, keyed by the pair (`pairingKey`: the two
 * TMDB ids, sorted, joined with "+"), and only a page of exactly those two people has a Clippings tab.
 *
 * This module reads the JSON, so it belongs to the server (the route hands the result to the client
 * as a prop); the client code imports its types and `clippings-view.ts`, which is pure.
 */

export interface Clipping {
  /**
   * A stable slug, unique within its pair (never across pairs): what a link to this one quote carries
   * (`?quote=<id>`), so it must not change once the quote has been shared.
   */
  id: string;
  /** Who said it, as `pair` writes the name. */
  speaker: string;
  /** Who it is about, the other one of the pair. */
  about: string;
  /** Verbatim. */
  quote: string;
  /** The film the remark is about or came out of, when it is about one. */
  film: string | null;
  /** The year it was said, when the article says. */
  said_year: number | null;
  /** The short name of the ORIGINAL source ("Los Angeles Times", "Academy Awards"), even when `url` is a reprint of it. */
  publication: string;
  /** The article's headline. */
  title: string;
  /** "YYYY-MM-DD", "YYYY-MM" or "YYYY": when the original was published. */
  date: string;
  url: string;
  /** The site `url` is on when it is a reprint of `publication` ("The Post and Courier"); null when the link is the original. */
  via: string | null;
  /** One short sentence on where and why it was said. */
  context: string;
  /** The speaker is reported by someone else, not quoted from their own words. */
  secondhand: boolean;
}

/** One entry of `clippings.json`. */
export interface ClippingsEntry {
  /** The two names; `tmdb_ids[i]` is the TMDB id of `pair[i]`. */
  pair: string[];
  tmdb_ids: number[];
  clippings: Clipping[];
}

export type ClippingsData = Record<string, ClippingsEntry>;

export interface ClippingsPerson {
  id: number;
  name: string;
}

/** The clippings of a pair of people, oldest first. */
export interface PairClippings {
  people: readonly [ClippingsPerson, ClippingsPerson];
  clippings: Clipping[];
}

/**
 * Oldest first by `clippingYear` (then by the original's date, a month or a year sorting before a day of it), clippings
 * with no year last; a copy, ties keep their order.
 */
export function sortClippings(clippings: readonly Clipping[]): Clipping[] {
  return [...clippings].sort((a, b) => {
    const ya = clippingYear(a);
    const yb = clippingYear(b);
    if (ya !== yb) {
      if (ya === null) return 1;
      if (yb === null) return -1;
      return ya - yb;
    }
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}

/**
 * The clippings of the pair of people with these TMDB ids in `data`, or null: when there are not
 * exactly two people, when the pair has no entry, or when its entry has no clippings (or does not
 * name two people). Split from `getPairClippingSet` so that tests can hand it a small fixture.
 */
export function pairClippingsFrom(data: ClippingsData, ids: readonly number[]): PairClippings | null {
  if (ids.length !== 2) return null;
  const key = pairingKey({ people: ids.map((id) => ({ id, name: "" })) });
  const entry = Object.hasOwn(data, key) ? data[key] : undefined;
  if (!entry || !Array.isArray(entry.clippings) || entry.clippings.length === 0) return null;
  if (entry.pair?.length !== 2 || entry.tmdb_ids?.length !== 2) return null;
  const people = [
    { id: entry.tmdb_ids[0], name: entry.pair[0] },
    { id: entry.tmdb_ids[1], name: entry.pair[1] },
  ] as const;
  return { people, clippings: sortClippings(entry.clippings) };
}

const DATA: ClippingsData = raw;

/** The pair with these TMDB ids (in any order) and its clippings, oldest first; null when there are none to show. */
export function getPairClippingSet(ids: readonly number[]): PairClippings | null {
  return pairClippingsFrom(DATA, ids);
}

/** The clippings of the pair with these TMDB ids, oldest first; null unless there are exactly two people with at least one. */
export function getPairClippings(ids: number[]): Clipping[] | null {
  return getPairClippingSet(ids)?.clippings ?? null;
}
