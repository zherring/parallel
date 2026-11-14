/**
 * What Quotes does with a pair's clippings: which of the two people said each one,
 * the year a quote goes under, and the link to a single quote (`?view=clippings&quote=<id>`). Pure, and free
 * of the JSON itself (see `clippings.ts`), so that client components can import it.
 */

import type { Clipping, ClippingsPerson, ClippingsVoice, PairClippings, VoicedClippings } from "@/lib/clippings";
import { QUOTE_PARAM, VIEW_PARAM } from "@/lib/films-view";
import { personSlots } from "@/lib/person-colors";
import type { PersonSummary } from "@/lib/types";

type Pair = readonly [ClippingsPerson, ClippingsPerson];

function normalized(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 0 or 1 for the person of the pair that `name` is (compared with the pair's names, ignoring case, spaces and accents), null if it is neither. */
export function personIndex(name: string, people: Pair): 0 | 1 | null {
  const wanted = normalized(name);
  if (wanted === normalized(people[0].name)) return 0;
  if (wanted === normalized(people[1].name)) return 1;
  return null;
}

/** 0 or 1 for the person of the pair who said the clipping (`speaker` compared with the pair's names), null if it is neither. */
export function speakerIndex(clipping: Pick<Clipping, "speaker">, people: Pair): 0 | 1 | null {
  return personIndex(clipping.speaker, people);
}

/**
 * The pair as voices: each person of `people` (in the data's order, so that `speakerIndex` keeps
 * its meaning) with the headshot and the Timeline colour of the same person on the page. `page` is the page's
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

/** The English name of a language code ("it" is "Italian"); the code itself when the runtime does not know it. */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * "Translated from Italian" for a quote that is our translation of words printed in another language (it has an
 * `original`); null for one that is in English as said.
 */
export function translatedFrom(clipping: Pick<Clipping, "original" | "original_lang">): string | null {
  if (!clipping.original || !clipping.original_lang) return null;
  return `Translated from ${languageName(clipping.original_lang)}`;
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

/** What every critic's id starts with, and no clipping's does: the two kinds of quote share the `?quote=` parameter and this tells them apart. */
export const CRITIC_ID_PREFIX = "critic-";

/** Whether an id names a critic's quote (see `criticById` in `critics-view.ts`) rather than an artist's. */
export function isCriticId(id: string): boolean {
  return id.startsWith(CRITIC_ID_PREFIX);
}

/**
 * The clipping with this id among a pair's clippings (ids are unique within a pair), or null: no id, one the pair
 * does not have, or a critic's (a clipping never answers to one, whatever the data holds).
 */
export function clippingById(clippings: readonly Clipping[], id: string | null | undefined): Clipping | null {
  if (!id || isCriticId(id)) return null;
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
