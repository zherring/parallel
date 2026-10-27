import { describe, expect, it } from "vitest";
import { decodeAwards, encodeAwards, type AwardsFile } from "@/lib/awards-format";
import type { AwardsSummary } from "@/lib/awards";

const summary = (oscarWins: number, oscarNominations: number, festivalPrizes: AwardsSummary["festivalPrizes"] = []): AwardsSummary => ({
  oscarWins,
  oscarNominations,
  festivalPrizes,
});

describe("encodeAwards", () => {
  it("writes the compact shape, keyed by TMDB id in ascending order", () => {
    const films = new Map<number, AwardsSummary>([
      [496243, summary(4, 6, [{ festival: "Cannes", prize: "Palme d'Or" }])],
      [550, summary(0, 1)],
    ]);
    const file = encodeAwards(films, "2026-10-27T12:00:00.000Z");
    expect(file).toEqual({
      generatedAt: "2026-10-27T12:00:00.000Z",
      films: {
        "550": { w: 0, n: 1, f: [] },
        "496243": { w: 4, n: 6, f: [["Cannes", "Palme d'Or"]] },
      },
    });
    expect(Object.keys(file.films)).toEqual(["550", "496243"]);
  });
});

describe("decodeAwards", () => {
  it("round-trips what encodeAwards wrote", () => {
    const films = new Map<number, AwardsSummary>([
      [496243, summary(4, 6, [{ festival: "Cannes", prize: "Palme d'Or" }])],
      [550, summary(0, 1)],
      [129, summary(1, 1, [{ festival: "Berlin", prize: "Golden Bear" }])],
    ]);
    const decoded = decodeAwards(encodeAwards(films, "2026-10-27T12:00:00.000Z"));
    expect([...decoded].sort(([a], [b]) => a - b)).toEqual([...films].sort(([a], [b]) => a - b));
  });

  it("keeps a festival prize on a film with no Oscar record", () => {
    const decoded = decodeAwards({ generatedAt: "x", films: { "42006": { w: 0, n: 0, f: [["Berlin", "Golden Bear"]] } } });
    expect(decoded.get(42006)).toEqual(summary(0, 0, [{ festival: "Berlin", prize: "Golden Bear" }]));
  });

  it("returns an empty lookup for an empty, missing or malformed file", () => {
    expect(decodeAwards({ generatedAt: "x", films: {} }).size).toBe(0);
    expect(decodeAwards({}).size).toBe(0);
    expect(decodeAwards(null).size).toBe(0);
    expect(decodeAwards(undefined).size).toBe(0);
    expect(decodeAwards("nope").size).toBe(0);
    expect(decodeAwards({ films: [1, 2, 3] }).size).toBe(0);
    expect(decodeAwards({ films: "x" }).size).toBe(0);
  });

  it("leaves out damaged entries and says nothing for films without data", () => {
    const file = {
      generatedAt: "x",
      films: {
        "1": { w: 2, n: 3, f: [] }, // fine
        abc: { w: 1, n: 1, f: [] }, // not an id
        "0": { w: 1, n: 1, f: [] }, // not an id
        "2": { w: -1, n: 1, f: [] }, // negative
        "3": { w: 1.5, n: 2, f: [] }, // not an integer
        "4": { w: 3, n: 2, f: [] }, // more wins than nominations
        "5": { w: "1", n: 1, f: [] }, // wrong type
        "6": null, // no entry
        "7": { w: 0, n: 0, f: [] }, // nothing to show
        "8": { w: 1, n: 2 }, // no prizes list: fine, none
        "9": { w: 0, n: 1, f: [["Cannes"], ["Venice", 5], "x", ["Berlin", "Golden Bear"]] }, // bad prizes dropped
      },
    };
    const decoded = decodeAwards(file as unknown as AwardsFile);
    expect([...decoded.keys()].sort((a, b) => a - b)).toEqual([1, 8, 9]);
    expect(decoded.get(8)).toEqual(summary(1, 2));
    expect(decoded.get(9)?.festivalPrizes).toEqual([{ festival: "Berlin", prize: "Golden Bear" }]);
  });
});
