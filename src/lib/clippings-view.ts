/**
 * What the Clippings tab does with a pair's clippings: which of the two people said each one, the
 * direction filter ("All", "A on B", "B on A"), the year a quote goes under, and the link to a single
 * quote (`?view=clippings&quote=<id>`). Pure, and free of the JSON itself (see `clippings.ts`), so
 * that client components can import it.
 */

import type { Clipping, ClippingsPerson, ClippingsVoice, PairClippings, VoicedClippings } from "@/lib/clippings";
import { QUOTE_PARAM, VIEW_PARAM } from "@/lib/films-view";
import { personSlots } from "@/lib/person-colors";
import { headingNames } from "@/lib/short-name";
import type { PersonSummary } from "@/lib/types";

/** "all", or the clippings the first / the second person of the pair said about the other. */
export type ClippingsFilter = "all" | "first" | "second";

export interface FilterOption {
  id: ClippingsFilter;
  /** The button's text: "All", "Spielberg on Williams". */
  label: string;
  /** The full wording, for a tooltip and screen readers: "Steven Spielberg on John Williams". */
  title: string;
  /** How many clippings the option shows. */
  count: number;
}

type Pair = readonly [ClippingsPerson, ClippingsPerson];

function normalized(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 0 or 1 for the person of the pair who said the clipping (`speaker` compared with the pair's names), null if it is neither. */
export function speakerIndex(clipping: Pick<Clipping, "speaker">, people: Pair): 0 | 1 | null {
  const speaker = normalized(clipping.speaker);
  if (speaker === normalized(people[0].name)) return 0;
  if (speaker === normalized(people[1].name)) return 1;
  return null;
}

/**
 * The pair as voices: each person of `people` (in the data's order, so that `speakerIndex` and the filter keep
 * their meaning) with the headshot and the Timeline colour of the same person on the page. `page` is the page's
 * people in the order of its URL, the order `personSlots` colours them in; the match is by TMDB id, never by
 * position in `pair`, since `/p/491-john-williams+488-steven-spielberg` and `/p/488-...+491-...` are the same pair in
 * the other order and must draw each person in the same colour as their Timeline. A person the page does not have
 * (a pair is only looked up from the page's own ids, so this does not happen) gets the slot of their position in `people`.
 */
export function clippingVoices(
  people: Pair,
  page: readonly Pick<PersonSummary, "id" | "profilePath">[],
): readonly [ClippingsVoice, ClippingsVoice] {
  const slots = personSlots(page);
  const voice = (person: ClippingsPerson, index: number): ClippingsVoice => ({
    ...person,
    profilePath: page.find((p) => p.id === person.id)?.profilePath ?? null,
    slot: slots.get(person.id) ?? index,
  });
  return [voice(people[0], 0), voice(people[1], 1)];
}

/** `set` with its people as voices (see `clippingVoices`). */
export function voiceClippings(
  set: PairClippings,
  page: readonly Pick<PersonSummary, "id" | "profilePath">[],
): VoicedClippings {
  return { ...set, people: clippingVoices(set.people, page) };
}

/** The clippings a filter shows, in their order. Those whose speaker is neither of the pair show under "all" only. */
export function filterClippings(
  clippings: readonly Clipping[],
  people: Pair,
  filter: ClippingsFilter,
): Clipping[] {
  if (filter === "all") return [...clippings];
  const wanted = filter === "first" ? 0 : 1;
  return clippings.filter((clipping) => speakerIndex(clipping, people) === wanted);
}

/**
 * The options of the direction filter: "All" and each direction that has clippings. Empty when
 * fewer than two directions do, since a filter between "all" and the only direction would do
 * nothing; the tab then shows no filter.
 */
export function filterOptions(clippings: readonly Clipping[], people: Pair): FilterOption[] {
  const counts = [0, 0];
  for (const clipping of clippings) {
    const index = speakerIndex(clipping, people);
    if (index !== null) counts[index] += 1;
  }
  if (counts.filter((count) => count > 0).length < 2) return [];

  // Family names for the buttons (the full names would wrap on a phone), the full names when the two share one.
  const short = headingNames(people, true);
  const direction = (index: 0 | 1): Omit<FilterOption, "id"> => ({
    label: `${short[index]} on ${short[1 - index]}`,
    title: `${people[index].name} on ${people[1 - index].name}`,
    count: counts[index],
  });
  return [
    { id: "all", label: "All", title: "All clippings", count: clippings.length },
    { id: "first", ...direction(0) },
    { id: "second", ...direction(1) },
  ];
}

/** What a polite live region says after the filter is changed: "Showing 3 clippings". */
export function clippingsCountMessage(count: number): string {
  return `Showing ${count} ${count === 1 ? "clipping" : "clippings"}`;
}

/** The year of a "YYYY", "YYYY-MM" or "YYYY-MM-DD" date; null for anything else (or a month or day that is not two digits). */
export function dateYear(date: string): number | null {
  const match = /^(\d{4})(?:-\d{2}(?:-\d{2})?)?$/.exec(date.trim());
  return match ? Number(match[1]) : null;
}

/**
 * The year a clipping goes under: the OLDEST of the year it was said and the year of the original's
 * date, since the earlier of the two is when the remark first existed. null when neither is a year.
 */
export function clippingYear(clipping: Pick<Clipping, "said_year" | "date">): number | null {
  const years: number[] = [];
  if (clipping.said_year !== null && Number.isFinite(clipping.said_year)) years.push(clipping.said_year);
  const published = dateYear(clipping.date);
  if (published !== null) years.push(published);
  return years.length > 0 ? Math.min(...years) : null;
}

type ParamValue = string | string[] | undefined;

/**
 * The quote id a link names (`?quote=<id>`): the first of a repeated parameter, trimmed; null when it is
 * absent or empty. Whether the id is one of the pair's quotes is for `clippingById` to say.
 */
export function parseQuoteId(source: string | URLSearchParams | Record<string, ParamValue>): string | null {
  let value: ParamValue;
  if (typeof source === "string" || source instanceof URLSearchParams) {
    value = (typeof source === "string" ? new URLSearchParams(source) : source).get(QUOTE_PARAM) ?? undefined;
  } else {
    value = source[QUOTE_PARAM];
  }
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first ? first : null;
}

/** The clipping with this id among a pair's clippings (ids are unique within a pair), or null: no id, or one the pair does not have. */
export function clippingById(clippings: readonly Clipping[], id: string | null | undefined): Clipping | null {
  if (!id) return null;
  return clippings.find((clipping) => clipping.id === id) ?? null;
}

/** The query string (with its "?") of a link to one quote: it opens the Clippings tab on it. */
export function quoteLinkSearch(id: string): string {
  const params = new URLSearchParams({ [VIEW_PARAM]: "clippings", [QUOTE_PARAM]: id });
  return `?${params.toString()}`;
}

/** The query string (with its "?") of the quote's preview card, `/p/<people>/og?quote=<id>`: the one spelling it answers at. */
export function quoteCardSearch(id: string): string {
  return `?${new URLSearchParams({ [QUOTE_PARAM]: id }).toString()}`;
}

/**
 * `text` cut to at most `max` characters, ending in "…" when it was cut: at the last word that fits
 * (unless that would lose more than a third), with the punctuation the cut left dangling taken off.
 * Whitespace runs are folded, so a quote reads the same on a card and in a title.
 */
export function truncateQuote(text: string, max: number): string {
  const chars = Array.from(text.trim().replace(/\s+/g, " "));
  if (chars.length <= max) return chars.join("");
  let cut = chars.slice(0, Math.max(1, max - 1)).join("");
  const space = cut.lastIndexOf(" ");
  if (space > cut.length * 0.66) cut = cut.slice(0, space);
  return `${cut.replace(/[\s,;:.\u2013\u2014-]+$/u, "")}\u2026`;
}
