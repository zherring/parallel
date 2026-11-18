import { describe, expect, it } from "vitest";
import { EXAMPLE_PAIRINGS, pairingHref } from "@/lib/examples";
import { searchPairings } from "@/lib/search-pairings";
import type { PairingSearchResult } from "@/lib/types";

const pairing = (a: number, b: number): PairingSearchResult => ({
  href: `/p/${a}-person-${a}+${b}-person-${b}`,
  blurb: "A collaboration.",
  sharedCount: 3,
  people: [a, b].map((id) => ({ id, name: `Person ${id}`, profilePath: `/${id}.jpg` })),
});

describe("searchPairings", () => {
  it("matches by id, regardless of which side of a pairing the person is on", () => {
    const cards = [pairing(1, 2), pairing(3, 1), pairing(4, 5)];
    expect(searchPairings([{ id: 1 }], cards)).toEqual(cards.slice(0, 2));
  });

  it("follows person ranking, preserves curated order and lists a shared pairing only once", () => {
    const cards = [pairing(1, 2), pairing(3, 4), pairing(1, 3), pairing(1, 5)];
    expect(searchPairings([{ id: 3 }, { id: 1 }], cards)).toEqual([cards[1], cards[2], cards[0], cards[3]]);
  });

  it("does not cap the number of related pairings at the people search limit", () => {
    const cards = Array.from({ length: 15 }, (_, i) => pairing(1, i + 2));
    expect(searchPairings([{ id: 1 }], cards)).toEqual(cards);
  });

  it("has no pairings for an empty result or someone outside the curated corpus", () => {
    expect(searchPairings([], [pairing(1, 2)])).toEqual([]);
    expect(searchPairings([{ id: 99 }], [pairing(1, 2)])).toEqual([]);
  });

  it("returns every real curated pairing for a person, with photos, descriptions and film counts", () => {
    const expected = EXAMPLE_PAIRINGS.filter((entry) => entry.people.some((person) => person.id === 380));
    const found = searchPairings([{ id: 380 }]);
    expect(found.map((entry) => entry.href)).toEqual(expected.map(pairingHref));
    expect(found.length).toBeGreaterThan(1);
    for (const entry of found) {
      expect(entry.blurb).toBeTruthy();
      expect(entry.sharedCount).toBeGreaterThan(0);
      expect(entry.people.every((person) => person.profilePath)).toBe(true);
      expect(Object.keys(entry)).toEqual(["href", "blurb", "sharedCount", "people"]);
    }
  });
});
