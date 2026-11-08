import type { ClippingsPerson } from "@/lib/clippings";
import { pairingKey } from "@/lib/examples";
import raw from "@/lib/essays.json";

/**
 * Critics: hand-curated writing ABOUT a pair's collaboration by critics and scholars (not the artists' own
 * words, which are the clippings). Two kinds of entry, both in `essays.json` and keyed by the pair
 * (`pairingKey`: the two TMDB ids, sorted, joined with "+"):
 *
 *  - `critics`: a line of the piece itself, verbatim, which the Clippings tab sets as a pull quote like an artist's,
 *    in the one list with theirs, oldest first (`interleaveQuotes`). Best first in the file; that order settles
 *    only which of two quotes of the same year comes first.
 *  - `reading`: pieces that are only linked, under "More reading" at the bottom of the tab: those behind a paywall,
 *    and those with no line worth setting. Best first, and shown in the order of the file.
 *
 * This module reads the JSON, so it belongs to the server (the route hands the result to the client as a
 * prop); the client code imports its types and `critics-view.ts`, which is pure.
 */

export type CriticKind = "essay" | "feature" | "academic" | "book chapter" | "review" | "video essay";

export interface Critic {
  /**
   * A stable slug that starts with "critic-" (see `isCriticId`), unique across all clippings and critics: what a link to
   * this one quote carries (`?quote=<id>`), so it must not change once the quote has been shared.
   */
  id: string;
  /** The writer, when the piece is signed; null otherwise (the publication then stands in for the name). */
  critic: string | null;
  /** The short name of the ORIGINAL place it ran ("Los Angeles Times", "Oxford University Press"), even when `url` is a reprint of it. */
  publication: string;
  /** The site `url` is on when it is a reprint of `publication` ("The Post and Courier"); null when the link is the original. */
  via: string | null;
  /** The piece's headline. */
  title: string;
  /** "YYYY-MM-DD", "YYYY-MM" or "YYYY": when it was published. */
  date: string;
  url: string;
  kind: CriticKind;
  /** One line of the piece itself, verbatim. */
  quote: string;
}

/** A piece that is only linked: no quote, or one behind a paywall. */
export interface ReadingItem {
  title: string;
  /** The writer, when the piece is signed. */
  author: string | null;
  /** The short name of the ORIGINAL place it ran ("Literary Review", "Oxford University Press"). */
  publication: string;
  /** "YYYY-MM-DD", "YYYY-MM" or "YYYY": when it was published. */
  date: string;
  url: string;
  /** The link leads to a paywall or a purchase page rather than to the text. */
  paywalled: boolean;
}

/** One entry of `essays.json`. */
export interface CriticsEntry {
  /** The two names; `tmdb_ids[i]` is the TMDB id of `pair[i]`. */
  pair: string[];
  tmdb_ids: number[];
  critics: Critic[];
  reading: ReadingItem[];
}

export type CriticsData = Record<string, CriticsEntry>;

/** What the Clippings tab has of the critics for a pair: the pair, the quotes to set and the pieces to link. Either list may be empty, never both. */
export interface PairCritics {
  /** In the order `essays.json` writes the pair (`tmdb_ids[i]` is `pair[i]`). */
  people: readonly [ClippingsPerson, ClippingsPerson];
  critics: Critic[];
  reading: ReadingItem[];
}

/**
 * The critics and the reading of the pair of people with these TMDB ids in `data`, each in the order the data gives
 * them (best first), or null: when there are not exactly two people, when the pair has no entry or does not name
 * two people, or when its entry has neither critics nor reading. Split from `getPairCritics` so that tests can
 * hand it a small fixture.
 */
export function pairCriticsFrom(data: CriticsData, ids: readonly number[]): PairCritics | null {
  if (ids.length !== 2) return null;
  const key = pairingKey({ people: ids.map((id) => ({ id, name: "" })) });
  const entry = Object.hasOwn(data, key) ? data[key] : undefined;
  if (!entry) return null;
  if (entry.pair?.length !== 2 || entry.tmdb_ids?.length !== 2) return null;
  const critics = Array.isArray(entry.critics) ? [...entry.critics] : [];
  const reading = Array.isArray(entry.reading) ? [...entry.reading] : [];
  if (critics.length === 0 && reading.length === 0) return null;
  const people = [
    { id: entry.tmdb_ids[0], name: entry.pair[0] },
    { id: entry.tmdb_ids[1], name: entry.pair[1] },
  ] as const;
  return { people, critics, reading };
}

const DATA = raw as CriticsData;

/** The critics and the reading about the pair with these TMDB ids (in any order); null unless there are exactly two people with at least one of either. */
export function getPairCritics(ids: readonly number[]): PairCritics | null {
  return pairCriticsFrom(DATA, ids);
}
