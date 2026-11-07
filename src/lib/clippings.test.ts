import { describe, expect, it } from "vitest";
import {
  clippingYear,
  getPairClippings,
  getPairClippingSet,
  pairClippingsFrom,
  sortClippings,
  type Clipping,
  type ClippingsData,
} from "@/lib/clippings";

const clipping = (overrides: Partial<Clipping> = {}): Clipping => ({
  speaker: "Person One",
  about: "Person Two",
  quote: "Placeholder quote.",
  film: null,
  said_year: null,
  publication: "Example Times",
  title: "Placeholder headline",
  date: "2000-01-01",
  url: "https://example.com/a",
  context: "Placeholder context.",
  secondhand: false,
  ...overrides,
});

const FIXTURE: ClippingsData = {
  "10+20": {
    pair: ["Person One", "Person Two"],
    tmdb_ids: [10, 20],
    clippings: [
      clipping({ quote: "undated", said_year: null, date: "2010-05-01" }),
      clipping({ quote: "newest", said_year: 2015 }),
      clipping({ quote: "oldest", said_year: 1990, date: "2012-01-01" }),
    ],
  },
  "30+40": { pair: ["Person Three", "Person Four"], tmdb_ids: [30, 40], clippings: [] },
  "50+60": { pair: ["Only One Name"], tmdb_ids: [50, 60], clippings: [clipping()] },
};

describe("clippingYear", () => {
  it("is the year it was said", () => {
    expect(clippingYear({ said_year: 1977, date: "2012-05-01" })).toBe(1977);
  });

  it("falls back to the year of the article, written in full or as a year", () => {
    expect(clippingYear({ said_year: null, date: "2012-05-01" })).toBe(2012);
    expect(clippingYear({ said_year: null, date: "2012" })).toBe(2012);
  });

  it("is null when neither is a year", () => {
    expect(clippingYear({ said_year: null, date: "" })).toBeNull();
    expect(clippingYear({ said_year: null, date: "n.d." })).toBeNull();
  });
});

describe("sortClippings", () => {
  it("puts the oldest first, by the year said and else the year of the article", () => {
    const sorted = sortClippings(FIXTURE["10+20"].clippings);
    // 1990 (said), 2010 (article, no said_year), 2015 (said)
    expect(sorted.map((c) => c.quote)).toEqual(["oldest", "undated", "newest"]);
  });

  it("puts clippings with no year last", () => {
    const sorted = sortClippings([
      clipping({ quote: "none", date: "" }),
      clipping({ quote: "year", said_year: 2001 }),
    ]);
    expect(sorted.map((c) => c.quote)).toEqual(["year", "none"]);
  });

  it("breaks a tie by the date of the article, then keeps the order given", () => {
    const sorted = sortClippings([
      clipping({ quote: "late", said_year: 2000, date: "2005-06-01" }),
      clipping({ quote: "early", said_year: 2000, date: "2001-06-01" }),
      clipping({ quote: "same-1", said_year: 2000, date: "2005-06-01" }),
    ]);
    expect(sorted.map((c) => c.quote)).toEqual(["early", "late", "same-1"]);
  });

  it("returns a copy", () => {
    const input = [clipping({ said_year: 2 }), clipping({ said_year: 1 })];
    const sorted = sortClippings(input);
    expect(sorted).not.toBe(input);
    expect(input.map((c) => c.said_year)).toEqual([2, 1]);
  });
});

describe("pairClippingsFrom", () => {
  it("returns the sorted clippings and the two people of a pair that has some", () => {
    const set = pairClippingsFrom(FIXTURE, [10, 20]);
    expect(set?.people).toEqual([
      { id: 10, name: "Person One" },
      { id: 20, name: "Person Two" },
    ]);
    expect(set?.clippings.map((c) => c.quote)).toEqual(["oldest", "undated", "newest"]);
  });

  it("finds the pair whichever order the people are in", () => {
    expect(pairClippingsFrom(FIXTURE, [20, 10])?.clippings).toHaveLength(3);
  });

  it("leaves the data as it was", () => {
    pairClippingsFrom(FIXTURE, [10, 20]);
    expect(FIXTURE["10+20"].clippings.map((c) => c.quote)).toEqual(["undated", "newest", "oldest"]);
  });

  it("is null unless there are exactly two people", () => {
    expect(pairClippingsFrom(FIXTURE, [])).toBeNull();
    expect(pairClippingsFrom(FIXTURE, [10])).toBeNull();
    expect(pairClippingsFrom(FIXTURE, [10, 20, 30])).toBeNull();
  });

  it("is null for a pair with no entry", () => {
    expect(pairClippingsFrom(FIXTURE, [10, 30])).toBeNull();
    expect(pairClippingsFrom({}, [10, 20])).toBeNull();
  });

  it("is null for an entry with no clippings, or one that does not name two people", () => {
    expect(pairClippingsFrom(FIXTURE, [30, 40])).toBeNull();
    expect(pairClippingsFrom(FIXTURE, [50, 60])).toBeNull();
  });
});

describe("getPairClippings", () => {
  it("reads clippings.json, which has no entry for ids that are not TMDB ids", () => {
    expect(getPairClippings([-1, -2])).toBeNull();
    expect(getPairClippingSet([-1, -2])).toBeNull();
  });
});
