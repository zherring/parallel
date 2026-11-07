import { describe, expect, it } from "vitest";
import { focusWeight, jsLayerTranslate, projectX, projectY, visibleDocRange } from "@/lib/depth-projection";

const FACTORS = [1, 0.758, 0.61, 0.526, 0.476];

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
