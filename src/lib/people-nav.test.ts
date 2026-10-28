import { describe, expect, it } from "vitest";
import {
  MAX_PEOPLE,
  addState,
  dedupePeople,
  extendedPeopleHref,
  extendedPeople,
  isTimelineFull,
  peopleFromPathname,
} from "@/lib/people-nav";
import { parsePeopleSlug } from "@/lib/slug";

const fincher = { id: 7467, name: "David Fincher" };
const pitt = { id: 287, name: "Brad Pitt" };
const cronenweth = { id: 7479, name: "Jeff Cronenweth" };
const norton = { id: 819, name: "Edward Norton" };
const carter = { id: 1283, name: "Helena Bonham Carter" };

describe("dedupePeople", () => {
  it("keeps the first of each id and caps at MAX_PEOPLE", () => {
    expect(dedupePeople([fincher, pitt, { id: 7467, name: "Other" }])).toEqual([fincher, pitt]);
    expect(dedupePeople([fincher, pitt, cronenweth, norton, carter])).toHaveLength(MAX_PEOPLE);
  });
});

describe("addState", () => {
  it("allows adding to an empty or partial timeline", () => {
    expect(addState([], 7467)).toBe("can-add");
    expect(addState([fincher], 287)).toBe("can-add");
  });

  it("reports people already in view", () => {
    expect(addState([fincher, pitt], 287)).toBe("in-view");
  });

  it("reports a full timeline, but in-view still wins", () => {
    const full = [fincher, pitt, cronenweth, norton];
    expect(addState(full, carter.id)).toBe("full");
    expect(addState(full, pitt.id)).toBe("in-view");
  });
});

describe("isTimelineFull", () => {
  it("is true at four distinct people", () => {
    expect(isTimelineFull([fincher, pitt, cronenweth])).toBe(false);
    expect(isTimelineFull([fincher, pitt, cronenweth, norton])).toBe(true);
    expect(isTimelineFull([fincher, fincher, fincher, fincher])).toBe(false);
  });
});

describe("extendedPeople / extendedPeopleHref", () => {
  it("appends the picked person in order", () => {
    expect(extendedPeople([fincher], pitt)).toEqual([fincher, pitt]);
    expect(extendedPeopleHref([fincher], pitt)).toBe("/p/7467-david-fincher+287-brad-pitt");
  });

  it("starts a timeline from nothing", () => {
    expect(extendedPeopleHref([], fincher)).toBe("/p/7467-david-fincher");
  });

  it("is a no-op for people already in view", () => {
    expect(extendedPeople([fincher, pitt], pitt)).toBeNull();
    expect(extendedPeopleHref([fincher, pitt], pitt)).toBeNull();
  });

  it("keeps the visitor on the table when they add a person from it", () => {
    expect(extendedPeopleHref([fincher], pitt, "?view=table")).toBe("/p/7467-david-fincher+287-brad-pitt?view=table");
    // a sorted link is the table too; the sort does not travel to the new page
    expect(extendedPeopleHref([fincher], pitt, "?sort=rating&dir=desc")).toBe(
      "/p/7467-david-fincher+287-brad-pitt?view=table",
    );
  });

  it("leaves the href plain when they add a person from the timeline", () => {
    expect(extendedPeopleHref([fincher], pitt, "")).toBe("/p/7467-david-fincher+287-brad-pitt");
    expect(extendedPeopleHref([fincher], pitt, "?view=timeline&sort=rating&dir=desc")).toBe(
      "/p/7467-david-fincher+287-brad-pitt",
    );
  });

  it("is still a no-op when adding is, whatever the view", () => {
    expect(extendedPeopleHref([fincher, pitt], pitt, "?view=table")).toBeNull();
  });

  it("is a no-op when the timeline is full", () => {
    expect(extendedPeopleHref([fincher, pitt, cronenweth, norton], carter)).toBeNull();
  });

  it("produces slugs the page can parse", () => {
    const href = extendedPeopleHref([fincher, pitt, cronenweth], norton)!;
    expect(parsePeopleSlug(href.replace("/p/", ""))).toEqual({ ids: [7467, 287, 7479, 819] });
  });

  it("ignores duplicate entries already in the list", () => {
    expect(extendedPeopleHref([fincher, fincher], pitt)).toBe("/p/7467-david-fincher+287-brad-pitt");
  });
});

describe("peopleFromPathname", () => {
  it("reads people back from a /p/ pathname", () => {
    expect(peopleFromPathname("/p/7467-david-fincher+287-brad-pitt")).toEqual([
      { id: 7467, name: "david fincher" },
      { id: 287, name: "brad pitt" },
    ]);
  });

  it("handles an encoded plus and a trailing slash", () => {
    expect(peopleFromPathname("/p/7467-david-fincher%2B287-brad-pitt/")).toHaveLength(2);
  });

  it("round-trips through extendedPeopleHref", () => {
    const inView = peopleFromPathname("/p/7467-david-fincher");
    expect(extendedPeopleHref(inView, pitt)).toBe("/p/7467-david-fincher+287-brad-pitt");
  });

  it("copes with bare ids and drops duplicates", () => {
    expect(peopleFromPathname("/p/7467+7467")).toEqual([{ id: 7467, name: "" }]);
  });

  it("returns nothing for other routes or bad slugs", () => {
    expect(peopleFromPathname("/")).toEqual([]);
    expect(peopleFromPathname("/about")).toEqual([]);
    expect(peopleFromPathname("/p/not-a-slug")).toEqual([]);
    expect(peopleFromPathname("/p/1+2+3+4+5")).toEqual([]);
  });
});
