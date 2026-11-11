import { peopleHref } from "@/lib/lanes";
import { MAX_PEOPLE, type PersonRef } from "@/lib/people-nav";

/**
 * Who is on a `/p/` page while a panel or an overlay that changes it is open (the film's panel, the people pill's card, the ⌘K people search): adding
 * and removing a person there only stages the change, and the page behind is not redrawn. Closing the last of them applies every staged change in one
 * navigation (`pendingHref`). Pure, like the other rules of the people on a page (people-nav.ts, lanes.ts): the page's provider (`PeopleStagingProvider`) holds the
 * state and these decide.
 */

/** A person added while a panel was open: what the search or the film's cast had of them, which is what their row shows until the page has them. */
export interface StagedPerson extends PersonRef {
  profilePath: string | null;
}

/** The changes staged on the page's people: who was added (in the order they were) and the ids of those on the page who were removed. */
export interface PendingPeople {
  added: readonly StagedPerson[];
  removed: readonly number[];
}

export const NOTHING_PENDING: PendingPeople = { added: [], removed: [] };

/**
 * The people the page will have once the staged changes apply: those it has, in their order, but for the removed, then the added in the order they were added.
 * This is who a picker works from while the panel is open (a staged person is "in the timeline", a removed one can be added back, and the page is full at
 * `MAX_PEOPLE` of them).
 */
export function finalPeople(current: readonly PersonRef[], pending: PendingPeople): PersonRef[] {
  const gone = new Set(pending.removed);
  const kept = current.filter((person) => !gone.has(person.id));
  const present = new Set(kept.map((person) => person.id));
  const added = pending.added.filter((person) => !present.has(person.id)).map(({ id, name }) => ({ id, name }));
  return [...kept, ...added];
}

/** Whether the person is staged to join the page. */
export function isStagedAdd(pending: PendingPeople, personId: number): boolean {
  return pending.added.some((person) => person.id === personId);
}

/** Whether the person is on the page now and staged to leave it. */
export function isStagedRemoval(pending: PendingPeople, personId: number): boolean {
  return pending.removed.includes(personId);
}

/** Whether there is room for one more person once the staged changes apply. */
export function hasRoom(current: readonly PersonRef[], pending: PendingPeople): boolean {
  return finalPeople(current, pending).length < MAX_PEOPLE;
}

/**
 * Stages adding a person. A person who is on the page and staged to leave is taken back (their place in the order is the one they had); anyone else joins at the end.
 * Nothing changes for a person the page will already have, or when it is full.
 */
export function stageAdd(current: readonly PersonRef[], pending: PendingPeople, person: StagedPerson): PendingPeople {
  const final = finalPeople(current, pending);
  if (final.length >= MAX_PEOPLE) return pending;
  if (isStagedRemoval(pending, person.id)) return { ...pending, removed: pending.removed.filter((id) => id !== person.id) };
  if (final.some((onPage) => onPage.id === person.id)) return pending;
  return { ...pending, added: [...pending.added, person] };
}

/**
 * Stages removing a person: one staged to join is simply taken back, one on the page is staged to leave (`stageAdd` takes that back too). Nothing changes for
 * anyone else, or for one already staged to leave.
 */
export function stageRemove(current: readonly PersonRef[], pending: PendingPeople, personId: number): PendingPeople {
  if (isStagedAdd(pending, personId)) return { ...pending, added: pending.added.filter((person) => person.id !== personId) };
  if (current.some((person) => person.id === personId) && !isStagedRemoval(pending, personId)) return { ...pending, removed: [...pending.removed, personId] };
  return pending;
}

/** Whether applying the staged changes would change the page: who is on it, or their order. A person added and taken back, or removed and restored, changes nothing. */
export function hasPendingChange(current: readonly PersonRef[], pending: PendingPeople): boolean {
  const final = finalPeople(current, pending);
  return final.length !== current.length || final.some((person, index) => person.id !== current[index].id);
}

/**
 * The address the staged changes lead to, or null when applying them would change nothing. It is the page of the final people (`peopleHref`: the home page
 * when no one is left) with the view the visitor is on kept: `carry` is the page's own rule for that (the flat page's `carryView`, which reads the address it is
 * on; the Films view's `withDepth`), and is not asked for the home page, which has no view.
 */
export function pendingHref(current: readonly PersonRef[], pending: PendingPeople, carry: (href: string) => string): string | null {
  if (!hasPendingChange(current, pending)) return null;
  const final = finalPeople(current, pending);
  const href = peopleHref(final);
  return final.length === 0 ? href : carry(href);
}
