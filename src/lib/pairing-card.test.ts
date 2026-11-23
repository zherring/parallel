import { describe, expect, it } from "vitest";
import {
  CARD_MIN_HEIGHT_PX,
  NUDGE_FIRST_PX,
  NUDGE_LAST_PX,
  PORTRAIT_ASPECT,
  cascadeLayout,
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
