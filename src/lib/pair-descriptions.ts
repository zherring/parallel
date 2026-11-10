/**
 * Pair descriptions: a few sentences about a pair's collaboration, written by hand from sources that can be cited, for the pair hero at the
 * top of every view of a `/p/` page (see `pair-hero.ts`). They live in `PAIR_DESCRIPTIONS` below, keyed by the pair (`pairingKey`: the two TMDB
 * ids, sorted, joined with "+"), and only a page of exactly those two people shows one.
 *
 * It starts empty: it is filled by research, one pair at a time. Nothing here is generated or guessed; a pair without an entry has none, and the hero
 * falls back to the pair's quote or its one-line blurb, or shows nothing (see `pickHeroNote`).
 *
 * An entry's `sources` are the pages the text rests on, each a title and a link; the hero lists them under a small "Sources" disclosure. Only
 * `http` and `https` links are kept (`getPairDescription` drops any other, so that a mistyped entry can never become a `javascript:` link).
 */

import { pairingKey } from "@/lib/examples";

/** One page a description rests on. */
export interface PairDescriptionSource {
  title: string;
  url: string;
}

/** A pair's description and where it comes from. */
export interface PairDescription {
  /** The sentences themselves: plain text, one paragraph. */
  text: string;
  sources: PairDescriptionSource[];
}

export type PairDescriptions = Record<string, PairDescription>;

/** The curated descriptions, by `pairingKey`. Empty until the research fills it. */
export const PAIR_DESCRIPTIONS: PairDescriptions = {};

/** Whether the address is one a link can safely point at: `http` or `https`, nothing else. */
export function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * The description of the pair with these TMDB ids in `data`, or null: when there are not exactly two people, when the pair has no entry, or
 * when its text is blank. Sources without a title or with a link that is not a web address are dropped. Split from `getPairDescription`
 * so that tests can hand it a small fixture.
 */
export function pairDescriptionFrom(data: PairDescriptions, ids: readonly number[]): PairDescription | null {
  if (ids.length !== 2) return null;
  const key = pairingKey({ people: ids.map((id) => ({ id, name: "" })) });
  const entry = Object.hasOwn(data, key) ? data[key] : undefined;
  const text = entry?.text?.trim();
  if (!entry || !text) return null;
  const sources = (Array.isArray(entry.sources) ? entry.sources : []).filter(
    (source) => source.title?.trim() && isWebUrl(source.url),
  );
  return { text, sources: sources.map((source) => ({ title: source.title.trim(), url: source.url })) };
}

/** The curated description of the pair with these TMDB ids (in any order), or null when it has none. */
export function getPairDescription(ids: readonly number[]): PairDescription | null {
  return pairDescriptionFrom(PAIR_DESCRIPTIONS, ids);
}
