import { buildPeopleSlug } from "@/lib/slug";
import type { PairingSearchResult, PersonSearchResult, TeamSuggestion } from "@/lib/types";

/**
 * Kevin Bacon mode: a mode of the new-timeline search (the site's search dialog, which the landing page's bar and ⌘K open), after the "Six Degrees of
 * Kevin Bacon" game. Searching for him offers the mode as a row of its own; choosing it puts him in the field as a chip that
 * stays, turns the field's action colour orange (`[data-bacon-mode]` in globals.css), and from then on only people who share a
 * film with him can be added, one at a time: the mode makes pairs with Kevin Bacon and nothing else. Removing his chip leaves it.
 *
 * The mode goes on to the page the field opens, in its address (`?mode=bacon`, see `isBaconPage`): the page's "made together"
 * is orange where a pair's is white, and its own ways of adding a person (the people pill, ⌘K, a film's cast) keep the mode's
 * rules. It lasts for as long as he is on the page and the address says so.
 *
 * The one thing that is not a pair is a team (`/api/teams/{id}`, src/lib/teams.ts): two people who made films with him
 * together, which the empty field lists and opens as the three of them.
 *
 * Pure rules and copy; the components map them to markup, and `/api/search?with=` (src/lib/worked-with.ts) does the checking.
 */

/** The person the mode is about, by TMDB id. The name is TMDB's own, so a slug built from it is the canonical one. */
export const BACON = { id: 4724, name: "Kevin Bacon" } as const;

/** The mode holds Kevin Bacon and one other person. */
export const BACON_MODE_MAX = 2;

/** The search option that enters the mode. `person` is the search result it came with, so the chip has the current photo. */
export interface ModeOption {
  mode: "bacon";
  person: Pick<PersonSearchResult, "id" | "name" | "profilePath">;
}

/**
 * The mode's row for these results, or null. It is offered where a new timeline starts (chips mode with no chips yet, outside
 * the mode) and only when he is the first result: the row follows him, it never pushes into a search for somebody else.
 */
export function baconModeOffer(
  results: readonly PersonSearchResult[],
  { chipCount, active }: { chipCount: number; active: boolean },
): ModeOption | null {
  const first = results[0];
  if (active || chipCount > 0 || first?.id !== BACON.id) return null;
  return { mode: "bacon", person: { id: first.id, name: first.name, profilePath: first.profilePath } };
}

/** A search result can be added in the mode only when it is known to share a film with him. */
export function workedWithBacon(result: Pick<PersonSearchResult, "together">): boolean {
  return (result.together ?? 0) > 0;
}

/** The mode's results: the people who can be added first, each group in the order the search ranked it. */
export function orderForMode<T extends Pick<PersonSearchResult, "together">>(results: readonly T[]): T[] {
  return [...results.filter(workedWithBacon), ...results.filter((result) => !workedWithBacon(result))];
}

/** The muted line of a result in the mode: how many films they share with him, or why they cannot be added. */
export function togetherNote(together: number | null | undefined): string {
  if (together === null || together === undefined) return `Could not check for films with ${BACON.name}`;
  if (together === 0) return `No films with ${BACON.name}`;
  return `${together} ${together === 1 ? "film" : "films"} with ${BACON.name}`;
}

export const BACON_MODE_LABEL = `${BACON.name} mode`;
/** The second line of the row that offers the mode. */
export const BACON_MODE_PITCH = "Pair him with anyone he has shared a film with.";
/** The line at the top of the dropdown while the mode is on. */
export const BACON_MODE_RULE = `Only people who have shared a film with ${BACON.name}. Remove him to leave.`;
/** The heading of the suggestions the empty field offers in the mode. */
export const BACON_SUGGESTIONS_LABEL = `Often with ${BACON.name}`;
export const BACON_FULL_MESSAGE = `${BACON.name} mode is one person at a time`;
export const BACON_ENTERED_MESSAGE = `${BACON_MODE_LABEL} is on. Only people who have shared a film with him can be added.`;
export const BACON_LEFT_MESSAGE = `${BACON_MODE_LABEL} is off.`;

/** Live-region text after the second person was added. */
export function baconAddedMessage(name: string): string {
  return `Added ${name}. Press Enter to see their films with ${BACON.name}.`;
}

/** The field's placeholder in the mode (`short` for a field too narrow for `long`). */
export function baconPlaceholder(chipCount: number, page = false): { long: string; short: string } {
  if (page && chipCount >= BACON_MODE_MAX) return { long: `${BACON_MODE_LABEL} is full`, short: `${BACON_MODE_LABEL} is full` };
  return chipCount >= BACON_MODE_MAX
    ? { long: "Press Enter to see their films together", short: "Enter to go…" }
    : { long: `Who has worked with ${BACON.name}?`, short: "Worked with Bacon…" };
}

// ---------------------------------------------------------------------------------------------
// The mode on a /p/ page
// ---------------------------------------------------------------------------------------------

/** The address's own word for the mode: `?mode=bacon`. */
export const MODE_PARAM = "mode";
export const BACON_MODE_VALUE = "bacon";

type ParamValue = string | string[] | undefined;

/** Whether a query (a page's `searchParams`, or a query string with or without its "?") names the mode. */
export function namesBaconMode(search: string | URLSearchParams | Record<string, ParamValue>): boolean {
  if (typeof search === "string" || search instanceof URLSearchParams) {
    return new URLSearchParams(search).get(MODE_PARAM) === BACON_MODE_VALUE;
  }
  const value = search[MODE_PARAM];
  return (Array.isArray(value) ? value[0] : value) === BACON_MODE_VALUE;
}

/** Whether a page is in the mode: its address says so, and he is one of its people. Without him the word in the address means nothing. */
export function isBaconPage(query: string | URLSearchParams | Record<string, ParamValue>, personIds: readonly number[]): boolean {
  return namesBaconMode(query) && personIds.includes(BACON.id);
}

/** Whether `href` is a `/p/` page he is on (his id is one of the slug's). */
function hasBacon(href: string): boolean {
  const slug = /^\/p\/([^?#]*)/.exec(href)?.[1] ?? "";
  return slug.split("+").some((part) => part === String(BACON.id) || part.startsWith(`${BACON.id}-`));
}

/** `href` with `mode=bacon` in its query (before a hash), whatever else it has. */
export function withBaconMode(href: string): string {
  const hash = href.indexOf("#");
  const beforeHash = hash === -1 ? href : href.slice(0, hash);
  const rest = hash === -1 ? "" : href.slice(hash);
  const query = beforeHash.indexOf("?");
  const path = query === -1 ? beforeHash : beforeHash.slice(0, query);
  const params = new URLSearchParams(query === -1 ? "" : beforeHash.slice(query + 1));
  params.set(MODE_PARAM, BACON_MODE_VALUE);
  return `${path}?${params.toString()}${rest}`;
}

/**
 * `href` for a navigation from a page in the mode to another page of people (a person added or removed): the mode goes
 * along when the page left (`currentSearch`, its query) is in it and he is still on the page arrived at; a page without him
 * is an ordinary page.
 */
export function carryBaconMode(href: string, currentSearch: string): string {
  return namesBaconMode(currentSearch) && hasBacon(href) ? withBaconMode(href) : href;
}

/** The query (with its "?", or "") of the same page out of the mode: what the bar's "leave" link writes. */
export function searchWithoutBaconMode(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(MODE_PARAM);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The page the field's chips open in the mode: him and the other person, with the mode in the address. */
export function baconPageHref(people: readonly { id: number; name: string }[]): string {
  return withBaconMode(`/p/${buildPeopleSlug([...people])}`);
}

/** What a full field says in the mode's dropdown, in the landing field (Enter goes) and on a page (the other person has to leave first). */
export function baconFullRule(page: boolean): string {
  return page
    ? `${BACON_FULL_MESSAGE}. Remove the other person to choose someone else.`
    : `${BACON_FULL_MESSAGE}. Press Enter to see their films together.`;
}

/** What the people pill's legend says of the mode's colour. */
export const BACON_TOGETHER_LEGEND = "Orange: made together by everyone shown";
/** Why a film's cast cannot be added from: he is not in the film, so its people may never have worked with him. */
export const BACON_FILM_TITLE = `${BACON_MODE_LABEL}: only people from his own films can be added`;

// ---------------------------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------------------------

/** The heading of the teams the empty field lists in the mode. */
export const BACON_TEAMS_LABEL = `Teams with ${BACON.name}`;

/**
 * A team as an option of the field: a row like a curated pairing's (the two names, the count, the films), which opens the
 * page of the three of them, in the mode.
 */
export function teamOption(team: TeamSuggestion): PairingSearchResult {
  return {
    href: baconPageHref([BACON, ...team.people.map(({ id, name }) => ({ id, name }))]),
    people: [...team.people],
    sharedCount: team.sharedCount,
    blurb: team.titles.join(", "),
  };
}
