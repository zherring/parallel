import { carryView } from "@/lib/films-view";
import { buildPeopleSlug, parsePeopleSlug } from "@/lib/slug";

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

/** True when the timeline cannot take another person. */
export function isTimelineFull(inView: readonly PersonRef[]): boolean {
  return dedupePeople(inView).length >= MAX_PEOPLE;
}

/** "in-view" wins over "full" so people already on the timeline keep their badge. */
export function addState(inView: readonly PersonRef[], personId: number): AddState {
  if (inView.some((p) => p.id === personId)) return "in-view";
  return isTimelineFull(inView) ? "full" : "can-add";
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
 * The people on a `/p/<slug>` page, read back from its pathname (names come from the slug text,
 * which is enough to rebuild an equivalent slug). Any other pathname gives an empty list.
 */
export function peopleFromPathname(pathname: string): PersonRef[] {
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname);
  if (!match) return [];
  const parsed = parsePeopleSlug(match[1]);
  if (!parsed) return [];

  let text = parsed.canonical;
  if (text === undefined) {
    try {
      text = decodeURIComponent(match[1]);
    } catch {
      return [];
    }
  }

  return text.split("+").flatMap((segment) => {
    const parts = /^(\d+)(?:-(.*))?$/.exec(segment);
    return parts ? [{ id: Number(parts[1]), name: (parts[2] ?? "").replace(/-/g, " ") }] : [];
  });
}
