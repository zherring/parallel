import { describe, expect, it } from "vitest";
import clippingsRaw from "@/lib/clippings.json";
import essaysRaw from "@/lib/essays.json";
import { getPairCritics, pairCriticsFrom, type Critic, type CriticsData, type ReadingItem } from "@/lib/critics";
import { isCriticId } from "@/lib/clippings-view";

const critic = (overrides: Partial<Critic> = {}): Critic => ({
  id: "critic-placeholder",
  critic: "Placeholder Critic",
  publication: "Example Review",
  via: null,
  title: "Placeholder title",
  date: "2000-01-01",
  url: "https://example.com/a",
  kind: "essay",
  quote: "Placeholder quote.",
  ...overrides,
});

const item = (overrides: Partial<ReadingItem> = {}): ReadingItem => ({
  title: "Placeholder reading",
  author: "Placeholder Author",
  publication: "Example Press",
  date: "2001",
  url: "https://example.com/r",
  paywalled: false,
  ...overrides,
});

const FIXTURE: CriticsData = {
  "10+20": {
    pair: ["Person One", "Person Two"],
    tmdb_ids: [10, 20],
    // Deliberately not in date order: the data's order is the curated one.
    critics: [
      critic({ id: "critic-best", date: "2020" }),
      critic({ id: "critic-second", date: "1990-05" }),
      critic({ id: "critic-third", date: "2010-01-01" }),
    ],
    reading: [item({ title: "first read" }), item({ title: "second read", paywalled: true })],
  },
  "30+40": { pair: ["Person Three", "Person Four"], tmdb_ids: [30, 40], critics: [], reading: [] },
  "50+60": { pair: ["Person Five", "Person Six"], tmdb_ids: [50, 60], critics: [critic({ id: "critic-only" })], reading: [] },
  "70+80": { pair: ["Person Seven", "Person Eight"], tmdb_ids: [70, 80], critics: [], reading: [item({ title: "only read" })] },
  "90+91": { pair: ["Person Nine"], tmdb_ids: [90, 91], critics: [critic()], reading: [] },
};

describe("pairCriticsFrom", () => {
  it("returns the critics and the reading of a pair that has some, each in the order the data gives them", () => {
    const set = pairCriticsFrom(FIXTURE, [10, 20]);
    expect(set?.critics.map((c) => c.id)).toEqual(["critic-best", "critic-second", "critic-third"]);
    expect(set?.reading.map((r) => r.title)).toEqual(["first read", "second read"]);
  });

  it("names the two people in the order the data writes them", () => {
    expect(pairCriticsFrom(FIXTURE, [10, 20])?.people).toEqual([
      { id: 10, name: "Person One" },
      { id: 20, name: "Person Two" },
    ]);
    expect(pairCriticsFrom(FIXTURE, [20, 10])?.people.map((p) => p.id)).toEqual([10, 20]);
  });

  it("finds the pair whichever order the people are in", () => {
    expect(pairCriticsFrom(FIXTURE, [20, 10])?.critics).toHaveLength(3);
  });

  it("returns copies, leaving the data as it was", () => {
    const set = pairCriticsFrom(FIXTURE, [10, 20]);
    expect(set?.critics).not.toBe(FIXTURE["10+20"].critics);
    expect(set?.reading).not.toBe(FIXTURE["10+20"].reading);
    set?.critics.reverse();
    set?.reading.reverse();
    expect(FIXTURE["10+20"].critics.map((c) => c.id)).toEqual(["critic-best", "critic-second", "critic-third"]);
    expect(FIXTURE["10+20"].reading.map((r) => r.title)).toEqual(["first read", "second read"]);
  });

  it("is a set for a pair with critics only, and for one with reading only", () => {
    expect(pairCriticsFrom(FIXTURE, [50, 60])).toMatchObject({ critics: [{ id: "critic-only" }], reading: [] });
    expect(pairCriticsFrom(FIXTURE, [70, 80])).toMatchObject({ critics: [], reading: [{ title: "only read" }] });
  });

  it("is null unless there are exactly two people", () => {
    expect(pairCriticsFrom(FIXTURE, [])).toBeNull();
    expect(pairCriticsFrom(FIXTURE, [10])).toBeNull();
    expect(pairCriticsFrom(FIXTURE, [10, 20, 30])).toBeNull();
  });

  it("is null for a pair with no entry", () => {
    expect(pairCriticsFrom(FIXTURE, [10, 30])).toBeNull();
    expect(pairCriticsFrom({}, [10, 20])).toBeNull();
  });

  it("is null for an entry with neither critics nor reading, and for one that does not name two people", () => {
    expect(pairCriticsFrom(FIXTURE, [30, 40])).toBeNull();
    expect(pairCriticsFrom(FIXTURE, [90, 91])).toBeNull();
  });
});

describe("getPairCritics", () => {
  it("reads essays.json, which has no entry for ids that are not TMDB ids", () => {
    expect(getPairCritics([-1, -2])).toBeNull();
  });

  it("has critics and reading for the pairs it was curated for, whichever order they are asked in", () => {
    expect(getPairCritics([488, 491])?.critics.length).toBeGreaterThan(0);
    expect(getPairCritics([488, 491])?.reading.length).toBeGreaterThan(0);
    expect(getPairCritics([491, 488])).toEqual(getPairCritics([488, 491]));
  });
});

describe("essays.json", () => {
  const entries = Object.entries(essaysRaw as unknown as CriticsData);

  it("keys each pair by its sorted ids, with the two names and the two ids", () => {
    for (const [key, entry] of entries) {
      expect(entry.pair).toHaveLength(2);
      expect(entry.tmdb_ids).toHaveLength(2);
      expect(key).toBe([...entry.tmdb_ids].sort((a, b) => a - b).join("+"));
    }
  });

  it("gives every critic an id that starts with critic-, unique among all the critics", () => {
    const ids = entries.flatMap(([, entry]) => entry.critics.map((c) => c.id));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(isCriticId(id)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never lets a clipping's id look like a critic's, so that the two kinds of link cannot meet", () => {
    const clippingIds = Object.values(clippingsRaw as unknown as Record<string, { clippings: { id: string }[] }>).flatMap((entry) =>
      entry.clippings.map((c) => c.id),
    );
    expect(clippingIds.length).toBeGreaterThan(0);
    for (const id of clippingIds) expect(isCriticId(id)).toBe(false);
  });

  it("gives every critic a quote and a source, and every piece of reading a title and a link", () => {
    for (const [, entry] of entries) {
      for (const c of entry.critics) {
        expect(c.quote.trim()).not.toBe("");
        expect(c.publication.trim()).not.toBe("");
        expect(c.url).toMatch(/^https?:\/\//);
      }
      for (const r of entry.reading) {
        expect(r.title.trim()).not.toBe("");
        expect(r.url).toMatch(/^https?:\/\//);
        expect(typeof r.paywalled).toBe("boolean");
      }
    }
  });
});
