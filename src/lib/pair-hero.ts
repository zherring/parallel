/**
 * The pair hero at the top of every view of a `/p/` page: the names joined with " × ", a line of what each person did and how many films they
 * made together, a portrait each, a quote or a few sentences about the pair, and a chip for each film. Everything about it that can be worked out
 * without a browser lives here, pure, so the rules are testable and the server and the browser agree on them:
 *
 *  - which note the hero shows, by the chain quote (the first one that fits whole, never cut), description, blurb, nothing (`pickHeroNote`);
 *  - each person's main role in the films the people made together, and the subtitle that joins them (`mainRoleLabels`, `heroSubtitle`);
 *  - the film chips, in release order, the first three and a "+N more" for the rest (`orderChips`, `visibleChips`);
 *  - when the hero is expanded and when it has collapsed into the compact bar (`heroCollapsed`).
 */

import type { Clipping, PairClippings } from "@/lib/clippings";
import { speakerIndex } from "@/lib/clippings-view";
import { QUOTE_PARAM, searchWithView } from "@/lib/films-view";
import { filmCountLabel } from "@/lib/format";
import type { PairDescription } from "@/lib/pair-descriptions";
import { ROLE_ORDER, roleLabel } from "@/lib/roles";
import type { PersonTimeline, RoleKey } from "@/lib/types";

// ---- the note ---------------------------------------------------------------------------------------------------------------------------

/** The quote of the pair, as the hero shows it: who said it, about whom, and the id a link to it carries (`?quote=<id>`). */
export interface HeroQuote {
  kind: "quote";
  id: string;
  quote: string;
  speaker: string;
  about: string;
}

/** A curated description with the sources it rests on. */
export interface HeroDescription extends PairDescription {
  kind: "description";
}

/** The pair's one-line blurb from the landing page's curated pairings. */
export interface HeroBlurb {
  kind: "blurb";
  text: string;
}

export type HeroNote = HeroQuote | HeroDescription | HeroBlurb;

/** The longest a quote is set in the hero (in characters, whitespace folded): a longer one is not the hero's, it is never shown cut. The link under it goes to the whole of it. */
export const QUOTE_CHARS = 240;

/** A quote that ends in an ellipsis in the data is an excerpt that stops mid-thought: the hero does not feature it. */
const ENDS_IN_ELLIPSIS = /(?:\.{3}|\u2026)[\s"'\u2018\u2019\u201C\u201D)\]]*$/u;

/** Whether a quote is whole as the hero sets it: within `QUOTE_CHARS` (counted as `truncateQuote` would, with the whitespace folded) and not an excerpt that trails off. */
export function fitsHero(quote: string, maxChars = QUOTE_CHARS): boolean {
  const text = quote.trim().replace(/\s+/g, " ");
  return Array.from(text).length <= maxChars && !ENDS_IN_ELLIPSIS.test(text);
}

/**
 * The first artist quote of the pair that the hero can show whole: one of the two on the other, in the order the clippings come in (oldest first,
 * the Quotes view's own), that fits within `QUOTE_CHARS` and does not end in an ellipsis in the data (`fitsHero`). The hero never shows a quote cut
 * short with "\u2026", so a longer one, or an excerpt, is passed over for the next. A quote whose speaker is neither of the pair is not one of the two
 * on the other and is passed over too. Null without any.
 */
export function featuredClipping(
  set: Pick<PairClippings, "people" | "clippings"> | null | undefined,
  maxChars = QUOTE_CHARS,
): Clipping | null {
  if (!set) return null;
  return set.clippings.find((clipping) => speakerIndex(clipping, set.people) !== null && fitsHero(clipping.quote, maxChars)) ?? null;
}

/** What `pickHeroNote` chooses among: each is null when the pair has none. */
export interface HeroNoteSources {
  clippings: Pick<PairClippings, "people" | "clippings"> | null;
  description: PairDescription | null;
  /** The one-line blurb of a curated pair. */
  blurb: string | null;
}

/**
 * The note beside the portraits, in this order: the pair's featured quote (the first artist quote that fits whole, see `featuredClipping`: none is ever
 * cut short); else its curated description (with the sources it rests on); else the one-line blurb of a curated pair; else nothing. Nothing is made
 * up: a pair with none of the three has no note.
 */
export function pickHeroNote({ clippings, description, blurb }: HeroNoteSources): HeroNote | null {
  const clipping = featuredClipping(clippings);
  if (clipping) return { kind: "quote", id: clipping.id, quote: clipping.quote, speaker: clipping.speaker, about: clipping.about };
  if (description) return { kind: "description", text: description.text, sources: description.sources };
  const line = blurb?.trim();
  if (line) return { kind: "blurb", text: line };
  return null;
}

/**
 * The address of one quote in the Quotes view, from the page the visitor is on (`pathname`, and its `search`, with or without the "?"): the
 * period and every other parameter stay, the view is the Quotes, and `quote` names the one.
 */
export function quoteHref(pathname: string, search: string, id: string): string {
  const params = new URLSearchParams(searchWithView(search, "clippings"));
  params.set(QUOTE_PARAM, id);
  return `${pathname}?${params.toString()}`;
}

// ---- the roles line ---------------------------------------------------------------------------------------------------------------------

/**
 * Which role wins when two are nearly as common: the one a visitor would name first. A director before everyone who works under one, the crafts
 * before the writer and the producer, who are credited on most of a director's films, and the actor ahead of those two.
 */
const MAIN_ROLE_PRIORITY: readonly RoleKey[] = [
  "director",
  "cinematographer",
  "editor",
  "composer",
  "production-designer",
  "costume-designer",
  "actor",
  "writer",
  "producer",
  "other",
];

/** A role counts as a person's main one when it is on at least this share of the films of the role they have most of. */
const MAIN_ROLE_SHARE = 0.5;

/**
 * A person's main role over some films, each film's credits given as the roles on it: the role on the most films, but when several are on nearly as
 * many (at least half as many as the most), the first of `MAIN_ROLE_PRIORITY` among them. So a director who also produced three more films than
 * they directed is still the director, and an actor with one credit as writer is an actor. Null with no credit at all.
 */
export function mainRole(filmRoles: readonly (readonly RoleKey[])[]): RoleKey | null {
  const counts = new Map<RoleKey, number>();
  for (const roles of filmRoles) for (const role of new Set(roles)) counts.set(role, (counts.get(role) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  if (top === 0) return null;
  const candidates = [...counts].filter(([, count]) => count >= top * MAIN_ROLE_SHARE).map(([role]) => role);
  return MAIN_ROLE_PRIORITY.find((role) => candidates.includes(role)) ?? ROLE_ORDER.find((role) => candidates.includes(role)) ?? null;
}

/**
 * Each person's main role, as the label the people pill uses ("Director"), in the order of `timelines`. It is worked out over the films they made
 * together (`togetherIds`; for one person, or when there are none, over all of their films shown), counting minor credits only with `includeMinor`.
 * "" for a person with no credit to go by.
 */
export function mainRoleLabels(
  timelines: readonly PersonTimeline[],
  togetherIds: ReadonlySet<number> | null,
  includeMinor: boolean,
): string[] {
  const rolesOf = (films: PersonTimeline["films"]) =>
    films.map((film) => film.credits.filter((credit) => includeMinor || !credit.minor).map((credit) => credit.role));
  return timelines.map(({ films }) => {
    const together = togetherIds && togetherIds.size > 0 ? films.filter((film) => togetherIds.has(film.id)) : films;
    const role = mainRole(rolesOf(together)) ?? mainRole(rolesOf(films));
    return role ? roleLabel(role) : "";
  });
}

/** What goes between the names, and between the roles under them. */
export const TITLE_SEPARATOR = " × ";

/**
 * The line under the title: each person's main role joined with " × " (the title's own order), then the films: "Director × Cinematographer · 5 films".
 * One person: "Director · 30 films". A pair with no film together says so ("Director × Editor · No films together"). A person with no role to
 * name is left out of the roles, and with none at all the line is just the films. Cased as words: the page sets it in capitals.
 */
export function heroSubtitle(roles: readonly string[], count: number, several: boolean): string {
  const named = roles.filter(Boolean);
  const films = several && count === 0 ? "No films together" : filmCountLabel(count);
  return [named.join(TITLE_SEPARATOR), films].filter(Boolean).join(" · ");
}

// ---- the chips --------------------------------------------------------------------------------------------------------------------------

/** How many film chips the hero shows before "+N more". */
export const CHIP_LIMIT = 3;

/** One film as a chip: what it says and what finds the film in the view. */
export interface HeroChip {
  id: number;
  title: string;
  year: number;
  releaseDate: string;
}

/** The films as chips in release order (the earliest first); films released the same day by title, then by id, so that the order is the same on every render. */
export function orderChips(films: readonly HeroChip[]): HeroChip[] {
  return films
    .map(({ id, title, year, releaseDate }) => ({ id, title, year, releaseDate }))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.title.localeCompare(b.title) || a.id - b.id);
}

/**
 * The chips to draw and how many are left out: the first `limit`, then `hidden` for the "+N more" chip; with `expanded` (or no more than `limit`
 * films) all of them and nothing hidden.
 */
export function visibleChips<T>(chips: readonly T[], expanded: boolean, limit = CHIP_LIMIT): { shown: T[]; hidden: number } {
  if (expanded || chips.length <= limit) return { shown: [...chips], hidden: 0 };
  return { shown: chips.slice(0, limit), hidden: chips.length - limit };
}

// ---- the collapse -----------------------------------------------------------------------------------------------------------------------

/** How far (px) the view's main scroller has to move from where it landed for the hero to collapse. */
export const COLLAPSE_PX = 48;

/**
 * Whether the hero is collapsed into the compact bar: the view's main scroller is `COLLAPSE_PX` or more from where it started (`landing`: its
 * offset when the view opened: the top, 0, for Films, the Table and the Quotes; the Timeline's left end, and its bottom where it scrolls down), in either direction. Back
 * within that of the start it is expanded again.
 */
export function heroCollapsed(offset: number, landing: number, threshold = COLLAPSE_PX): boolean {
  return Math.abs(offset - landing) >= threshold;
}
