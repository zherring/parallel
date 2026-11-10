import { describe, expect, it } from "vitest";
import {
  PAIR_DESCRIPTIONS,
  getPairDescription,
  isWebUrl,
  pairDescriptionFrom,
  type PairDescriptions,
} from "@/lib/pair-descriptions";
import { splitCitations } from "@/lib/citations";

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

/** The citation markers of a text, as the numbers they carry, in order. */
const markersOf = (text: string) => [...text.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));

describe("the curated descriptions", () => {
  const entries = Object.entries(PAIR_DESCRIPTIONS);

  it("are the nine pairs researched so far", () => {
    expect(entries).toHaveLength(9);
    expect(Object.keys(PAIR_DESCRIPTIONS)).toContain("525+74401");
    expect(Object.keys(PAIR_DESCRIPTIONS)).toContain("3146+3147");
  });

  it("are keyed by pairing keys (two ascending TMDB ids), and every entry reads back through the accessor", () => {
    for (const [key, entry] of entries) {
      const ids = key.split("+").map(Number);
      expect(ids, key).toHaveLength(2);
      expect(ids[0], key).toBeLessThan(ids[1]);
      expect(ids.every(Number.isInteger), key).toBe(true);
      expect(entry.text.trim(), key).not.toBe("");
      expect(getPairDescription(ids), key).not.toBeNull();
      expect(getPairDescription([...ids].reverse()), key).not.toBeNull();
      // A source that the accessor would drop is a mistake in the data.
      expect(getPairDescription(ids)?.sources, key).toHaveLength(entry.sources.length);
    }
  });

  it("cites its sources the way Wikipedia does: every marker points at a source, and every source is cited at least once", () => {
    for (const [key, entry] of entries) {
      const markers = markersOf(entry.text);
      expect(markers.length, `${key} has citations`).toBeGreaterThan(0);
      // In range: [1] is sources[0].
      for (const n of markers) {
        expect(n, `${key}: [${n}]`).toBeGreaterThanOrEqual(1);
        expect(n, `${key}: [${n}]`).toBeLessThanOrEqual(entry.sources.length);
      }
      // Cited: no source sits in the list without a marker in the text.
      entry.sources.forEach((source, index) => {
        expect(markers, `${key}: source ${index + 1} (${source.title})`).toContain(index + 1);
      });
      // The text holds nothing the hero would not set as words or as a citation, such as a stray bracket pair.
      const parts = splitCitations(entry.text, entry.sources.length);
      expect(parts.filter((part) => part.kind === "citation").map((part) => part.n), key).toEqual(markers);
      expect(parts.filter((part) => part.kind === "text").map((part) => part.text).join("") + "", key).not.toMatch(/\[\d+\]/);
    }
  });

  it("links https pages, except the one known http page (Ain't It Cool News's legacy site)", () => {
    const http = entries.flatMap(([key, entry]) => entry.sources.filter((source) => !source.url.startsWith("https://")).map((source) => ({ key, ...source })));
    expect(http).toHaveLength(1);
    expect(http[0].url).toMatch(/^http:\/\/legacy\.aintitcool\.com\//);
    for (const [key, entry] of entries) {
      for (const source of entry.sources) {
        expect(isWebUrl(source.url), `${key}: ${source.url}`).toBe(true);
        expect(source.title.trim(), `${key}: ${source.url}`).not.toBe("");
      }
    }
  });

  it("has no source twice in one description", () => {
    for (const [key, entry] of entries) {
      const urls = entry.sources.map((source) => source.url);
      expect(new Set(urls).size, key).toBe(urls.length);
    }
  });
});
