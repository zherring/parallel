import { describe, expect, it } from "vitest";
import { BACON_PERSON_COLORS, clashesWithTogether, personColorCss, personHex } from "@/lib/person-colors";
import { PORTRAIT_PALETTE, cutEdgePath, pairPortraitColors, portraitPersonHexes, type CutPoint } from "@/lib/portrait-cuts";

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

describe("Kevin Bacon mode's colours: nobody is drawn in the mode's orange", () => {
  const KEVIN = 4724;
  const KYRA = 26467;
  const OLDMAN = 64;
  const ORANGE_PEOPLE = Array.from({ length: 4000 }, (_, id) => id + 1).filter((id) => clashesWithTogether(pairPortraitColors(id, id + 100_000)[0]));

  it("finds people whose own colour is the orange outside the mode, Kyra Sedgwick and Gary Oldman among them", () => {
    expect(clashesWithTogether(pairPortraitColors(KEVIN, KYRA)[1])).toBe(true);
    expect(clashesWithTogether(pairPortraitColors(KEVIN, OLDMAN)[1])).toBe(true);
    expect(ORANGE_PEOPLE).toContain(OLDMAN);
  });

  it("gives Kyra Sedgwick the next colour of the palette, the pink, where she was the orange (the teal is Kevin Bacon's)", () => {
    expect(pairPortraitColors(KEVIN, KYRA)).toEqual(["#1F9E89", "#F28C28"]);
    expect(pairPortraitColors(KEVIN, KYRA, { bacon: true })).toEqual(["#1F9E89", "#E5487D"]);
    expect(portraitPersonHexes([KEVIN, KYRA], { bacon: true })).toEqual(["#1F9E89", "#E5487D"]);
  });

  it("never draws anyone of a pair in the orange, whoever the pair is and in either order, and never in the same colour twice", () => {
    for (let a = 1; a < 300; a++) {
      for (let b = a + 1; b < a + 40; b++) {
        const [x, y] = pairPortraitColors(a, b, { bacon: true });
        expect(clashesWithTogether(x) || clashesWithTogether(y)).toBe(false);
        expect(x).not.toBe(y);
        expect(pairPortraitColors(b, a, { bacon: true })).toEqual([y, x]);
      }
    }
  });

  it("changes nobody else: a pair with neither person on the orange has the colours it has outside the mode", () => {
    let kept = 0;
    for (let a = 1; a < 300; a++) {
      for (let b = a + 1; b < a + 40; b++) {
        const outside = pairPortraitColors(a, b);
        if (outside.some(clashesWithTogether)) continue;
        // (A pair that is stepped past the orange to avoid matching is not kept: neither of the two is on it here.)
        expect(pairPortraitColors(a, b, { bacon: true })).toEqual(outside);
        kept += 1;
      }
    }
    expect(kept).toBeGreaterThan(5000);
  });

  it("is the palette's own, unchanged, outside the mode (the option is off unless it is asked for)", () => {
    for (let a = 1; a < 200; a++) {
      expect(pairPortraitColors(a, a + 7, { bacon: false })).toEqual(pairPortraitColors(a, a + 7));
      expect(portraitPersonHexes([a, a + 7], { bacon: false })).toEqual(portraitPersonHexes([a, a + 7]));
    }
    expect(portraitPersonHexes([KEVIN, KYRA])).toEqual(pairPortraitColors(KEVIN, KYRA));
  });

  it("gives three or four people the person palette without its orange, and one person nothing", () => {
    expect(portraitPersonHexes([KEVIN, KYRA, OLDMAN], { bacon: true })).toEqual(BACON_PERSON_COLORS.slice(0, 3).map(({ hex }) => hex));
    expect(portraitPersonHexes([KEVIN, KYRA, OLDMAN, 1], { bacon: true })).toEqual(BACON_PERSON_COLORS.map(({ hex }) => hex));
    expect(portraitPersonHexes([KEVIN, KYRA, OLDMAN], { bacon: true })?.some(clashesWithTogether)).toBe(false);
    expect(portraitPersonHexes([KEVIN, KYRA, OLDMAN])).toEqual(["#6f9bd1", "#d0a845", "#d27650"]);
    expect(portraitPersonHexes([KEVIN], { bacon: true })).toBeNull();
  });

  it("writes the mode's colours into the page's custom properties, where the timeline, the minimap, the legends and the pill read them", () => {
    const css = personColorCss(portraitPersonHexes([KEVIN, KYRA, OLDMAN], { bacon: true })!);
    expect(css).toContain(`--person-3:${BACON_PERSON_COLORS[2].hex};`);
    expect(css).not.toContain("#d27650");
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

describe("cutEdgePath", () => {
  // A figure cut off by the bottom of the photo and by its right side: the polygon runs along the frame there.
  const points: CutPoint[] = [
    [0.2, 1],
    [0.3, 0.2],
    [0.7, 0.2],
    [1, 0.5],
    [1, 1],
  ];

  it("leaves the segments along the photo's own frame edge out of the edge, as the whole app draws it", () => {
    const open = cutEdgePath(points, 100, 200);
    // The right side (1, 0.5 to 1, 1) and the bottom (1, 1 to 0.2, 1) are the frame's: no stroke along them.
    expect(open).not.toContain("Z");
    expect(open.match(/M/g)).toHaveLength(1);
    expect(open).toContain("L100,100");
  });
});
