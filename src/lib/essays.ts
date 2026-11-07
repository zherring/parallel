import { pairingKey } from "@/lib/examples";
import raw from "@/lib/essays.json";

/**
 * Essays: hand-curated writing ABOUT a pair's collaboration by critics and scholars (not the artists' own
 * words, which are the clippings), each linked to where it can be read. They live in `essays.json`, keyed by
 * the pair (`pairingKey`: the two TMDB ids, sorted, joined with "+"), best first: the order of the file is the
 * order the Clippings tab shows them in, under "Further reading".
 *
 * This module reads the JSON, so it belongs to the server (the route hands the result to the client as a
 * prop); the client code imports its types and `essays-view.ts`, which is pure.
 */

export type EssayKind = "essay" | "feature" | "academic" | "book chapter" | "review" | "video essay";

export interface Essay {
  title: string;
  /** The writer, when the piece is signed. */
  author: string | null;
  /** The short name of the ORIGINAL place it ran ("Los Angeles Times", "Oxford University Press"), even when `url` is a reprint of it. */
  publication: string;
  /** "YYYY-MM-DD", "YYYY-MM" or "YYYY": when it was published. */
  date: string;
  url: string;
  kind: EssayKind;
  /** One line of the piece itself, verbatim, when there is one worth setting; null otherwise (the summary stands in). */
  pull: string | null;
  /** What the piece argues, in our own words (so never set between quotation marks). */
  summary: string;
  /** The link leads to a paywall or a purchase page rather than to the text. */
  paywalled: boolean;
  /** The site `url` is on when it is a reprint of `publication` ("The Post and Courier"); null when the link is the original. */
  via: string | null;
}

/** One entry of `essays.json`. */
export interface EssaysEntry {
  /** The two names; `tmdb_ids[i]` is the TMDB id of `pair[i]`. */
  pair: string[];
  tmdb_ids: number[];
  essays: Essay[];
}

export type EssaysData = Record<string, EssaysEntry>;

/**
 * The essays of the pair of people with these TMDB ids in `data`, in the order the data gives them (best first),
 * or null: when there are not exactly two people, when the pair has no entry, or when its entry has no essays.
 * Split from `getPairEssays` so that tests can hand it a small fixture.
 */
export function pairEssaysFrom(data: EssaysData, ids: readonly number[]): Essay[] | null {
  if (ids.length !== 2) return null;
  const key = pairingKey({ people: ids.map((id) => ({ id, name: "" })) });
  const entry = Object.hasOwn(data, key) ? data[key] : undefined;
  if (!entry || !Array.isArray(entry.essays) || entry.essays.length === 0) return null;
  return [...entry.essays];
}

const DATA = raw as EssaysData;

/** The essays about the pair with these TMDB ids (in any order), best first; null unless there are exactly two people with at least one. */
export function getPairEssays(ids: readonly number[]): Essay[] | null {
  return pairEssaysFrom(DATA, ids);
}
