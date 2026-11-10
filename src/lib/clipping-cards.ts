import { speakerIndex, truncateQuote } from "@/lib/clippings-view";
import { pairClippingsFrom, type Clipping, type ClippingsData, type ClippingsPerson } from "@/lib/clippings";
import clippingsRaw from "@/lib/clippings.json";
import { pairCriticsFrom, type CriticsData } from "@/lib/critics";
import essaysRaw from "@/lib/essays.json";
import generated from "@/lib/examples.generated.json";
import { pairingHref, type GeneratedExamples } from "@/lib/examples";
import { hasClippingsTab, VIEW_PARAM } from "@/lib/films-view";
import { shortName } from "@/lib/short-name";

/**
 * The landing page's Clippings tab: every pair that has something for the Clippings tab, as a card that links
 * to it, with one short quote from the pair as a teaser. Built on the server from the JSON (the client is
 * sent only the small cards, never the quotes themselves), and without any randomness, so the markup is the
 * same on every render.
 */

/** A teaser is the shortest artist quote of at most this many characters; a pair with none shorter gets its shortest, cut to fit. */
export const TEASER_MAX_CHARS = 140;

/** The shortest cut at a sentence worth showing: below this, the cut is at a word instead ("No!" is not a teaser). */
const MIN_SENTENCE_CUT = 40;

export interface ClippingTeaser {
  /** Verbatim, or cut short at a sentence (or at a word, ending in "…"; see `excerpt`); without the quotation marks. */
  quote: string;
  /** Family name of who said it ("Scorsese"). */
  speaker: string;
}

export interface ClippingCardData {
  /** The pair's page, canonical slug, opened on its Clippings tab. */
  href: string;
  /** TMDB's canonical names and photos (profile paths), in the pairing's order. */
  people: { id: number; name: string; profilePath: string }[];
  /** One quote of the pair about each other; null when the pair has none (a pair with only critics' writing). */
  teaser: ClippingTeaser | null;
  /** What the tab's "All" counts: the pair's quotes about each other plus the critics' quotes. 0 for a pair that has only reading. */
  count: number;
}

type Pair = readonly [ClippingsPerson, ClippingsPerson];

/**
 * `quote` as it is when it fits in `max` characters (whitespace folded); otherwise its leading sentences, as many as
 * fit, so that a longer quote still ends where a thought does. When the first sentence alone is too long (or too
 * short to be worth showing, see MIN_SENTENCE_CUT), the quote is cut at a word with "…" (`truncateQuote`).
 */
export function excerpt(quote: string, max: number): string {
  const text = quote.trim().replace(/\s+/g, " ");
  if (Array.from(text).length <= max) return text;

  // The end of a sentence: . ! or ? (and any closing quote after it) followed by a space.
  let cut = 0;
  for (const match of text.matchAll(/[.!?]['"\u2019\u201D)\]]*(?=\s)/g)) {
    const end = match.index + match[0].length;
    if (end > max) break; // UTF-16 length is never shorter than the character count, so this only errs on the safe side
    cut = end;
  }
  return cut >= MIN_SENTENCE_CUT ? text.slice(0, cut) : truncateQuote(text, max);
}

/**
 * The quote that stands for a pair on its card: the SHORTEST of the quotes one of the two said (not the
 * critics', not a speaker outside the pair, and not one a third party reports unless every quote is), at most
 * `max` characters. A pair whose every quote is longer gets its shortest one cut short (`excerpt`), so that no card
 * is left without one. Ties keep the order of `clippings`, so the
 * pick never changes between renders. null when no quote was said by the pair.
 */
export function pickTeaser(
  clippings: readonly Clipping[],
  people: Pair,
  max: number = TEASER_MAX_CHARS,
): ClippingTeaser | null {
  const said = clippings
    .map((clipping) => ({ clipping, speaker: speakerIndex(clipping, people), length: Array.from(clipping.quote.trim()).length }))
    .filter((candidate) => candidate.speaker !== null && candidate.length > 0);
  const firsthand = said.filter((candidate) => !candidate.clipping.secondhand);
  const pool = firsthand.length > 0 ? firsthand : said;
  if (pool.length === 0) return null;

  // Array.prototype.sort is stable, so equal lengths keep the data's order.
  const shortest = [...pool].sort((a, b) => a.length - b.length)[0];
  const person = people[shortest.speaker as 0 | 1];
  return {
    quote: excerpt(shortest.clipping.quote, max),
    speaker: shortName(person.name, person.id),
  };
}

/** Lower-case, accent-free text to sort names by ("Almodóvar" among the As). */
function sortKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Alphabetical by the first person's family name, then the second's, then the link; the order the pairing lists its people in. */
function compareCards(a: ClippingCardData, b: ClippingCardData): number {
  for (let i = 0; i < Math.min(a.people.length, b.people.length); i++) {
    const left = sortKey(shortName(a.people[i].name, a.people[i].id));
    const right = sortKey(shortName(b.people[i].name, b.people[i].id));
    if (left !== right) return left < right ? -1 : 1;
  }
  return a.href < b.href ? -1 : a.href > b.href ? 1 : 0;
}

/**
 * A card for every two-person pairing of `examples` that has a Clippings tab (quotes of the pair, critics' quotes,
 * or reading), alphabetical by the first person's family name (see `compareCards`). The names, photos and slug are
 * the pairing's own in `examples`, so the link is already canonical and never redirects. Pairs in the clippings or
 * the critics that `examples` does not have are left out: the landing page cannot draw them.
 */
export function buildClippingCards(
  clippings: ClippingsData = clippingsRaw,
  critics: CriticsData = essaysRaw as CriticsData,
  examples: GeneratedExamples = generated,
): ClippingCardData[] {
  const cards: ClippingCardData[] = [];
  for (const entry of Object.values(examples)) {
    if (entry.people.length !== 2) continue;
    const ids = entry.people.map((person) => person.id);
    const quotes = pairClippingsFrom(clippings, ids);
    const writing = pairCriticsFrom(critics, ids);
    if (!hasClippingsTab(quotes, writing)) continue;

    cards.push({
      href: `${pairingHref(entry)}?${VIEW_PARAM}=clippings`,
      people: entry.people,
      teaser: quotes ? pickTeaser(quotes.clippings, quotes.people) : null,
      count: (quotes?.clippings.length ?? 0) + (writing?.critics.length ?? 0),
    });
  }
  return cards.sort(compareCards);
}

/** "10 quotes", "1 quote"; "Further reading" for a pair that has only pieces to read. */
export function clippingCountLabel(count: number): string {
  if (count === 0) return "Further reading";
  return `${count} ${count === 1 ? "quote" : "quotes"}`;
}
