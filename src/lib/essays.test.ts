import { describe, expect, it } from "vitest";
import { getPairEssays, pairEssaysFrom, type Essay, type EssaysData } from "@/lib/essays";

const essay = (overrides: Partial<Essay> = {}): Essay => ({
  title: "Placeholder title",
  author: "Placeholder Author",
  publication: "Example Review",
  date: "2000-01-01",
  url: "https://example.com/a",
  kind: "essay",
  pull: null,
  summary: "Placeholder summary.",
  paywalled: false,
  via: null,
  ...overrides,
});

const FIXTURE: EssaysData = {
  "10+20": {
    pair: ["Person One", "Person Two"],
    tmdb_ids: [10, 20],
    // Deliberately not in date order: the data's order is the curated one.
    essays: [
      essay({ title: "best", date: "2020" }),
      essay({ title: "second", date: "1990-05" }),
      essay({ title: "third", date: "2010-01-01" }),
    ],
  },
  "30+40": { pair: ["Person Three", "Person Four"], tmdb_ids: [30, 40], essays: [] },
};

describe("pairEssaysFrom", () => {
  it("returns the essays of a pair that has some, in the order the data gives them", () => {
    expect(pairEssaysFrom(FIXTURE, [10, 20])?.map((e) => e.title)).toEqual(["best", "second", "third"]);
  });

  it("finds the pair whichever order the people are in", () => {
    expect(pairEssaysFrom(FIXTURE, [20, 10])).toHaveLength(3);
  });

  it("returns a copy, leaving the data as it was", () => {
    const essays = pairEssaysFrom(FIXTURE, [10, 20]);
    expect(essays).not.toBe(FIXTURE["10+20"].essays);
    essays?.reverse();
    expect(FIXTURE["10+20"].essays.map((e) => e.title)).toEqual(["best", "second", "third"]);
  });

  it("is null unless there are exactly two people", () => {
    expect(pairEssaysFrom(FIXTURE, [])).toBeNull();
    expect(pairEssaysFrom(FIXTURE, [10])).toBeNull();
    expect(pairEssaysFrom(FIXTURE, [10, 20, 30])).toBeNull();
  });

  it("is null for a pair with no entry", () => {
    expect(pairEssaysFrom(FIXTURE, [10, 30])).toBeNull();
    expect(pairEssaysFrom({}, [10, 20])).toBeNull();
  });

  it("is null for an entry with no essays", () => {
    expect(pairEssaysFrom(FIXTURE, [30, 40])).toBeNull();
  });
});

describe("getPairEssays", () => {
  it("reads essays.json, which has no entry for ids that are not TMDB ids", () => {
    expect(getPairEssays([-1, -2])).toBeNull();
  });

  it("has essays for the pairs it was curated for, whichever order they are asked in", () => {
    expect(getPairEssays([488, 491])?.length).toBeGreaterThan(0);
    expect(getPairEssays([491, 488])).toEqual(getPairEssays([488, 491]));
  });
});
