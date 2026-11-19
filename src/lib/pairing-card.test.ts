import { describe, expect, it } from "vitest";
import {
  CARD_MIN_HEIGHT_PX,
  DUO_ASPECT,
  DUO_BACKDROP,
  DUO_LEAN_PX,
  DUO_STEP,
  NUDGE_FIRST_PX,
  NUDGE_LAST_PX,
  PORTRAIT_ASPECT,
  SPLIT_SEAM_ANGLE_DEG,
  SPLIT_SEAM_HOVER_PX,
  SPLIT_SEAM_PX,
  SPLIT_SHIFT_PX,
  cascadeLayout,
  duoLayout,
  splitClips,
  splitLayout,
} from "@/lib/pairing-card";

describe("cascadeLayout", () => {
  it("is nothing until the box has a size", () => {
    expect(cascadeLayout(0, 0, 2)).toBeNull();
    expect(cascadeLayout(120, 0, 2)).toBeNull();
  });

  it("cascades a pair from the top left to the bottom right: A turned left, B lower and to the right, turned right, over the bottom right of A", () => {
    const layout = cascadeLayout(300, 220, 2)!;
    const [a, b] = layout.places;
    expect(a.x).toBe(0);
    expect(a.tilt).toBe(-5);
    expect(b.tilt).toBe(4);
    expect(b.x).toBeGreaterThan(a.x + layout.w * 0.4);
    expect(b.y).toBeGreaterThan(a.y + layout.h * 0.4);
    // B covers A's bottom right: over its width and height, by about a quarter of its area.
    const covered = ((layout.w - (b.x - a.x)) / layout.w) * ((layout.h - (b.y - a.y)) / layout.h);
    expect(covered).toBeGreaterThan(0.15);
    expect(covered).toBeLessThan(0.35);
    expect(layout.w / layout.h).toBeCloseTo(PORTRAIT_ASPECT, 2);
  });

  it("makes the pair as tall as a short, wide box (from its top to its bottom), each portrait a little over half of it", () => {
    const layout = cascadeLayout(400, 144, 2)!;
    const [a, b] = layout.places;
    expect(a.y).toBeCloseTo(0, 0);
    expect(b.y + layout.h).toBeCloseTo(144, 0);
    expect(layout.h / 144).toBeGreaterThan(0.55);
    expect(layout.h / 144).toBeLessThan(0.7);
  });

  it("makes it as wide as a narrow, tall box, centred on its height, left at its edge", () => {
    const layout = cascadeLayout(110, 230, 2)!;
    const [a, b] = layout.places;
    expect(a.x).toBe(0);
    expect(b.x + layout.w).toBeCloseTo(110, 0);
    // Shorter than the box, and centred on it.
    const top = a.y;
    const bottom = b.y + layout.h;
    expect(bottom - top).toBeLessThan(230);
    expect(top).toBeCloseTo(230 - bottom, 0);
  });

  it("slides B about 3px down and to the right on hover, and A about 2px up and to the left", () => {
    const [a, b] = cascadeLayout(200, 150, 2)!.places;
    expect(a.nudge).toBe(NUDGE_FIRST_PX);
    expect(b.nudge).toBe(NUDGE_LAST_PX);
    expect([NUDGE_FIRST_PX, NUDGE_LAST_PX]).toEqual([-2, 3]);
  });

  it("keeps people in order along the diagonal, whatever their number", () => {
    for (const count of [1, 2, 3, 4]) {
      const { places } = cascadeLayout(220, 200, count)!;
      expect(places).toHaveLength(count);
      expect(places.map((place) => place.x)).toEqual([...places.map((place) => place.x)].sort((x, y) => x - y));
      expect(places.map((place) => place.y)).toEqual([...places.map((place) => place.y)].sort((x, y) => x - y));
    }
  });

  it("cascades three or four the same way, alternating tilts, each a smaller step from the one before, inside the box", () => {
    const pair = cascadeLayout(240, 200, 2)!;
    const three = cascadeLayout(240, 200, 3)!;
    const four = cascadeLayout(240, 200, 4)!;
    expect(three.places.map((place) => Math.sign(place.tilt))).toEqual([-1, 1, -1]);
    expect(four.places.map((place) => Math.sign(place.tilt))).toEqual([-1, 1, -1, 1]);
    expect(three.places[1].x / three.w).toBeLessThan(pair.places[1].x / pair.w);
    expect(four.places[1].x / four.w).toBeLessThan(three.places[1].x / three.w);
    for (const layout of [pair, three, four]) {
      const last = layout.places[layout.places.length - 1];
      expect(last.x + layout.w).toBeLessThanOrEqual(240.2);
      expect(last.y + layout.h).toBeLessThanOrEqual(200.2);
    }
    expect(three.places[2].nudge).toBe(NUDGE_LAST_PX);
    expect(three.places[0].nudge).toBe(NUDGE_FIRST_PX);
    expect(three.places[1].nudge).toBeGreaterThan(NUDGE_FIRST_PX);
    expect(three.places[1].nudge).toBeLessThan(NUDGE_LAST_PX);
  });

  it("is a single portrait, still, for one person", () => {
    const one = cascadeLayout(100, 140, 1)!;
    expect(one.places).toHaveLength(1);
    expect(one.places[0].nudge).toBe(0);
  });
});

describe("the card's least height", () => {
  it("is 150px on a phone and 160px on a desktop, so the portraits are never tiny", () => {
    expect(CARD_MIN_HEIGHT_PX).toEqual({ phone: 150, desktop: 160 });
  });
});

describe("splitLayout and splitClips", () => {
  it("is a square as big as the box allows, at its left, centred on its height", () => {
    expect(splitLayout(0, 100)).toBeNull();
    expect(splitLayout(112, 212)).toEqual({ s: 112, x: 0, y: 50 });
    expect(splitLayout(180, 120)).toEqual({ s: 120, x: 0, y: 0 });
  });

  it("clips A to the upper left of a seam that runs from the lower left to the upper right, not at 45 degrees, and B to the lower right, a thin gap between", () => {
    expect(SPLIT_SEAM_ANGLE_DEG).not.toBe(45);
    const { a, b } = splitClips(100, 2.5);
    const points = (polygon: string) => [...polygon.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const pa = points(a);
    const pb = points(b);
    expect(pa).toHaveLength(4);
    expect(pb).toHaveLength(4);
    // The two seam edges (A's lower, B's upper) are parallel: the same y at both ends differs by the same amount.
    const seamA = [pa[3], pa[2]]; // left, right
    const seamB = [pb[0], pb[1]];
    const gapLeft = seamB[0][1] - seamA[0][1];
    const gapRight = seamB[1][1] - seamA[1][1];
    expect(gapLeft).toBeCloseTo(gapRight, 1);
    // Measured square to the seam, the gap is the seam's width.
    expect(gapLeft * Math.cos((SPLIT_SEAM_ANGLE_DEG * Math.PI) / 180)).toBeCloseTo(2.5, 0);
    // The seam rises to the right (lower left to upper right), through the middle.
    expect(seamA[1][1]).toBeLessThan(seamA[0][1]);
    expect((seamA[0][1] + seamA[1][1]) / 2 + gapLeft / 2).toBeCloseTo(50, 0);
    // A is above it, B below: A's top corners are above the tile, B's bottom ones below it (past its edges).
    expect(pa[0][1]).toBeLessThan(0);
    expect(pb[2][1]).toBeGreaterThan(100);
  });

  it("is a wider gap when the seam widens on hover", () => {
    const rest = splitClips(100, SPLIT_SEAM_PX);
    const hover = splitClips(100, SPLIT_SEAM_HOVER_PX);
    expect(hover.a).not.toBe(rest.a);
    expect(SPLIT_SEAM_HOVER_PX).toBeGreaterThan(SPLIT_SEAM_PX);
    expect(SPLIT_SHIFT_PX).toBeGreaterThan(0);
  });
});

describe("duoLayout", () => {
  it("is nothing until the box has a size", () => {
    expect(duoLayout(0, 0, 2)).toBeNull();
  });

  it("stands two figures side by side from the box's left, B further along and over A, overlapping like shoulders, the pair as wide as the box when it is narrow", () => {
    const layout = duoLayout(110, 230, 2)!;
    const [a, b] = layout.places;
    expect(a.x).toBe(0);
    expect(b.x).toBeCloseTo(DUO_STEP * layout.w, 0);
    expect(b.x).toBeLessThan(layout.w);
    expect(b.x + layout.w).toBeCloseTo(110, 0);
    expect(layout.w / layout.h).toBeCloseTo(DUO_ASPECT, 2);
    expect(layout.h).toBeLessThan(230);
  });

  it("makes the figures as tall as a short, wide box, standing on its bottom; in a narrow, tall one they are centred on its height", () => {
    const short = duoLayout(400, 144, 2)!;
    expect(short.h).toBe(144);
    expect(short.inset).toBe(0);
    expect(short.top).toBeCloseTo(144 - 144 * DUO_BACKDROP, 0);
    const tall = duoLayout(110, 230, 2)!;
    expect(tall.inset).toBeGreaterThan(40);
    expect(tall.inset * 2 + tall.h).toBeCloseTo(230, 0);
  });

  it("leans the first figure to the left and the last to the right on hover, the middle of three not at all", () => {
    const [a, b] = duoLayout(200, 150, 2)!.places;
    expect([a.lean, b.lean]).toEqual([-DUO_LEAN_PX, DUO_LEAN_PX]);
    expect(duoLayout(200, 150, 3)!.places.map((place) => place.lean)).toEqual([-DUO_LEAN_PX, 0, DUO_LEAN_PX]);
  });
});
