import { describe, expect, it, vi } from "vitest";
import type { ClippingsData } from "@/lib/clippings";
import { getHeroNote } from "@/lib/pair-hero-note";
import type { PairDescriptions } from "@/lib/pair-descriptions";

// getHeroNote reads the real quotes, descriptions and pairings, which cannot be relied on to hold a pair that has a description
// and no quotes (or only a blurb) once every pair has quotes. These small fixtures stand in for them, so that each step of the
// fallback chain is always exercised through the wiring: 1+2 has quotes, a description and a blurb; 3+4 a description and a blurb;
// 5+6 only a blurb; 7+8 nothing at all.
const fixtures = vi.hoisted(() => {
  const clippings = {
    "1+2": {
      pair: ["Ann", "Bo"],
      tmdb_ids: [1, 2],
      clippings: [
        {
          id: "she-is-my-muse",
          speaker: "Ann",
          about: "Bo",
          quote: "She is my muse.",
          film: null,
          said_year: 2000,
          publication: "Paper",
          via: null,
          title: "Headline",
          date: "2000",
          url: "https://example.com/q",
          context: "",
          secondhand: false,
        },
      ],
    },
  } as unknown as ClippingsData;
  const descriptions: PairDescriptions = {
    "1+2": { text: "Described, and quoted.", sources: [] },
    "3+4": { text: "Eight films together.", sources: [{ title: "Interview", url: "https://example.com/i" }] },
  };
  const blurbs: Record<string, string> = { "1+2": "Blurb one.", "3+4": "Blurb two.", "5+6": "Blurb three." };
  return { clippings, descriptions, blurbs };
});

vi.mock("@/lib/clippings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clippings")>();
  return { ...actual, getPairClippingSet: (ids: readonly number[]) => actual.pairClippingsFrom(fixtures.clippings, ids) };
});

vi.mock("@/lib/pair-descriptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pair-descriptions")>();
  return { ...actual, getPairDescription: (ids: readonly number[]) => actual.pairDescriptionFrom(fixtures.descriptions, ids) };
});

vi.mock("@/lib/examples", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/examples")>();
  return { ...actual, pairingBlurb: (ids: readonly number[]) => fixtures.blurbs[[...ids].sort((a, b) => a - b).join("+")] ?? null };
});

describe("getHeroNote: the fallback chain, on fixtures", () => {
  it("shows a pair's featured quote first, whatever else it has", () => {
    expect(getHeroNote([1, 2])).toEqual({ kind: "quote", id: "she-is-my-muse", quote: "She is my muse.", speaker: "Ann", about: "Bo" });
  });

  it("shows the curated description, with its sources, of a described pair that has no quotes (not the blurb it also has)", () => {
    expect(getHeroNote([3, 4])).toEqual({
      kind: "description",
      text: "Eight films together.",
      sources: [{ title: "Interview", url: "https://example.com/i" }],
    });
  });

  it("shows the blurb of a curated pair with neither, and nothing for any other pair", () => {
    expect(getHeroNote([5, 6])).toEqual({ kind: "blurb", text: "Blurb three." });
    expect(getHeroNote([7, 8])).toBeNull();
    expect(getHeroNote([])).toBeNull();
  });

  it("does not care in which order the ids come", () => {
    expect(getHeroNote([4, 3])).toEqual(getHeroNote([3, 4]));
    expect(getHeroNote([2, 1])).toEqual(getHeroNote([1, 2]));
  });
});
