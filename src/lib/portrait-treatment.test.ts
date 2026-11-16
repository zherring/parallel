import { describe, expect, it } from "vitest";
import { headCrop, type TreatmentShape } from "@/lib/portrait-treatment";

/** A cut of a 342 x 513 photo: a head in the top third (centred at x = 0.4 of the photo's width), the shoulders below it. */
const shape: TreatmentShape = {
  size: [342, 513],
  posters: [],
  points: [
    [0.3, 0.1],
    [0.5, 0.1],
    [0.52, 0.35],
    [0.9, 0.6],
    [0.9, 1],
    [0.1, 1],
    [0.1, 0.6],
    [0.28, 0.35],
  ],
};

describe("headCrop", () => {
  it("takes the photo's whole width for a tile as wide as a pair's or narrower, as it always did", () => {
    const crop = headCrop(shape, 320 / 313);
    expect(crop.x).toBe(0);
    expect(crop.w).toBeCloseTo(342, 5);
    expect(crop.h).toBeCloseTo(342 / (320 / 313), 5);
  });

  it("takes the photo's whole height, and as much width as the tile's shape asks, for a tall tile", () => {
    const crop = headCrop(shape, 0.5);
    expect(crop.h).toBe(513);
    expect(crop.w).toBeCloseTo(256.5, 5);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.w).toBeLessThanOrEqual(342 + 1e-9);
  });

  it("shows a wide tile (a group's) the same height of the photo as a pair's, with the head in the middle and the montage on both sides, not the head cut at the eyes", () => {
    const pair = headCrop(shape, 320 / 313);
    for (const aspect of [320 / 207, 320 / 154.5]) {
      const crop = headCrop(shape, aspect);
      expect(Math.abs(crop.h - pair.h) / pair.h).toBeLessThan(0.01);
      expect(crop.w).toBeCloseTo(crop.h * aspect, 5);
      expect(crop.w).toBeGreaterThan(342);
      // The head's middle (x = 0.4 of the photo) is the crop's middle.
      expect(crop.x + crop.w / 2).toBeCloseTo(0.4 * 342, 5);
      // All of the photo is inside the crop, across.
      expect(crop.x).toBeLessThanOrEqual(0);
      expect(crop.x + crop.w).toBeGreaterThanOrEqual(342);
      // The crown is in, a little under the crop's top.
      expect(crop.y).toBeLessThan(0.1 * 513);
    }
  });
});
