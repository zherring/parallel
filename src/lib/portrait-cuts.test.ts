import { describe, expect, it } from "vitest";
import { personColorCss, personHex } from "@/lib/person-colors";
import { PORTRAIT_PALETTE, pairPortraitColors, portraitPersonHexes } from "@/lib/portrait-cuts";

describe("PORTRAIT_PALETTE", () => {
  it("has no green: the app's green means the films they share, never one person", () => {
    expect(PORTRAIT_PALETTE).toHaveLength(7);
    expect(PORTRAIT_PALETTE).not.toContain("#3E9E4F");
    for (const hex of PORTRAIT_PALETTE) {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
      // Green-dominant (as #3E9E4F and the app's #00e054 are): green well over both red and blue.
      expect(g > r + 40 && g > b + 40).toBe(false);
    }
  });
});

describe("pairPortraitColors", () => {
  it("is deterministic per pair", () => {
    expect(pairPortraitColors(5026, 7450)).toEqual(pairPortraitColors(5026, 7450));
  });

  it("never gives the two people of a pair the same colour", () => {
    for (let a = 1; a < 400; a++) {
      for (let b = a + 1; b < a + 40; b++) {
        const [x, y] = pairPortraitColors(a, b);
        expect(x).not.toBe(y);
      }
    }
  });

  it("gives each person the same colour whichever order the pair comes in", () => {
    for (let a = 1; a < 300; a++) {
      for (let b = a + 1; b < a + 30; b++) {
        const [x, y] = pairPortraitColors(a, b);
        expect(pairPortraitColors(b, a)).toEqual([y, x]);
      }
    }
  });

  it("uses the whole palette across people", () => {
    const seen = new Set(Array.from({ length: 200 }, (_, id) => pairPortraitColors(id, id)[0]));
    expect(seen.size).toBe(PORTRAIT_PALETTE.length);
  });
});

describe("portraitPersonHexes", () => {
  it("gives a pair its landing colours, by slot, three or four people the app's palette (what their cards draw), and nothing to one person", () => {
    expect(portraitPersonHexes([5026, 7450])).toEqual(pairPortraitColors(5026, 7450));
    expect(portraitPersonHexes([7450, 5026])).toEqual(pairPortraitColors(7450, 5026));
    expect(portraitPersonHexes([5026])).toBeNull();
    // The same colours whoever the people are (a group's slot, not the person, picks it), and the same ones `personHex` gives with no override.
    expect(portraitPersonHexes([380, 1032, 1037])).toEqual([personHex(0), personHex(1), personHex(2)]);
    expect(portraitPersonHexes([1, 2, 3, 4])).toEqual([personHex(0), personHex(1), personHex(2), personHex(3)]);
    expect(portraitPersonHexes([380, 1032, 1037])).toEqual(["#6f9bd1", "#d0a845", "#d27650"]);
  });

  it("overrides the person custom properties and hexes only when given, so the page of one person is unchanged", () => {
    const hexes = portraitPersonHexes([5026, 7450])!;
    expect(personColorCss(null)).toBe(personColorCss());
    expect(personHex(0, null)).toBe(personHex(0));
    const css = personColorCss(hexes);
    expect(css).toContain(`--person-1:${hexes[0]};`);
    expect(css).toContain(`--person-2:${hexes[1]};`);
    // The slots past the pair keep the palette's.
    expect(css).toContain(`--person-3:${personHex(2)};`);
    expect(personHex(1, hexes)).toBe(hexes[1]);
    expect(personHex(2, hexes)).toBe(personHex(2));
  });

  it("names the colour of the Table's row flash (the page's \"made together\": white, orange in Kevin Bacon mode) only with the override", () => {
    expect(personColorCss()).not.toContain("--row-flash");
    expect(personColorCss(null)).not.toContain("--row-flash");
    expect(personColorCss(portraitPersonHexes([5026, 7450])!)).toContain("--row-flash:var(--together);");
    expect(personColorCss(portraitPersonHexes([380, 1032, 1037])!)).toContain("--row-flash:var(--together);");
  });
});
