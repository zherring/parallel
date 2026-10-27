import { describe, expect, it } from "vitest";
import {
  LINE_Y,
  MORE_LEFT,
  MORE_UNDER,
  POSTER_SLOTS,
  POSTER_TOP,
  STAGE,
  moreLabelPlace,
  posterPlace,
  posterSlotLeft,
} from "@/lib/hero-layout";

const COUNTS = Array.from({ length: POSTER_SLOTS - 2 }, (_, i) => i + 3); // 3, 4, 5

/** The horizontal extent of the posters of a row of `count`, before their tilt. */
function extent(count: number) {
  const lefts = Array.from({ length: count }, (_, slot) => posterSlotLeft(slot) + posterPlace(slot, count).dx);
  return { left: Math.min(...lefts), right: Math.max(...lefts) + STAGE.posterSize.width };
}

describe("posterPlace", () => {
  it("centres the row on the stage for three, four and five posters", () => {
    for (const count of COUNTS) {
      const { left, right } = extent(count);
      expect((left + right) / 2, `row of ${count}`).toBeCloseTo(STAGE.width / 2, 6);
    }
  });

  it("overlaps neighbours a little, and keeps a full row inside the stage", () => {
    const { left, right } = extent(POSTER_SLOTS);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(STAGE.width);
    expect(posterSlotLeft(1) - posterSlotLeft(0)).toBeLessThan(STAGE.posterSize.width);
  });

  it("does not move a full row, and slides a shorter one in by half a step per missing poster", () => {
    expect(posterPlace(2, POSTER_SLOTS).dx).toBe(0);
    const step = posterSlotLeft(1) - posterSlotLeft(0);
    expect(posterPlace(0, POSTER_SLOTS - 1).dx).toBeCloseTo(step / 2, 6);
    expect(posterPlace(0, POSTER_SLOTS - 2).dx).toBeCloseTo(step, 6);
  });

  it("fans the tilt left to right, and keeps every poster within a few degrees of upright", () => {
    for (const count of COUNTS) {
      const tilts = Array.from({ length: count }, (_, slot) => posterPlace(slot, count).tilt);
      expect(tilts[count - 1]).toBeGreaterThan(tilts[0]);
      for (const tilt of tilts) expect(Math.abs(tilt)).toBeLessThanOrEqual(8);
    }
  });

  it("keeps the line through the posters: each is within a few pixels of it", () => {
    for (let slot = 0; slot < POSTER_SLOTS; slot++) {
      const middle = POSTER_TOP + STAGE.posterSize.height / 2 + posterPlace(slot, POSTER_SLOTS).dy;
      expect(Math.abs(middle - LINE_Y)).toBeLessThanOrEqual(5);
    }
  });
});

describe("moreLabelPlace", () => {
  it("starts past the right end of a full row", () => {
    expect(MORE_LEFT).toBeGreaterThan(extent(POSTER_SLOTS).right);
  });

  it("has a narrow-phone place centred on the stage, under the posters", () => {
    expect(MORE_UNDER.x).toBe(STAGE.width / 2);
    expect(MORE_UNDER.y).toBeGreaterThan(POSTER_TOP + STAGE.posterSize.height);
    expect(MORE_UNDER.y).toBeLessThan(STAGE.height);
  });

  it("follows the right end of a shorter row, and never moves the row", () => {
    for (const count of COUNTS) {
      const labelLeft = MORE_LEFT + moreLabelPlace(count).dx;
      const gap = labelLeft - extent(count).right;
      expect(gap, `row of ${count}`).toBeCloseTo(MORE_LEFT - extent(POSTER_SLOTS).right, 6);
      expect(gap).toBeGreaterThan(0);
    }
  });
});
