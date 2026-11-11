/**
 * The pair hero at the top of every view of a `/p/` page: the names joined with " × ", a line of what each person did and how many films they
 * made together, a portrait each, a quote or a few sentences about the pair, and a chip for each film. A page of one person has the same hero as
 * their masthead: one portrait, their roles and the years they were active, their best-known films as the chips, and the start of their biography
 * as the note. Everything about it that can be worked out without a browser lives here, pure, so the rules are testable and the server and the
 * browser agree on them:
 *
 *  - which note the hero shows, by the chain quote (the first one that fits whole, never cut), description, blurb, biography, nothing (`pickHeroNote`);
 *  - each person's main role in the films the people made together, and the subtitle that joins them (`mainRoleLabels`, `heroSubtitle`); for one person,
 *    their main roles and active years (`soloRolesLabel`, `activeYears`);
 *  - the film chips, in release order, the first three and a "+N more" for the rest (`orderChips`, `visibleChips`); for one person the best known first (`bestKnownChips`);
 *  - when the hero is expanded and when it has collapsed into the compact bar (`heroCollapsed`).
 */

import { bioSnippet, stripBiographyCredit } from "@/lib/biography";
import type { Clipping, PairClippings } from "@/lib/clippings";
import { speakerIndex } from "@/lib/clippings-view";
import { QUOTE_PARAM, searchWithView } from "@/lib/films-view";
import { filmCountLabel } from "@/lib/format";
import { yearSpan } from "@/lib/lanes";
import type { PairDescription } from "@/lib/pair-descriptions";
import { isReleased } from "@/lib/released";
import { ROLE_ORDER, roleLabel } from "@/lib/roles";
import type { Film, PersonTimeline, RoleKey } from "@/lib/types";

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

/** A person's TMDB biography, cut to whole sentences (see `heroBioText`): the note of a page of one person, which has no pair to write about. */
export interface HeroBio {
  kind: "bio";
  text: string;
}

export type HeroNote = HeroQuote | HeroDescription | HeroBlurb | HeroBio;

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

/**
 * A biography as the hero sets it, never cut mid-sentence and never longer than `maxChars` (`QUOTE_CHARS`): whole sentences from the start of it, as many as fit
 * (`bioSnippet`), with the credit lines TMDB copies from Wikipedia taken off ("Description above from the Wikipedia article ..."). Only when the very first
 * sentence is longer than that is it cut, at a word, and ends with "\u2026". Null without a biography, or one that is only such a credit.
 */
export function heroBioText(biography: string | null | undefined, maxChars = QUOTE_CHARS): string | null {
  if (typeof biography !== "string") return null;
  const text = stripBiographyCredit(biography);
  return text ? bioSnippet(text, maxChars) : null;
}

/** What `pickHeroNote` chooses among: each is null when the pair has none. */
export interface HeroNoteSources {
  clippings: Pick<PairClippings, "people" | "clippings"> | null;
  description: PairDescription | null;
  /** The one-line blurb of a curated pair. */
  blurb: string | null;
  /** The biography of the person, for a page of one (a pair has no one biography to speak for it): the note when there is nothing else. Not given for two or more people. */
  biography?: string | null;
}

/**
 * The note beside the portraits, in this order: the pair's featured quote (the first artist quote that fits whole, see `featuredClipping`: none is ever
 * cut short); else its curated description (with the sources it rests on); else the one-line blurb of a curated pair; else, for one person, the start of their
 * biography (`heroBioText`); else nothing. Nothing is made up: a page with none of the four has no note.
 */
export function pickHeroNote({ clippings, description, blurb, biography }: HeroNoteSources): HeroNote | null {
  const clipping = featuredClipping(clippings);
  if (clipping) return { kind: "quote", id: clipping.id, quote: clipping.quote, speaker: clipping.speaker, about: clipping.about };
  if (description) return { kind: "description", text: description.text, sources: description.sources };
  const line = blurb?.trim();
  if (line) return { kind: "blurb", text: line };
  const bio = heroBioText(biography);
  if (bio) return { kind: "bio", text: bio };
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
  return mainRoles(filmRoles, 1)[0] ?? null;
}

/**
 * A person's main roles over some films: those on at least half as many films as the one they have most of (`mainRole` is the first of them), the one a visitor would
 * name first before the others (`MAIN_ROLE_PRIORITY`), and no more than `limit` of them. Empty with no credit at all.
 */
export function mainRoles(filmRoles: readonly (readonly RoleKey[])[], limit = 1): RoleKey[] {
  const counts = new Map<RoleKey, number>();
  for (const roles of filmRoles) for (const role of new Set(roles)) counts.set(role, (counts.get(role) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  if (top === 0) return [];
  const candidates = [...counts].filter(([, count]) => count >= top * MAIN_ROLE_SHARE).map(([role]) => role);
  const ranked = [...MAIN_ROLE_PRIORITY, ...ROLE_ORDER.filter((role) => !MAIN_ROLE_PRIORITY.includes(role))];
  return ranked.filter((role) => candidates.includes(role)).slice(0, limit);
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

/** How many roles a page of one person names under their name: "Director, Actor". */
export const SOLO_ROLE_LIMIT = 2;

/**
 * What one person's masthead calls them: their main roles over the films shown (`mainRoles`, up to `SOLO_ROLE_LIMIT`), as the people pill words them and joined with
 * a comma ("Director, Actor"), counting minor credits only with `includeMinor`. "" for a person with no credit to go by.
 */
export function soloRolesLabel(films: PersonTimeline["films"], includeMinor: boolean, limit = SOLO_ROLE_LIMIT): string {
  const filmRoles = films.map((film) => film.credits.filter((credit) => includeMinor || !credit.minor).map((credit) => credit.role));
  return mainRoles(filmRoles, limit).map(roleLabel).join(", ");
}

/** The years a person has been working, as "1966–2005" (just the year when it is one): the first film to the last that is out; with none out yet, the span of all of them. "" with no films. */
export function activeYears(films: readonly Pick<Film, "year" | "releaseDate">[], today: string): string {
  const out = films.filter((film) => isReleased(film.releaseDate, today));
  return yearSpan((out.length > 0 ? out : films).map((film) => film.year));
}

/** What goes between the names, and between the roles under them. */
export const TITLE_SEPARATOR = " × ";

/**
 * The line under the title: each person's main role joined with " × " (the title's own order), then the films: "Director × Cinematographer · 5 films".
 * One person: "Director · 30 films", and with the years they were active (`years`, from `activeYears`): "Director, Actor · 1966–2005 · 30 films". A pair with no film together
 * says so ("Director × Editor · No films together"). A person with no role to name is left out of the roles, and with none at all the line is just the films.
 * Cased as words: the page sets it in capitals.
 */
export function heroSubtitle(roles: readonly string[], count: number, several: boolean, years = ""): string {
  const named = roles.filter(Boolean);
  const films = several && count === 0 ? "No films together" : filmCountLabel(count);
  return [named.join(TITLE_SEPARATOR), years, films].filter(Boolean).join(" · ");
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

/** A film with what ranks it among a person's own: the most voted on TMDB is the best known. */
export interface RankedFilm extends HeroChip {
  voteCount: number;
}

/**
 * One person's films as chips, the best known first: the most TMDB votes (the same measure that picks the posters of a shared card, see `pickTimelineFilms`), and films
 * with as many in release order, then by title and id, so that the order is the same on every render. The first `CHIP_LIMIT` are the ones the hero shows.
 */
export function bestKnownChips(films: readonly RankedFilm[]): HeroChip[] {
  return [...films]
    .sort((a, b) => b.voteCount - a.voteCount || a.releaseDate.localeCompare(b.releaseDate) || a.title.localeCompare(b.title) || a.id - b.id)
    .map(({ id, title, year, releaseDate }) => ({ id, title, year, releaseDate }));
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
