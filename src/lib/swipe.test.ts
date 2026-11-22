import { describe, expect, it } from "vitest";
import { releaseVelocity, swipeArmed, swipeAxis, swipeOutcome, swipeThreshold } from "@/lib/swipe";

describe("releaseVelocity", () => {
  it("is the speed over the last 100ms, signed", () => {
    const samples = [
      { t: 0, pos: 0 },
      { t: 900, pos: 10 },
      { t: 950, pos: 40 },
      { t: 1000, pos: 60 },
    ];
    expect(releaseVelocity(samples, 1000)).toBeCloseTo(0.5);
    expect(releaseVelocity(samples.map(({ t, pos }) => ({ t, pos: -pos })), 1000)).toBeCloseTo(-0.5);
  });

  it("is zero for a finger that rested before lifting, and without two samples", () => {
    expect(releaseVelocity([{ t: 0, pos: 0 }, { t: 50, pos: 200 }], 400)).toBe(0);
    expect(releaseVelocity([{ t: 0, pos: 0 }], 10)).toBe(0);
    expect(releaseVelocity([], 10)).toBe(0);
  });
});

describe("swipeOutcome", () => {
  it("springs back from a short, slow drag", () => {
    expect(swipeOutcome({ offset: 30, velocity: 0, extent: 300 })).toBe(0);
    expect(swipeOutcome({ offset: -30, velocity: -0.1, extent: 300 })).toBe(0);
    expect(swipeOutcome({ offset: 0, velocity: 2, extent: 300 })).toBe(0);
  });

  it("completes past a quarter of the extent, in the direction of the drag", () => {
    expect(swipeThreshold(300)).toBe(75);
    expect(swipeOutcome({ offset: 75, velocity: 0, extent: 300 })).toBe(1);
    expect(swipeOutcome({ offset: -80, velocity: 0, extent: 300 })).toBe(-1);
  });

  it("never asks for more than 140px, however large the thing", () => {
    expect(swipeThreshold(800)).toBe(140);
    expect(swipeOutcome({ offset: 139, velocity: 0, extent: 800 })).toBe(0);
    expect(swipeOutcome({ offset: 140, velocity: 0, extent: 800 })).toBe(1);
  });

  it("completes a flick from close by, but not one that went nowhere", () => {
    expect(swipeOutcome({ offset: 20, velocity: 0.6, extent: 300 })).toBe(1);
    expect(swipeOutcome({ offset: -20, velocity: -0.6, extent: 300 })).toBe(-1);
    expect(swipeOutcome({ offset: 5, velocity: 0.6, extent: 300 })).toBe(0);
  });

  it("springs back when the finger was flung back, however far it had gone", () => {
    expect(swipeOutcome({ offset: 200, velocity: -0.6, extent: 300 })).toBe(0);
    expect(swipeOutcome({ offset: -200, velocity: 0.6, extent: 300 })).toBe(0);
    // Drifting back slowly is not a change of mind.
    expect(swipeOutcome({ offset: 200, velocity: -0.1, extent: 300 })).toBe(1);
  });
});

describe("swipeArmed", () => {
  it("is true from the threshold on, either way", () => {
    expect(swipeArmed(74, 300)).toBe(false);
    expect(swipeArmed(75, 300)).toBe(true);
    expect(swipeArmed(-75, 300)).toBe(true);
  });
});

describe("swipeAxis", () => {
  it("waits for the slop, then names the dominant axis", () => {
    expect(swipeAxis(3, 2, 6)).toBeNull();
    expect(swipeAxis(8, 3, 6)).toBe("x");
    expect(swipeAxis(-3, 9, 6)).toBe("y");
    expect(swipeAxis(6, 6, 6)).toBe("y");
  });
});
