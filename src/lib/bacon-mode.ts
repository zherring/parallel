import type { PersonSearchResult } from "@/lib/types";

/**
 * Kevin Bacon mode: a mode of the new-timeline search (the landing page's field and the ⌘K dialog), after the "Six Degrees of
 * Kevin Bacon" game. Searching for him offers the mode as a row of its own; choosing it puts him in the field as a chip that
 * stays, turns the field's action colour orange (`[data-bacon-mode]` in globals.css), and from then on only people who share a
 * film with him can be added, one at a time: the mode makes pairs with Kevin Bacon and nothing else. Removing his chip leaves it.
 *
 * Pure rules and copy; the field's component maps them to markup, and `/api/search?with=` (src/lib/worked-with.ts) does the checking.
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
export function baconPlaceholder(chipCount: number): { long: string; short: string } {
  return chipCount >= BACON_MODE_MAX
    ? { long: "Press Enter to see their films together", short: "Enter to go…" }
    : { long: `Who has worked with ${BACON.name}?`, short: "Worked with Bacon…" };
}
