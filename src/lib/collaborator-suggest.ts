/**
 * The "Frequent collaborators" of the Add a person field on a one-person page: the people they
 * work with most, offered as the first options of the field's dropdown while it is empty. Pure
 * rules (what the dropdown shows, how a row reads, what is announced), so they are testable and
 * the field's component only maps them to markup.
 */

import { filmCountLabel } from "@/lib/format";
import type { CollaboratorSuggestion } from "@/lib/types";

/** The heading of the group of options, and its accessible name. */
export const SUGGESTIONS_LABEL = "Frequent collaborators";

/** The most rows the dropdown lists (the API returns up to 10). */
export const SUGGESTION_LIMIT = 8;

/** Skeleton rows shown while the first request is in flight. */
export const SKELETON_ROWS = 4;

/**
 * Where the suggestions are:
 * idle     - not asked for yet (the field has not been focused)
 * loading  - the request is in flight
 * ready    - there are suggestions
 * hidden   - there is nothing to suggest, or the request failed: the field behaves as if the feature were off
 */
export type SuggestionsStatus = "idle" | "loading" | "ready" | "hidden";

/** Which list the dropdown shows: the suggestions, or the field's usual search results (and messages). */
export type PanelSection = "suggestions" | "search";

/**
 * What the dropdown is about. The suggestions are the zero state of the field: they show while the
 * field is enabled for them (a one-person page's Add a person field), has no text, and has
 * suggestions or is still loading them. Any text brings the usual search back (`query` is the
 * normalised text), so the two lists are never on screen together and the keyboard rows (the
 * indexes of `aria-activedescendant`, ArrowUp and ArrowDown, Enter) always belong to one list.
 */
export function panelSection(enabled: boolean, query: string, status: SuggestionsStatus): PanelSection {
  if (!enabled || query !== "") return "search";
  return status === "loading" || status === "ready" ? "suggestions" : "search";
}

/** The suggestions the dropdown lists: the best ones, in the order the API ranked them. */
export function listedSuggestions(results: readonly CollaboratorSuggestion[]): CollaboratorSuggestion[] {
  return results.slice(0, SUGGESTION_LIMIT);
}

/** The muted second line of a row: "Director, Writer · 11 films together" (just the count without roles). */
export function suggestionDetail(s: Pick<CollaboratorSuggestion, "roles" | "sharedCount">): string {
  return [s.roles, `${filmCountLabel(s.sharedCount)} together`].filter(Boolean).join(" · ");
}

/** "Together in Jaws, Duel and 1941" (the row's tooltip), or null when there are no titles to name. */
export function suggestionTitle(s: Pick<CollaboratorSuggestion, "titles">): string | null {
  if (s.titles.length === 0) return null;
  return `Together in ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(s.titles)}`;
}

/** The live-region text when the suggestions open: how many there are (or that they are on their way). */
export function suggestionsAnnouncement(status: SuggestionsStatus, count: number): string {
  if (status === "loading") return "Loading frequent collaborators";
  if (status !== "ready" || count === 0) return "";
  return `${count} frequent ${count === 1 ? "collaborator" : "collaborators"}`;
}
