import { describe, expect, it } from "vitest";
import { PORTRAIT_PALETTE, pairPortraitColors } from "@/lib/portrait-cuts";

describe("pairPortraitColors", () => {
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
