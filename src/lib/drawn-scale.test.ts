import { describe, expect, it } from "vitest";
import { drawnScale } from "@/lib/drawn-scale";

/** An element as far as `drawnScale` reads one: its layout width, and the width its rect has on the screen. */
const element = (offsetWidth: number, drawnWidth: number) => ({ offsetWidth, getBoundingClientRect: () => ({ width: drawnWidth }) }) as unknown as HTMLElement;

describe("drawnScale", () => {
  it("is 1 for a scroller that is drawn at its own size", () => {
    expect(drawnScale(element(480, 480))).toBe(1);
  });

  it("is how much smaller than its layout a scaled scroller is drawn (the pair embed's fit)", () => {
    expect(drawnScale(element(600, 510))).toBeCloseTo(0.85, 10);
    expect(drawnScale(element(1000, 620))).toBeCloseTo(0.62, 10);
  });

  it("keeps sub-pixel noise as it is: the same number is what a drag and the scroll position are both read in", () => {
    expect(drawnScale(element(1200, 1200.4))).toBeCloseTo(1.000333, 5);
  });

  it("is 1 for a scroller with no box (hidden, or not laid out yet), never 0 or NaN", () => {
    expect(drawnScale(element(0, 0))).toBe(1);
    expect(drawnScale(element(0, 120))).toBe(1);
    expect(drawnScale(element(300, 0))).toBe(1);
  });
});
