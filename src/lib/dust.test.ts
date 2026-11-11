import { describe, expect, it } from "vitest";
import { MARGIN, createMotes, moteCount, stepMotes, type Mote } from "@/lib/dust";

const FIELD = { w: 800, h: 600 };

/** Where each mote is drawn, as plain numbers. */
const drawn = (motes: readonly Mote[]) => motes.map((m) => [m.sx, m.sy, m.a]);

describe("createMotes", () => {
  it("makes the same motes for the same seed, and others for another", () => {
    expect(createMotes(60, 7, FIELD)).toEqual(createMotes(60, 7, FIELD));
    expect(createMotes(60, 7, FIELD)).not.toEqual(createMotes(60, 8, FIELD));
  });

  it("makes the number asked for, and none for a count below 1", () => {
    expect(createMotes(75, 1, FIELD)).toHaveLength(75);
    expect(createMotes(0, 1, FIELD)).toEqual([]);
    expect(createMotes(-4, 1, FIELD)).toEqual([]);
  });

  it("starts every mote inside the field, drawn and visible", () => {
    for (const m of createMotes(100, 3, FIELD)) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x).toBeLessThanOrEqual(FIELD.w);
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeLessThanOrEqual(FIELD.h);
      expect(m.a).toBeGreaterThan(0);
    }
  });

  it("makes fine specks and a few large, faint, nearer bokeh discs", () => {
    const motes = createMotes(400, 11, FIELD);
    const bokeh = motes.filter((m) => m.bokeh);
    const fine = motes.filter((m) => !m.bokeh);
    expect(bokeh.length).toBeGreaterThan(10);
    expect(bokeh.length).toBeLessThan(motes.length / 5);
    expect(Math.min(...bokeh.map((m) => m.r))).toBeGreaterThan(Math.max(...fine.map((m) => m.r)));
    expect(Math.max(...bokeh.map((m) => m.alpha))).toBeLessThan(Math.min(...fine.map((m) => m.alpha)));
    expect(Math.min(...bokeh.map((m) => m.depth))).toBeGreaterThan(Math.min(...fine.map((m) => m.depth)));
    for (const m of fine) {
      expect(m.r).toBeGreaterThanOrEqual(0.7);
      expect(m.r).toBeLessThanOrEqual(2);
      expect(m.alpha).toBeGreaterThanOrEqual(0.18);
      expect(m.alpha).toBeLessThanOrEqual(0.5);
    }
  });
});

describe("stepMotes", () => {
  it("keeps every mote inside the field and its margin, however long it runs and however far the scroll goes", () => {
    const motes = createMotes(120, 5, FIELD);
    let scrollTop = 0;
    for (let frame = 0; frame < 2000; frame++) {
      scrollTop += (frame % 7) * 61 - 100;
      stepMotes(motes, 1 / 60, scrollTop, FIELD);
      for (const m of motes) {
        expect(m.sx).toBeGreaterThanOrEqual(-MARGIN);
        expect(m.sx).toBeLessThan(FIELD.w + MARGIN);
        expect(m.sy).toBeGreaterThanOrEqual(-MARGIN);
        expect(m.sy).toBeLessThan(FIELD.h + MARGIN);
        expect(m.a).toBeGreaterThan(0);
        expect(m.a).toBeLessThanOrEqual(m.alpha + 1e-9);
      }
    }
  });

  it("moves the motes with time: they drift, wobble and twinkle", () => {
    const motes = createMotes(40, 2, FIELD);
    const before = drawn(motes);
    stepMotes(motes, 3, 0, FIELD);
    expect(drawn(motes)).not.toEqual(before);
    expect(motes.some((m, i) => m.a !== before[i][2])).toBe(true);
  });

  it("only places the motes when no time has passed: a still picture", () => {
    const motes = createMotes(40, 2, FIELD);
    stepMotes(motes, 0, 0, FIELD);
    const still = drawn(motes);
    stepMotes(motes, 0, 0, FIELD);
    stepMotes(motes, Number.NaN, 0, FIELD);
    stepMotes(motes, -1, 0, FIELD);
    expect(drawn(motes)).toEqual(still);
  });

  it("is the same run for the same seed and the same steps", () => {
    const run = () => {
      const motes = createMotes(50, 9, FIELD);
      for (let i = 0; i < 100; i++) stepMotes(motes, 1 / 60, i * 13, FIELD);
      return drawn(motes);
    };
    expect(run()).toEqual(run());
  });

  it("does not let a long pause (a hidden tab) fling the motes: a step is at most a quarter of a second", () => {
    const a = createMotes(30, 4, FIELD);
    const b = createMotes(30, 4, FIELD);
    stepMotes(a, 600, 0, FIELD);
    stepMotes(b, 0.25, 0, FIELD);
    expect(drawn(a)).toEqual(drawn(b));
  });

  describe("parallax", () => {
    // Two motes at the same place that differ only in depth.
    const pair = (): [Mote, Mote] => {
      const [base] = createMotes(1, 1, FIELD);
      return [
        { ...base, y: 300, depth: 0.2, vx: 0, vy: 0, wobble: 0 },
        { ...base, y: 300, depth: 0.8, vx: 0, vy: 0, wobble: 0 },
      ];
    };

    it("moves a mote up by the scroll, in proportion to its depth", () => {
      const [far, near] = pair();
      stepMotes([far, near], 0, 0, FIELD);
      const [farY, nearY] = [far.sy, near.sy];
      stepMotes([far, near], 0, 100, FIELD);
      const farMoved = farY - far.sy;
      const nearMoved = nearY - near.sy;
      expect(farMoved).toBeGreaterThan(0);
      expect(nearMoved).toBeGreaterThan(farMoved);
      expect(nearMoved / farMoved).toBeCloseTo(0.8 / 0.2, 6);
    });

    it("does not move a mote sideways with the scroll, and scrolling back puts it back", () => {
      const [far] = pair();
      stepMotes([far], 0, 0, FIELD);
      const home = [far.sx, far.sy];
      stepMotes([far], 0, 250, FIELD);
      expect(far.sx).toBeCloseTo(home[0], 9);
      stepMotes([far], 0, 0, FIELD);
      expect([far.sx, far.sy]).toEqual(home);
    });

    it("wraps a mote that the scroll has carried off the top round to the bottom", () => {
      const [, near] = pair();
      stepMotes([near], 0, 20_000, FIELD);
      expect(near.sy).toBeGreaterThanOrEqual(-MARGIN);
      expect(near.sy).toBeLessThan(FIELD.h + MARGIN);
    });
  });
});

describe("moteCount", () => {
  it("is 60 on a phone, more on a larger screen, and at most 110", () => {
    expect(moteCount({ w: 390, h: 844 })).toBe(60);
    expect(moteCount({ w: 1440, h: 900 })).toBe(93);
    expect(moteCount({ w: 3840, h: 2160 })).toBe(110);
  });
});
