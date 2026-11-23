import { describe, expect, it } from "vitest";
import { colorDistance, deltaE2000, hexToLab } from "@/lib/color-distance";

describe("deltaE2000", () => {
  // Sharma, Wu and Dalal's published test pairs (CIEDE2000 implementation notes, table 1), which is what the formula is held to.
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [61, -5, 29], 22.8977],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  ] as const)("matches the published value of %j and %j", (first, second, expected) => {
    expect(deltaE2000(first, second)).toBeCloseTo(expected, 3);
    expect(deltaE2000(second, first)).toBeCloseTo(expected, 3);
  });
});

describe("colorDistance", () => {
  it("is 0 for one colour, and white against black is the whole lightness range", () => {
    expect(colorDistance("#ff8000", "#ff8000")).toBe(0);
    expect(hexToLab("#ffffff")[0]).toBeCloseTo(100, 0);
    expect(hexToLab("#000000")[0]).toBeCloseTo(0, 5);
    expect(colorDistance("#ffffff", "#000000")).toBeGreaterThan(90);
  });

  it("tells an orange from its near neighbour and from a blue", () => {
    expect(colorDistance("#ff8000", "#F28C28")).toBeLessThan(6);
    expect(colorDistance("#ff8000", "#2E5EAA")).toBeGreaterThan(50);
  });
});
