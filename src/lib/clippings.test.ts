import { describe, expect, it } from "vitest";
import {
  getPairClippings,
  getPairClippingSet,
  pairClippingsFrom,
  sortClippings,
  type Clipping,
  type ClippingsData,
} from "@/lib/clippings";

const clipping = (overrides: Partial<Clipping> = {}): Clipping => ({
  id: "placeholder-quote",
  speaker: "Person One",
  about: "Person Two",
  quote: "Placeholder quote.",
  film: null,
  said_year: null,
  publication: "Example Times",
  title: "Placeholder headline",
  date: "2000-01-01",
  url: "https://example.com/a",
  via: null,
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
      clipping({ quote: "newest", said_year: 2015, date: "2015-03" }),
      clipping({ quote: "oldest", said_year: 1990, date: "2012-01-01" }),
    ],
  },
  "30+40": { pair: ["Person Three", "Person Four"], tmdb_ids: [30, 40], clippings: [] },
  "50+60": { pair: ["Only One Name"], tmdb_ids: [50, 60], clippings: [clipping()] },
};

describe("sortClippings", () => {
  it("puts the oldest first, by the older of the year said and the year of the original", () => {
    const sorted = sortClippings(FIXTURE["10+20"].clippings);
    // 1990 (said), 2010 (original, no said_year), 2015 (said; the original, from 2000, is older)
    expect(sorted.map((c) => c.quote)).toEqual(["oldest", "undated", "newest"]);
  });

  it("puts clippings with no year last", () => {
    const sorted = sortClippings([
      clipping({ quote: "none", date: "" }),
      clipping({ quote: "year", said_year: 2001 }),
    ]);
    expect(sorted.map((c) => c.quote)).toEqual(["year", "none"]);
  });

  it("sorts by the older of the two years: a remark reprinted years later goes under the earlier", () => {
    const sorted = sortClippings([
      clipping({ quote: "said-1990-printed-2020", said_year: 1990, date: "2020-01-01" }),
      clipping({ quote: "said-2010-printed-2005", said_year: 2010, date: "2005-01-01" }),
      clipping({ quote: "printed-1999", said_year: null, date: "1999" }),
    ]);
    expect(sorted.map((c) => c.quote)).toEqual(["said-1990-printed-2020", "printed-1999", "said-2010-printed-2005"]);
  });

  it("breaks a tie by the date of the original, a month or a year before a day in it, then keeps the order given", () => {
    const sorted = sortClippings([
      clipping({ quote: "late", said_year: 2000, date: "2005-06-01" }),
      clipping({ quote: "early", said_year: 2000, date: "2001-06-01" }),
      clipping({ quote: "same-1", said_year: 2000, date: "2005-06-01" }),
      clipping({ quote: "month", said_year: 2000, date: "2005-06" }),
    ]);
    expect(sorted.map((c) => c.quote)).toEqual(["early", "month", "late", "same-1"]);
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
