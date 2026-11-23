import { carryBaconMode } from "@/lib/bacon-mode";
import { carryView } from "@/lib/films-view";
import { buildPeopleSlug } from "@/lib/slug";

/** Matches the cap enforced by parsePeopleSlug: a timeline holds at most this many people. */
export const MAX_PEOPLE = 4;

export interface PersonRef {
  id: number;
  name: string;
}

/** "can-add": appending is possible. "in-view": already on the timeline. "full": no room left. */
export type AddState = "can-add" | "in-view" | "full";

/** Drops repeated ids (first one wins) and anything past MAX_PEOPLE. */
export function dedupePeople(people: readonly PersonRef[]): PersonRef[] {
  const seen = new Set<number>();
  const kept: PersonRef[] = [];
  for (const person of people) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    kept.push(person);
  }
  return kept.slice(0, MAX_PEOPLE);
}

/** True when the timeline cannot take another person. `max` is a lower cap than MAX_PEOPLE (Kevin Bacon mode holds two). */
export function isTimelineFull(inView: readonly PersonRef[], max: number = MAX_PEOPLE): boolean {
  return dedupePeople(inView).length >= Math.min(max, MAX_PEOPLE);
}

/** "in-view" wins over "full" so people already on the timeline keep their badge. */
export function addState(inView: readonly PersonRef[], personId: number, max: number = MAX_PEOPLE): AddState {
  if (inView.some((p) => p.id === personId)) return "in-view";
  return isTimelineFull(inView, max) ? "full" : "can-add";
}

/** `[...inView, picked]` deduped by id and capped, or null when picking would be a no-op. */
export function extendedPeople(
  inView: readonly PersonRef[],
  picked: PersonRef,
): PersonRef[] | null {
  if (addState(inView, picked.id) !== "can-add") return null;
  return [...dedupePeople(inView), picked];
}

/**
 * `/p/<slug>` for the timeline with `picked` appended, or null when adding is a no-op. Pass the
 * query of the page the visitor is on (`window.location.search`, read when they act) as
 * `currentSearch` to keep them on the tab (Timeline or Table) they were looking at: see `carryView`.
 */
export function extendedPeopleHref(
  inView: readonly PersonRef[],
  picked: PersonRef,
  currentSearch?: string,
): string | null {
  const people = extendedPeople(inView, picked);
  if (!people) return null;
  const href = `/p/${buildPeopleSlug(people)}`;
  return currentSearch === undefined ? href : carryView(href, currentSearch);
}

/**
 * `href` for a navigation from the page of `currentPeople` to another page of people (one of them removed, or only one of them): what the page the
 * visitor is on carries to the next, its view (`carryView`) and Kevin Bacon mode (`carryBaconMode`, while he is still on the page arrived at).
 * `currentSearch` is that page's query, read from the address (`window.location.search`, or the router's `useSearchParams`). The home page
 * (no one is left) has neither a view nor a mode, and is returned as it is.
 */
export function carriedPeopleHref(href: string, currentSearch: string, currentPeople: readonly PersonRef[]): string {
  if (!href.startsWith("/p/")) return href;
  return carryBaconMode(carryView(href, currentSearch), currentSearch, currentPeople.map((person) => person.id));
}
