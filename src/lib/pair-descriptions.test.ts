import { describe, expect, it } from "vitest";
import {
  PAIR_DESCRIPTIONS,
  getPairDescription,
  isWebUrl,
  pairDescriptionFrom,
  type PairDescriptions,
} from "@/lib/pair-descriptions";

const DATA: PairDescriptions = {
  "309+955": {
    text: "  Eight films, from Volver to Pain and Glory.  ",
    sources: [
      { title: "  An interview ", url: "https://example.com/interview" },
      { title: "Not a web page", url: "javascript:alert(1)" },
      { title: "", url: "https://example.com/untitled" },
      { title: "Broken", url: "not a url" },
    ],
  },
  "1+2": { text: "   ", sources: [] },
  "3+4": { text: "A pair with no sources at all.", sources: [] },
};

describe("pairDescriptionFrom", () => {
  it("finds the pair whichever way round its ids come, with the text and the sources trimmed", () => {
    const expected = {
      text: "Eight films, from Volver to Pain and Glory.",
      sources: [{ title: "An interview", url: "https://example.com/interview" }],
    };
    expect(pairDescriptionFrom(DATA, [309, 955])).toEqual(expected);
    expect(pairDescriptionFrom(DATA, [955, 309])).toEqual(expected);
  });

  it("keeps only web addresses with a title as sources", () => {
    expect(pairDescriptionFrom(DATA, [309, 955])?.sources).toHaveLength(1);
    expect(pairDescriptionFrom(DATA, [3, 4])).toEqual({ text: "A pair with no sources at all.", sources: [] });
  });

  it("is null for a pair without an entry, an entry with a blank text, and anything but exactly two people", () => {
    expect(pairDescriptionFrom(DATA, [5, 6])).toBeNull();
    expect(pairDescriptionFrom(DATA, [1, 2])).toBeNull();
    expect(pairDescriptionFrom(DATA, [309])).toBeNull();
    expect(pairDescriptionFrom(DATA, [309, 955, 1])).toBeNull();
    expect(pairDescriptionFrom(DATA, [])).toBeNull();
  });

  it("does not read the prototype's keys as pairs", () => {
    expect(pairDescriptionFrom(DATA, [0, 0])).toBeNull();
    expect(pairDescriptionFrom({}, [1, 2])).toBeNull();
  });
});

describe("isWebUrl", () => {
  it("accepts http and https only", () => {
    expect(isWebUrl("https://example.com/a?b=1")).toBe(true);
    expect(isWebUrl("http://example.com")).toBe(true);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
    expect(isWebUrl("data:text/html,hi")).toBe(false);
    expect(isWebUrl("//example.com")).toBe(false);
    expect(isWebUrl("")).toBe(false);
  });
});

describe("the curated descriptions", () => {
  it("are keyed by pairing keys (two ascending TMDB ids), and every entry reads back through the accessor", () => {
    for (const [key, entry] of Object.entries(PAIR_DESCRIPTIONS)) {
      const ids = key.split("+").map(Number);
      expect(ids, key).toHaveLength(2);
      expect(ids[0], key).toBeLessThan(ids[1]);
      expect(ids.every(Number.isInteger), key).toBe(true);
      expect(entry.text.trim(), key).not.toBe("");
      expect(getPairDescription(ids), key).not.toBeNull();
      // A source that the accessor would drop is a mistake in the data.
      expect(getPairDescription(ids)?.sources, key).toHaveLength(entry.sources.length);
    }
  });

  it("is empty until the research fills it, so no page shows a description yet", () => {
    expect(getPairDescription([1032, 3661])).toBeNull();
  });
});
