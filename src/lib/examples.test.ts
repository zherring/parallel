import { describe, expect, it } from "vitest";
import generated from "@/lib/examples.generated.json";
import {
  DEFAULT_GENRE,
  EXAMPLE_PAIRINGS,
  GENRES,
  MIN_SHARED_FILMS,
  pairingHref,
  pairingKey,
  type GeneratedExamples,
} from "@/lib/examples";
import { MAX_PEOPLE } from "@/lib/people-nav";
import { buildPeopleSlug, parsePeopleSlug } from "@/lib/slug";

const data: GeneratedExamples = generated;
const MIN_PER_GENRE = 5;

describe("GENRES", () => {
  it("opens on Featured, with unique ids that are safe to use as a URL hash", () => {
    expect(GENRES[0].id).toBe("featured");
    expect(DEFAULT_GENRE).toBe(GENRES[0].id);
    const ids = GENRES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(GENRES.every((g) => g.label.trim().length > 0)).toBe(true);
  });
});

describe("EXAMPLE_PAIRINGS", () => {
  it("only uses known genres", () => {
    const known = new Set<string>(GENRES.map((g) => g.id));
    for (const pairing of EXAMPLE_PAIRINGS) expect(known.has(pairing.genre)).toBe(true);
  });

  it.each(GENRES.map((g) => [g.id] as const))("has at least 5 pairings in %s", (id) => {
    const count = EXAMPLE_PAIRINGS.filter((p) => p.genre === id).length;
    expect(count).toBeGreaterThanOrEqual(MIN_PER_GENRE);
  });

  it("keeps the original six pairings, with the Fincher ones, under Featured", () => {
    const featured = EXAMPLE_PAIRINGS.filter((p) => p.genre === "featured").map(pairingKey);
    expect(featured).toEqual([
      "7467+7479",
      "287+7467",
      "1032+3661",
      "151+1223",
      "20738+21684",
      "136495+1419631",
    ]);
  });

  it("has no duplicate pairings, whatever order the people are in", () => {
    const keys = EXAMPLE_PAIRINGS.map(pairingKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(EXAMPLE_PAIRINGS.map((p) => [pairingHref(p), p] as const))(
    "%s round-trips through parsePeopleSlug",
    (href, pairing) => {
      expect(href.startsWith("/p/")).toBe(true);
      const parsed = parsePeopleSlug(href.slice("/p/".length));
      const ids = pairing.people.map((p) => p.id);

      expect(parsed).toEqual({ ids });
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(ids.length).toBeLessThanOrEqual(MAX_PEOPLE);
    },
  );

  it("has names and a one-line blurb for every pairing", () => {
    for (const { people, blurb } of EXAMPLE_PAIRINGS) {
      expect(people.every((p) => p.name.trim().length > 0 && Number.isInteger(p.id))).toBe(true);
      expect(blurb.trim().length).toBeGreaterThan(10);
      expect(blurb).not.toContain("\n");
    }
  });
});

describe("pairingKey", () => {
  it("is the sorted ids, so the same people in another order are the same pairing", () => {
    const a = { people: [{ id: 30, name: "A" }, { id: 4, name: "B" }] };
    const b = { people: [{ id: 4, name: "B" }, { id: 30, name: "A" }] };
    expect(pairingKey(a)).toBe("4+30");
    expect(pairingKey(b)).toBe("4+30");
  });
});

// examples.generated.json is written by `npm run examples:refresh`. These fail when someone
// edits the pairings without running it, or runs it against different people.
describe("examples.generated.json", () => {
  it("has an entry for every pairing, for the same people in the same order", () => {
    for (const pairing of EXAMPLE_PAIRINGS) {
      const entry = data[pairingKey(pairing)];
      expect(entry, `missing entry for ${pairingKey(pairing)}; run npm run examples:refresh`).toBeDefined();
      expect(entry.people.map((p) => p.id)).toEqual(pairing.people.map((p) => p.id));
    }
  });

  it("has no entries for pairings that no longer exist", () => {
    expect(Object.keys(data).sort()).toEqual(EXAMPLE_PAIRINGS.map(pairingKey).sort());
  });

  it("holds TMDB's canonical names, so every card links straight to the canonical slug", () => {
    for (const pairing of EXAMPLE_PAIRINGS) {
      const entry = data[pairingKey(pairing)];
      expect(entry.people.map((p) => p.name)).toEqual(pairing.people.map((p) => p.name));
      expect(buildPeopleSlug(entry.people)).toBe(buildPeopleSlug(pairing.people));
    }
  });

  it("has a photo and enough shared films for everyone", () => {
    for (const entry of Object.values(data)) {
      expect(Number.isInteger(entry.sharedCount)).toBe(true);
      expect(entry.sharedCount).toBeGreaterThanOrEqual(MIN_SHARED_FILMS);
      for (const person of entry.people) expect(person.profilePath).toMatch(/^\/[\w-]+\.(jpg|png)$/);
    }
  });
});
