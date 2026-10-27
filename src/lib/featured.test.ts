import { describe, expect, it } from "vitest";
import { defaultFeatured, pickFeatured } from "@/lib/featured";

interface Item {
  id: number;
  genre: string;
}

/** Seeded generator (mulberry32), so a test's "random" picks never change. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `genres` genres with `each` items apiece, ids 0..n-1 in genre order. */
function pool(genres: number, each: number): Item[] {
  return Array.from({ length: genres * each }, (_, id) => ({ id, genre: `g${Math.floor(id / each)}` }));
}

describe("pickFeatured", () => {
  it("returns `count` unique items", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const picked = pickFeatured(pool(9, 7), 6, seeded(seed));
      expect(picked).toHaveLength(6);
      expect(new Set(picked.map((item) => item.id)).size).toBe(6);
    }
  });

  it("takes at most one item per genre while enough genres remain", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const picked = pickFeatured(pool(9, 7), 6, seeded(seed));
      expect(new Set(picked.map((item) => item.genre)).size).toBe(6);
    }
    // Exactly as many genres as slots: every genre once.
    const all = pickFeatured(pool(6, 3), 6, seeded(7));
    expect(new Set(all.map((item) => item.genre)).size).toBe(6);
  });

  it("fills the rest from what is left once the genres run out", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const picked = pickFeatured(pool(3, 4), 6, seeded(seed));
      expect(picked).toHaveLength(6);
      expect(new Set(picked.map((item) => item.id)).size).toBe(6);
      expect(new Set(picked.map((item) => item.genre)).size).toBe(3);
    }
  });

  it("puts one item per genre first, then the fill", () => {
    const picked = pickFeatured(pool(2, 5), 5, seeded(3));
    expect(new Set(picked.slice(0, 2).map((item) => item.genre)).size).toBe(2);
  });

  it("returns everything there is when the pool is smaller than `count`", () => {
    const items = pool(2, 2);
    const picked = pickFeatured(items, 6, seeded(1));
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((item) => item.id))).toEqual(new Set(items.map((item) => item.id)));
    expect(pickFeatured([], 6, seeded(1))).toEqual([]);
  });

  it("returns nothing for a count of zero or less", () => {
    expect(pickFeatured(pool(3, 3), 0, seeded(1))).toEqual([]);
    expect(pickFeatured(pool(3, 3), -2, seeded(1))).toEqual([]);
  });

  it("never mutates its input", () => {
    const items = pool(9, 7);
    const snapshot = items.map((item) => ({ ...item }));
    const frozen = Object.freeze([...items]);
    pickFeatured(frozen, 6, seeded(5));
    expect(items).toEqual(snapshot);
  });

  it("is deterministic for a given random source", () => {
    expect(pickFeatured(pool(9, 7), 6, seeded(11))).toEqual(pickFeatured(pool(9, 7), 6, seeded(11)));
  });

  it("gives different picks for different random sources", () => {
    const keys = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      keys.add(
        pickFeatured(pool(9, 7), 6, seeded(seed))
          .map((item) => item.id)
          .join(","),
      );
    }
    expect(keys.size).toBeGreaterThan(15);
    expect(pickFeatured(pool(9, 7), 6, () => 0)).not.toEqual(pickFeatured(pool(9, 7), 6, () => 0.99));
  });

  it("can pick any item, and any genre", () => {
    const seenIds = new Set<number>();
    const seenGenres = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) {
      for (const item of pickFeatured(pool(9, 3), 6, seeded(seed))) {
        seenIds.add(item.id);
        seenGenres.add(item.genre);
      }
    }
    expect(seenIds.size).toBe(27);
    expect(seenGenres.size).toBe(9);
  });

  it("uses Math.random by default", () => {
    const picked = pickFeatured(pool(9, 3), 6);
    expect(picked).toHaveLength(6);
    expect(new Set(picked.map((item) => item.genre)).size).toBe(6);
  });
});

describe("defaultFeatured", () => {
  it("takes the first item of each genre, in genre order", () => {
    expect(defaultFeatured(pool(9, 3), 6).map((item) => item.id)).toEqual([0, 3, 6, 9, 12, 15]);
  });

  it("goes round again for the second item of each genre when there are too few genres", () => {
    expect(defaultFeatured(pool(2, 3), 5).map((item) => item.id)).toEqual([0, 3, 1, 4, 2]);
  });

  it("returns everything when the pool is smaller than `count`, and nothing for none", () => {
    expect(defaultFeatured(pool(2, 2), 6)).toHaveLength(4);
    expect(defaultFeatured([], 6)).toEqual([]);
    expect(defaultFeatured(pool(3, 3), 0)).toEqual([]);
  });

  it("does not depend on randomness or mutate its input", () => {
    const items = Object.freeze(pool(9, 3));
    expect(defaultFeatured(items, 6)).toEqual(defaultFeatured(items, 6));
  });
});
