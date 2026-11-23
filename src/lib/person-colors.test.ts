import { describe, expect, it } from "vitest";
import { BACON_ORANGE } from "@/lib/bacon-share";
import { colorDistance } from "@/lib/color-distance";
import { BACON_PERSON_COLORS, PERSON_COLORS, TOGETHER_CLASH_DISTANCE, clashesWithTogether } from "@/lib/person-colors";
import { PORTRAIT_PALETTE } from "@/lib/portrait-cuts";

describe("clashesWithTogether", () => {
  it("is the mode's orange and what is near it: the portrait palette's orange and the person palette's orange", () => {
    expect(clashesWithTogether(BACON_ORANGE)).toBe(true);
    expect(clashesWithTogether("#F28C28")).toBe(true);
    expect(clashesWithTogether("#d27650")).toBe(true);
  });

  it("leaves the amber, the red and the gold, which are their own colours", () => {
    for (const hex of ["#d0a845", "#E63B2E", "#F2C230"]) {
      expect(clashesWithTogether(hex), hex).toBe(false);
      expect(colorDistance(hex, BACON_ORANGE)).toBeGreaterThanOrEqual(TOGETHER_CLASH_DISTANCE);
    }
  });

  it("finds exactly one entry of the portrait palette and one of the person palette to give up", () => {
    expect(PORTRAIT_PALETTE.filter(clashesWithTogether)).toEqual(["#F28C28"]);
    expect(PERSON_COLORS.filter(({ hex }) => clashesWithTogether(hex)).map(({ name }) => name)).toEqual(["orange"]);
  });
});

describe("BACON_PERSON_COLORS", () => {
  it("is as long as the palette, without its orange, and each slot before the orange keeps its colour", () => {
    expect(BACON_PERSON_COLORS).toHaveLength(PERSON_COLORS.length);
    expect(BACON_PERSON_COLORS.some(({ hex }) => clashesWithTogether(hex))).toBe(false);
    expect(BACON_PERSON_COLORS.slice(0, 2)).toEqual(PERSON_COLORS.slice(0, 2));
    // The rose moves up into the orange's place, the spare takes the last one.
    expect(BACON_PERSON_COLORS[2]).toEqual(PERSON_COLORS[3]);
  });

  it("has four different colours, and each readable on the page (5.5:1 on --bg)", () => {
    expect(new Set(BACON_PERSON_COLORS.map(({ hex }) => hex)).size).toBe(PERSON_COLORS.length);
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const bg = luminance("#14181c");
    for (const { hex } of BACON_PERSON_COLORS) {
      expect((luminance(hex) + 0.05) / (bg + 0.05), hex).toBeGreaterThanOrEqual(5.5);
    }
    // The spare, the one colour the mode adds, is nowhere near the green (the palette's amber is the green's known neighbour).
    expect(colorDistance(BACON_PERSON_COLORS[3].hex, "#00e054")).toBeGreaterThan(45);
    // And apart from one another by a clear step: the blue and the spare violet are the nearest pair, 15 apart.
    for (const [i, a] of BACON_PERSON_COLORS.entries()) {
      for (const b of BACON_PERSON_COLORS.slice(i + 1)) expect(colorDistance(a.hex, b.hex), `${a.hex} ${b.hex}`).toBeGreaterThan(14);
    }
  });
});
