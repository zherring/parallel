import { describe, expect, it } from "vitest";
import { carryView } from "@/lib/films-view";
import { withDepth } from "@/lib/depth-url";
import {
  NOTHING_PENDING,
  finalPeople,
  hasPendingChange,
  hasRoom,
  isStagedAdd,
  isStagedRemoval,
  pendingHref,
  stageAdd,
  stageRemove,
  type PendingPeople,
  type StagedPerson,
} from "@/lib/pending-people";

const person = (id: number, name = `Person ${id}`): StagedPerson => ({ id, name, profilePath: null });
const A = person(1, "Ann Alpha");
const B = person(2, "Bo Beta");
const C = person(3, "Cy Gamma");
const D = person(4, "Di Delta");
const E = person(5, "Ed Epsilon");
const ids = (people: readonly { id: number }[]) => people.map((p) => p.id);

describe("finalPeople", () => {
  it("is the page's people when nothing is staged", () => {
    expect(finalPeople([A, B], NOTHING_PENDING)).toEqual([A, B]);
  });

  it("drops the removed and keeps the order of the rest", () => {
    expect(ids(finalPeople([A, B, C], { added: [], removed: [2] }))).toEqual([1, 3]);
  });

  it("puts the added after the people who stay, in the order they were added", () => {
    expect(ids(finalPeople([A, B], { added: [D, C], removed: [] }))).toEqual([1, 2, 4, 3]);
    expect(ids(finalPeople([A, B], { added: [C], removed: [1] }))).toEqual([2, 3]);
  });

  it("keeps only the id and the name of an added person, which is what the slug and the pickers need", () => {
    expect(finalPeople([A], { added: [{ ...B, profilePath: "/b.jpg" }], removed: [] })[1]).toEqual({ id: 2, name: "Bo Beta" });
  });
});

describe("stageAdd", () => {
  it("adds a person at the end", () => {
    const pending = stageAdd([A, B], NOTHING_PENDING, C);
    expect(pending.added).toEqual([C]);
    expect(ids(finalPeople([A, B], pending))).toEqual([1, 2, 3]);
    expect(isStagedAdd(pending, 3)).toBe(true);
  });

  it("keeps the order people were added in", () => {
    let pending = stageAdd([A], NOTHING_PENDING, C);
    pending = stageAdd([A], pending, B);
    expect(ids(finalPeople([A], pending))).toEqual([1, 3, 2]);
  });

  it("does nothing for someone the page has or will have", () => {
    expect(stageAdd([A, B], NOTHING_PENDING, A)).toBe(NOTHING_PENDING);
    const pending = stageAdd([A], NOTHING_PENDING, C);
    expect(stageAdd([A], pending, C)).toBe(pending);
  });

  it("takes back the removal of someone on the page, at the place they had", () => {
    const removed = stageRemove([A, B, C], NOTHING_PENDING, 2);
    expect(isStagedRemoval(removed, 2)).toBe(true);
    const restored = stageAdd([A, B, C], removed, B);
    expect(restored).toEqual(NOTHING_PENDING);
    expect(ids(finalPeople([A, B, C], restored))).toEqual([1, 2, 3]);
  });

  it("stops at the most people a page holds (4), counting the staged ones", () => {
    expect(hasRoom([A, B, C], NOTHING_PENDING)).toBe(true);
    const full = stageAdd([A, B, C], NOTHING_PENDING, D);
    expect(hasRoom([A, B, C], full)).toBe(false);
    expect(stageAdd([A, B, C], full, E)).toBe(full);
    // A page that is full has no room until someone is staged to leave, and then there is exactly one place.
    expect(stageAdd([A, B, C, D], NOTHING_PENDING, E)).toBe(NOTHING_PENDING);
    const gone = stageRemove([A, B, C, D], NOTHING_PENDING, 4);
    expect(hasRoom([A, B, C, D], gone)).toBe(true);
    expect(ids(finalPeople([A, B, C, D], stageAdd([A, B, C, D], gone, E)))).toEqual([1, 2, 3, 5]);
  });

  it("cannot take back a removal that would overfill the page", () => {
    // [A B C D], D removed, E added: the page would be A B C E; taking D back would make five.
    let pending: PendingPeople = stageRemove([A, B, C, D], NOTHING_PENDING, 4);
    pending = stageAdd([A, B, C, D], pending, E);
    expect(stageAdd([A, B, C, D], pending, D)).toBe(pending);
  });
});

describe("stageRemove", () => {
  it("stages the removal of someone on the page", () => {
    const pending = stageRemove([A, B], NOTHING_PENDING, 1);
    expect(pending.removed).toEqual([1]);
    expect(ids(finalPeople([A, B], pending))).toEqual([2]);
  });

  it("takes back someone staged to join, instead of marking them removed", () => {
    const joined = stageAdd([A, B], NOTHING_PENDING, C);
    const taken = stageRemove([A, B], joined, 3);
    expect(taken).toEqual(NOTHING_PENDING);
  });

  it("does nothing for someone who is not on the page, or already staged to leave", () => {
    expect(stageRemove([A, B], NOTHING_PENDING, 9)).toBe(NOTHING_PENDING);
    const pending = stageRemove([A, B], NOTHING_PENDING, 1);
    expect(stageRemove([A, B], pending, 1)).toBe(pending);
  });

  it("can remove everyone", () => {
    let pending: PendingPeople = stageRemove([A, B], NOTHING_PENDING, 1);
    pending = stageRemove([A, B], pending, 2);
    expect(finalPeople([A, B], pending)).toEqual([]);
  });
});

describe("hasPendingChange", () => {
  it("is false with nothing staged", () => {
    expect(hasPendingChange([A, B], NOTHING_PENDING)).toBe(false);
  });

  it("is true for an addition, a removal, or both", () => {
    expect(hasPendingChange([A, B], stageAdd([A, B], NOTHING_PENDING, C))).toBe(true);
    expect(hasPendingChange([A, B], stageRemove([A, B], NOTHING_PENDING, 1))).toBe(true);
    const both = stageAdd([A, B], stageRemove([A, B], NOTHING_PENDING, 1), C);
    expect(hasPendingChange([A, B], both)).toBe(true);
    expect(ids(finalPeople([A, B], both))).toEqual([2, 3]);
  });

  it("is false when the changes cancel out", () => {
    const joined = stageAdd([A, B], NOTHING_PENDING, C);
    expect(hasPendingChange([A, B], stageRemove([A, B], joined, 3))).toBe(false);
    const gone = stageRemove([A, B], NOTHING_PENDING, 1);
    expect(hasPendingChange([A, B], stageAdd([A, B], gone, A))).toBe(false);
  });

  it("is true when the same people would be in another order, which is not a case the stages make but the rule is about the page", () => {
    expect(hasPendingChange([A, B], { added: [], removed: [] })).toBe(false);
    // Removing the first and adding them back as a new person puts them last: not staged by the controls (they restore), but a different page.
    expect(hasPendingChange([A, B], { added: [A], removed: [1] })).toBe(true);
  });
});

describe("pendingHref", () => {
  const carry = (href: string) => `${href}?carried`;

  it("is null when nothing would change", () => {
    expect(pendingHref([A, B], NOTHING_PENDING, carry)).toBeNull();
    expect(pendingHref([A, B], stageRemove([A, B], stageAdd([A, B], NOTHING_PENDING, C), 3), carry)).toBeNull();
  });

  it("is the page of the final people, in order, with the view carried", () => {
    const href = pendingHref([A, B], stageAdd([A, B], NOTHING_PENDING, C), carry);
    expect(href).toBe("/p/1-ann-alpha+2-bo-beta+3-cy-gamma?carried");
    expect(pendingHref([A, B, C], stageRemove([A, B, C], NOTHING_PENDING, 2), carry)).toBe("/p/1-ann-alpha+3-cy-gamma?carried");
  });

  it("makes every staged change in one address", () => {
    let pending: PendingPeople = stageRemove([A, B], NOTHING_PENDING, 1);
    pending = stageAdd([A, B], pending, D);
    pending = stageAdd([A, B], pending, C);
    expect(pendingHref([A, B], pending, carry)).toBe("/p/2-bo-beta+4-di-delta+3-cy-gamma?carried");
  });

  it("goes home when no one is left, without asking for a view", () => {
    let pending: PendingPeople = stageRemove([A, B], NOTHING_PENDING, 1);
    pending = stageRemove([A, B], pending, 2);
    expect(pendingHref([A, B], pending, () => { throw new Error("home has no view"); })).toBe("/");
  });

  it("keeps the view the visitor is on, through the page's own rules", () => {
    const pending = stageAdd([A, B], NOTHING_PENDING, C);
    // The flat page: the Table (named) travels; the plain address stays plain.
    expect(pendingHref([A, B], pending, (href) => carryView(href, "?view=table"))).toBe("/p/1-ann-alpha+2-bo-beta+3-cy-gamma?view=table");
    expect(pendingHref([A, B], pending, (href) => carryView(href, ""))).toBe("/p/1-ann-alpha+2-bo-beta+3-cy-gamma");
    // The Films view: always named.
    expect(pendingHref([A, B], pending, withDepth)).toBe("/p/1-ann-alpha+2-bo-beta+3-cy-gamma?view=depth");
  });
});
