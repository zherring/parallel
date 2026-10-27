import { describe, expect, it } from "vitest";
import {
  clampScrollLeft,
  dateFraction,
  dragScrollLeft,
  keyboardScrollLeft,
  maxScrollLeft,
  minimapTicks,
  scrollLeftForBarClick,
  scrollLeftForWindowLeft,
  scrollLeftToCenterTrackX,
  scrollPercent,
  visibleYears,
  windowRect,
} from "@/lib/minimap";
import { makeScale, packFilms, trackWidth, xForDate, xForYear } from "@/lib/timeline-layout";

// A 1000px track seen through a 250px viewport: the window is a quarter of the bar.
const track = 1000;
const viewport = 250;

describe("scroll limits", () => {
  it("maxScrollLeft is track - viewport, never negative", () => {
    expect(maxScrollLeft(track, viewport)).toBe(750);
    expect(maxScrollLeft(200, 250)).toBe(0);
  });

  it("clamps into [0, max]", () => {
    expect(clampScrollLeft(-50, track, viewport)).toBe(0);
    expect(clampScrollLeft(300, track, viewport)).toBe(300);
    expect(clampScrollLeft(9999, track, viewport)).toBe(750);
    expect(clampScrollLeft(Number.NaN, track, viewport)).toBe(0);
  });
});

describe("windowRect", () => {
  it("has the width ratio viewport / track", () => {
    expect(windowRect({ scrollLeft: 0, viewport, track })).toEqual({ left: 0, width: 0.25 });
  });

  it("maps scrollLeft to the left edge", () => {
    expect(windowRect({ scrollLeft: 400, viewport, track }).left).toBeCloseTo(0.4);
  });

  it("ends flush with the bar at the maximum scroll", () => {
    const rect = windowRect({ scrollLeft: 750, viewport, track });
    expect(rect.left + rect.width).toBeCloseTo(1);
  });

  it("clamps an overscrolled value (elastic scrolling)", () => {
    expect(windowRect({ scrollLeft: -40, viewport, track }).left).toBe(0);
    const over = windowRect({ scrollLeft: 5000, viewport, track });
    expect(over.left + over.width).toBeCloseTo(1);
  });

  it("fills the bar when everything is visible, or when sizes are not known yet", () => {
    expect(windowRect({ scrollLeft: 0, viewport: 300, track: 300 })).toEqual({ left: 0, width: 1 });
    expect(windowRect({ scrollLeft: 0, viewport: 300, track: 0 })).toEqual({ left: 0, width: 1 });
  });

  it("gets narrower when zooming in over the same viewport", () => {
    const before = windowRect({ scrollLeft: 100, viewport, track: 1000 });
    const after = windowRect({ scrollLeft: 100, viewport, track: 2000 });
    expect(after.width).toBeCloseTo(before.width / 2);
  });
});

describe("scrollPercent", () => {
  it("runs 0 to 100", () => {
    expect(scrollPercent({ scrollLeft: 0, viewport, track })).toBe(0);
    expect(scrollPercent({ scrollLeft: 375, viewport, track })).toBe(50);
    expect(scrollPercent({ scrollLeft: 750, viewport, track })).toBe(100);
  });

  it("is 0 with nothing to scroll", () => {
    expect(scrollPercent({ scrollLeft: 0, viewport: 300, track: 300 })).toBe(0);
  });
});

describe("scrollLeftForWindowLeft", () => {
  it("is the inverse of windowRect().left", () => {
    for (const scrollLeft of [0, 120, 333, 750]) {
      const { left } = windowRect({ scrollLeft, viewport, track });
      expect(scrollLeftForWindowLeft(left, track, viewport)).toBeCloseTo(scrollLeft);
    }
  });

  it("clamps", () => {
    expect(scrollLeftForWindowLeft(0.95, track, viewport)).toBe(750);
    expect(scrollLeftForWindowLeft(-1, track, viewport)).toBe(0);
  });
});

describe("dragScrollLeft", () => {
  const base = { barWidth: 500, track, viewport };

  it("moves the scroller by deltaPx * track / barWidth, so the window follows the pointer 1:1", () => {
    const next = dragScrollLeft({ ...base, startScrollLeft: 100, deltaPx: 50 });
    expect(next).toBe(200);
    const before = windowRect({ scrollLeft: 100, viewport, track }).left * base.barWidth;
    const after = windowRect({ scrollLeft: next, viewport, track }).left * base.barWidth;
    expect(after - before).toBeCloseTo(50);
  });

  it("drags backwards too", () => {
    expect(dragScrollLeft({ ...base, startScrollLeft: 300, deltaPx: -25 })).toBe(250);
  });

  it("clamps at both ends", () => {
    expect(dragScrollLeft({ ...base, startScrollLeft: 100, deltaPx: -500 })).toBe(0);
    expect(dragScrollLeft({ ...base, startScrollLeft: 100, deltaPx: 5000 })).toBe(750);
  });

  it("does nothing useful without a bar width", () => {
    expect(dragScrollLeft({ ...base, barWidth: 0, startScrollLeft: 100, deltaPx: 50 })).toBe(100);
  });
});

describe("scrollLeftForBarClick", () => {
  it("centres the window on the click", () => {
    const left = scrollLeftForBarClick(250, 500, track, viewport); // middle of the bar
    const rect = windowRect({ scrollLeft: left, viewport, track });
    expect(rect.left + rect.width / 2).toBeCloseTo(0.5);
  });

  it("clamps near the ends", () => {
    expect(scrollLeftForBarClick(5, 500, track, viewport)).toBe(0);
    expect(scrollLeftForBarClick(498, 500, track, viewport)).toBe(750);
    expect(scrollLeftForBarClick(-30, 500, track, viewport)).toBe(0);
    expect(scrollLeftForBarClick(900, 500, track, viewport)).toBe(750);
  });

  it("is 0 without a bar width", () => {
    expect(scrollLeftForBarClick(10, 0, track, viewport)).toBe(0);
  });
});

describe("scrollLeftToCenterTrackX", () => {
  it("puts the film x in the middle of the viewport", () => {
    expect(scrollLeftToCenterTrackX(600, track, viewport)).toBe(475);
  });

  it("clamps films near the ends", () => {
    expect(scrollLeftToCenterTrackX(40, track, viewport)).toBe(0);
    expect(scrollLeftToCenterTrackX(990, track, viewport)).toBe(750);
  });
});

describe("keyboardScrollLeft", () => {
  it("steps by 10% of the window with the arrows", () => {
    expect(keyboardScrollLeft("ArrowRight", 100, track, viewport)).toBe(125);
    expect(keyboardScrollLeft("ArrowLeft", 100, track, viewport)).toBe(75);
  });

  it("pages by a whole window", () => {
    expect(keyboardScrollLeft("PageDown", 100, track, viewport)).toBe(350);
    expect(keyboardScrollLeft("PageUp", 400, track, viewport)).toBe(150);
  });

  it("jumps to the ends", () => {
    expect(keyboardScrollLeft("Home", 400, track, viewport)).toBe(0);
    expect(keyboardScrollLeft("End", 400, track, viewport)).toBe(750);
  });

  it("clamps and ignores other keys", () => {
    expect(keyboardScrollLeft("ArrowLeft", 5, track, viewport)).toBe(0);
    expect(keyboardScrollLeft("PageDown", 700, track, viewport)).toBe(750);
    expect(keyboardScrollLeft("a", 100, track, viewport)).toBeNull();
    expect(keyboardScrollLeft("Enter", 100, track, viewport)).toBeNull();
  });
});

describe("dateFraction and zoom", () => {
  const range = { startYear: 1948, endYear: 1966 };

  it("puts a film at its track x over the track width, the same x the timeline draws it at", () => {
    const scale = makeScale(range, 72);
    const date = "1954-04-26";
    const [packed] = packFilms([{ id: 1, releaseDate: date }], { pxPerYear: 72, axisStartYear: scale.axisStartYear });
    expect(dateFraction(scale, date)).toBeCloseTo(packed.x / trackWidth(scale), 10);
  });

  it("lies within the bar for dates on the axis, and is monotonic in the date", () => {
    const scale = makeScale(range, 72);
    const dates = ["1948-01-01", "1952-06-15", "1960-12-31", "1966-01-01"];
    const fractions = dates.map((d) => dateFraction(scale, d));
    for (const f of fractions) expect(f).toBeGreaterThanOrEqual(0);
    for (const f of fractions) expect(f).toBeLessThanOrEqual(1);
    expect([...fractions].sort((a, b) => a - b)).toEqual(fractions);
  });

  it("clamps dates outside the axis", () => {
    const scale = makeScale(range, 72);
    expect(dateFraction(scale, "1900-01-01")).toBe(0);
    expect(dateFraction(scale, "2100-01-01")).toBe(1);
  });

  it("keeps a node under the same part of the window when zooming (the window shrinks, nodes stay put)", () => {
    const film = "1957-07-01";
    const small = makeScale(range, 40);
    const big = makeScale(range, 160);
    // Nodes barely move: only the constant track padding changes their fraction.
    expect(Math.abs(dateFraction(small, film) - dateFraction(big, film))).toBeLessThan(0.03);
    // While the same viewport covers a smaller share of the bar.
    const vp = 800;
    const wSmall = windowRect({ scrollLeft: 0, viewport: vp, track: trackWidth(small) }).width;
    const wBig = windowRect({ scrollLeft: 0, viewport: vp, track: trackWidth(big) }).width;
    expect(wBig).toBeLessThan(wSmall);
  });

  it("a node is inside the window exactly when the film is inside the visible track", () => {
    const scale = makeScale(range, 72);
    const track = trackWidth(scale);
    const vp = 400;
    const x = xForDate(scale, "1955-03-01");
    for (const scrollLeft of [0, 300, 600, 900]) {
      const rect = windowRect({ scrollLeft, viewport: vp, track });
      const nodeInWindow = dateFraction(scale, "1955-03-01") >= rect.left && dateFraction(scale, "1955-03-01") <= rect.left + rect.width;
      const filmVisible = x >= scrollLeft && x <= scrollLeft + vp;
      expect(nodeInWindow).toBe(filmVisible);
    }
  });
});

describe("visibleYears", () => {
  const scale = makeScale({ startYear: 1950, endYear: 1970 }, 50);

  it("reads the years at the window edges", () => {
    const x1960 = xForYear(scale, 1960);
    expect(visibleYears({ scrollLeft: x1960, viewport: 250 }, scale)).toEqual({ from: 1960, to: 1965 });
  });

  it("stays on the axis", () => {
    expect(visibleYears({ scrollLeft: 0, viewport: 100_000 }, scale)).toEqual({ from: 1950, to: 1970 });
  });
});

describe("minimapTicks", () => {
  const scale = makeScale({ startYear: 1948, endYear: 1996 }, 72);

  it("labels the first and last year and draws a line at every decade", () => {
    const ticks = minimapTicks(scale, { barWidth: 600 });
    expect(ticks.filter((t) => t.decade).map((t) => t.year)).toEqual([1950, 1960, 1970, 1980, 1990]);
    expect(ticks[0].year).toBe(1948);
    expect(ticks[0].label).toBe("1948");
    expect(ticks[ticks.length - 1].label).toBe("1996");
  });

  it("labels decades when there is room", () => {
    const labels = minimapTicks(scale, { barWidth: 900 })
      .filter((t) => t.label)
      .map((t) => t.label);
    expect(labels).toEqual(["1948", "1950", "1960", "1970", "1980", "1990", "1996"].filter((l) => labels.includes(l)));
    expect(labels).toContain("1970");
  });

  it("never lets two labels get closer than the gap, and keeps them inside the bar", () => {
    for (const barWidth of [120, 200, 320, 600, 1100]) {
      const labelled = minimapTicks(scale, { barWidth, minLabelGap: 40, labelHalfWidth: 13 }).filter((t) => t.label);
      for (let i = 1; i < labelled.length; i++) {
        expect(labelled[i].labelX - labelled[i - 1].labelX).toBeGreaterThanOrEqual(40 - 1e-9);
      }
      for (const t of labelled) {
        expect(t.labelX).toBeGreaterThanOrEqual(13);
        expect(t.labelX).toBeLessThanOrEqual(barWidth - 13);
      }
    }
  });

  it("thins labels on a narrow bar but keeps both ends", () => {
    const ticks = minimapTicks(scale, { barWidth: 150 });
    const labelled = ticks.filter((t) => t.label);
    expect(labelled[0].label).toBe("1948");
    expect(labelled[labelled.length - 1].label).toBe("1996");
    expect(labelled.length).toBeLessThan(7);
  });

  it("drops the unlabelled decade lines when they would form a solid block", () => {
    const wide = makeScale({ startYear: 1900, endYear: 2030 }, 24);
    const ticks = minimapTicks(wide, { barWidth: 200 });
    expect(ticks.filter((t) => t.decade && !t.label).length).toBeLessThanOrEqual(ticks.length);
    expect(minimapTicks(wide, { barWidth: 30, minLineGap: 40 }).filter((t) => t.decade)).toEqual([]);
  });

  it("returns nothing before the bar has a width", () => {
    expect(minimapTicks(scale, { barWidth: 0 })).toEqual([]);
  });

  it("puts fractions between 0 and 1 in axis order", () => {
    const ticks = minimapTicks(scale, { barWidth: 600 });
    for (const t of ticks) {
      expect(t.fraction).toBeGreaterThanOrEqual(0);
      expect(t.fraction).toBeLessThanOrEqual(1);
    }
    expect(ticks.map((t) => t.fraction)).toEqual([...ticks.map((t) => t.fraction)].sort((a, b) => a - b));
  });
});
