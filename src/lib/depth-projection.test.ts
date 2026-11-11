import { describe, expect, it } from "vitest";
import { DEPTH, depthPush, layerFactor, posterFactor } from "@/lib/depth-layout";
import { focusDistance, focusWeight, inWindow, jsLayerTranslate, projectX, projectY, visibleDocRange } from "@/lib/depth-projection";

// The first is a layer in front of the screen plane (100px forward), the rest are behind it.
const FACTORS = [1.111, 1, 0.758, 0.61, 0.526, 0.476];

describe("projectY", () => {
  it("is the plain position minus the scroll at factor 1", () => {
    expect(projectY(1500, 1000, 800, 1)).toBe(500);
    expect(projectY(0, 0, 800, 1)).toBe(0);
  });

  it("puts the point at the middle of the viewport at the middle, whatever the factor", () => {
    for (const f of FACTORS) {
      expect(projectY(1000 + 400, 1000, 800, f)).toBeCloseTo(400, 9);
      expect(projectY(7321 + 450, 7321, 900, f)).toBeCloseTo(450, 9);
    }
  });

  it("moves slower on a layer further back", () => {
    const screens = FACTORS.map((f) => projectY(1000, 0, 800, f));
    for (let i = 1; i < screens.length; i++) expect(Math.abs(screens[i] - 400)).toBeLessThan(Math.abs(screens[i - 1] - 400));
    // scrolled by 100px, a far poster moves by 100 f
    expect(projectY(1000, 0, 800, 0.5) - projectY(1000, 100, 800, 0.5)).toBeCloseTo(50, 9);
  });
});

describe("projectX", () => {
  it("is the identity at factor 1 and pulls towards the centre otherwise", () => {
    expect(projectX(120, 1000, 1)).toBe(120);
    expect(projectX(500, 1000, 0.5)).toBe(500);
    expect(projectX(300, 1000, 0.5)).toBe(400);
    expect(projectX(900, 1000, 0.5)).toBe(700);
  });
});

describe("visibleDocRange", () => {
  it("is the viewport at factor 1, widened by the buffer", () => {
    expect(visibleDocRange(1000, 800, 1, 0)).toEqual({ from: 1000, to: 1800 });
    expect(visibleDocRange(1000, 800, 1, 200)).toEqual({ from: 800, to: 2000 });
  });

  it("covers more document on a layer further back, around the centre", () => {
    const { from, to } = visibleDocRange(1000, 800, 0.5, 0);
    expect(to - from).toBeCloseTo(1600, 9);
    expect((from + to) / 2).toBeCloseTo(1400, 9);
  });

  it("is the inverse of projectY at its edges", () => {
    for (const f of FACTORS) {
      const { from, to } = visibleDocRange(2500, 900, f, 120);
      expect(projectY(from, 2500, 900, f)).toBeCloseTo(-120, 8);
      expect(projectY(to, 2500, 900, f)).toBeCloseTo(1020, 8);
    }
  });
});

describe("focusWeight", () => {
  it("is 1 at the focus and 0 at the radius and beyond", () => {
    expect(focusWeight(0, 220)).toBe(1);
    expect(focusWeight(220, 220)).toBe(0);
    expect(focusWeight(500, 220)).toBe(0);
  });

  it("is 1 inside 0.35 of the radius", () => {
    expect(focusWeight(0.35 * 220, 220)).toBe(1);
    expect(focusWeight(50, 220)).toBe(1);
  });

  it("falls monotonically between, and is symmetric", () => {
    let last = 1;
    for (let d = 0; d <= 240; d += 5) {
      const w = focusWeight(d, 220);
      expect(w).toBeLessThanOrEqual(last + 1e-12);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      last = w;
    }
    expect(focusWeight(-100, 220)).toBe(focusWeight(100, 220));
  });

  it("is 0 with no radius", () => {
    expect(focusWeight(0, 0)).toBe(0);
  });
});

describe("jsLayerTranslate", () => {
  it("is nothing at factor 1", () => {
    expect(jsLayerTranslate(5000, 800, 1)).toBe(0);
  });

  it("moves a flat layer, its posters placed at y f, onto the screen y that projectY gives", () => {
    const [S, H] = [3200, 900];
    for (const f of FACTORS) {
      for (const y of [S - 300, S + 200, S + 450, S + 1000]) {
        // A layer at translateZ(0) scrolls with the page: a poster at document y f sits at y f - S, then the layer is moved.
        expect(y * f - S + jsLayerTranslate(S, H, f)).toBeCloseTo(projectY(y, S, H, f), 9);
      }
    }
  });
});

describe("focusDistance", () => {
  it("is the straight distance to the pointer", () => {
    expect(focusDistance(130, 220, 800, { x: 100, y: 180 })).toBe(50);
  });

  it("is the distance to the middle line of the viewport without a pointer, whatever x is", () => {
    expect(focusDistance(10, 500, 800, null)).toBe(100);
    expect(focusDistance(900, 300, 800, null)).toBe(100);
    expect(focusDistance(0, 400, 800, null)).toBe(0);
  });
});

describe("inWindow", () => {
  it("is the viewport widened by the buffer, in screen px, whatever the layer", () => {
    for (const f of FACTORS) {
      // A poster whose screen y is within the viewport plus 1.5 screens is in; one a hair beyond is out.
      for (const screenY of [-1199, 0, 450, 900, 2249]) {
        const docY = 3000 + (screenY - 450 * (1 - f)) / f;
        expect(inWindow(docY, 3000, 900, f, 1350)).toBe(true);
      }
      for (const screenY of [-1351, 2251]) {
        const docY = 3000 + (screenY - 450 * (1 - f)) / f;
        expect(inWindow(docY, 3000, 900, f, 1350)).toBe(false);
      }
    }
  });

  it("holds for a layer in front of the screen plane (a factor above 1) too", () => {
    const f = 1.11;
    const docY = 3000 + (500 - 450 * (1 - f)) / f;
    expect(inWindow(docY, 3000, 900, f, 0)).toBe(true);
    expect(inWindow(3000 + 1000, 3000, 900, f, 0)).toBe(false);
  });
});

describe("per-poster factors", () => {
  // Posters of one layer (the first person's, `DEPTH.z[1]` back) pushed back by 0, a quarter, a half and all of the spread.
  const depths = [0, 0.25, 0.5, 1].map((o) => DEPTH.z[1] + depthPush(o));
  const fs = depths.map((depth) => posterFactor({ depth }));

  it("gives the posters of one layer a factor each, smaller the further back they are pushed", () => {
    for (let i = 1; i < fs.length; i++) expect(fs[i]).toBeLessThan(fs[i - 1]);
    expect(fs[0]).toBeCloseTo(layerFactor(1), 10);
    expect(fs[fs.length - 1]).toBeCloseTo(1000 / (1000 + DEPTH.z[1] + DEPTH.spread), 10);
  });

  it("keeps the focus line fixed for every poster: the point at the middle of the viewport stays at the middle", () => {
    for (const f of fs) expect(projectY(2000 + 450, 2000, 900, f)).toBeCloseTo(450, 9);
  });

  it("moves a poster pushed back slower than the scroll, so two posters at one document y drift apart and cross over", () => {
    // Both at document y 2900 with the viewport scrolled to 2000: below the middle, the nearer one is further from the focus line.
    const [near, far] = [projectY(2900, 2000, 900, fs[0]), projectY(2900, 2000, 900, fs[fs.length - 1])];
    expect(near - 450).toBeGreaterThan(far - 450);
    expect(far).toBeGreaterThan(450);
    // Scroll 100px: each moves by 100 f.
    for (const f of fs) expect(projectY(2900, 2000, 900, f) - projectY(2900, 2100, 900, f)).toBeCloseTo(100 * f, 9);
  });

  it("windows each poster by its own factor: a document y inside the window of a deep poster is outside the nearer one's", () => {
    const [nearest, deepest] = [fs[0], fs[fs.length - 1]];
    const [scrollTop, height, buffer] = [2000, 900, 300];
    // 700px below the middle of the screen on the deepest poster: 250px inside a window that ends 750px below the middle.
    const docY = scrollTop + height / 2 + 700 / deepest;
    expect(projectY(docY, scrollTop, height, deepest)).toBeCloseTo(height / 2 + 700, 9);
    expect(inWindow(docY, scrollTop, height, deepest, buffer)).toBe(true);
    // The same document y on the nearest poster's factor is further from the middle of the screen, past the window's end.
    expect(projectY(docY, scrollTop, height, nearest)).toBeGreaterThan(height + buffer);
    expect(inWindow(docY, scrollTop, height, nearest, buffer)).toBe(false);
  });

  it("lands the focus field's projected position on the browser's: the screen offset of a poster is its own offset times its own factor", () => {
    const W = 1440;
    for (const f of fs) {
      // A poster 400px right of the centre line, in its own plane, is 400 f on screen.
      expect(projectX(W / 2 + 400, W, f) - W / 2).toBeCloseTo(400 * f, 9);
    }
  });
});
