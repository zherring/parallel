import { describe, expect, it } from "vitest";
import {
  BRUSH_HANDLE_HIT,
  bandFractions,
  barPxPerYear,
  brushLabel,
  brushTarget,
  commitPeriod,
  createPeriod,
  deltaYears,
  filmsInPeriod,
  fractionForYear,
  keyboardPeriod,
  movePeriod,
  resizePeriod,
  samePeriod,
  viewportExtent,
  yearAtX,
  yearForFraction,
} from "@/lib/period-brush";
import { makeScale, trackWidth } from "@/lib/timeline-layout";

// Films from 1950 to 2000, so the axis runs from 1949 to 2001; 72 px a year makes the track 3824 px.
const scale = makeScale({ startYear: 1949, endYear: 2001 }, 72);
const span = { first: 1950, last: 2000 };
const BAR = 800;

describe("pixels and years", () => {
  it("puts the axis start at the left of the bar after its padding, and the end at the right", () => {
    expect(trackWidth(scale)).toBe(3824);
    expect(fractionForYear(scale, 1949)).toBeCloseTo(40 / 3824, 10);
    expect(fractionForYear(scale, 2001)).toBeCloseTo((40 + 52 * 72) / 3824, 10);
    expect(fractionForYear(scale, 2001)).toBeLessThan(1);
  });

  it("maps fractions to years and back", () => {
    for (const year of [1949, 1950, 1966.5, 1981, 2000, 2001]) {
      expect(yearForFraction(scale, fractionForYear(scale, year))).toBeCloseTo(year, 8);
    }
  });

  it("names the whole year under a pointer: the year it falls in", () => {
    const at = (year: number) => fractionForYear(scale, year) * BAR;
    expect(yearAtX(scale, at(1966), BAR)).toBe(1966);
    expect(yearAtX(scale, at(1966) + 0.4 * barPxPerYear(scale, BAR), BAR)).toBe(1966);
    expect(yearAtX(scale, at(1967) - 0.2, BAR)).toBe(1966);
    expect(yearAtX(scale, at(1967), BAR)).toBe(1967);
  });

  it("keeps a pointer outside the bar on its ends", () => {
    expect(yearAtX(scale, -50, BAR)).toBe(1949);
    expect(yearAtX(scale, BAR + 50, BAR)).toBe(2001);
    expect(yearAtX(scale, 10, 0)).toBe(1949);
  });

  it("converts pointer travel to whole years, rounding to the nearest", () => {
    const perYear = barPxPerYear(scale, BAR);
    expect(perYear).toBeCloseTo((BAR * 72) / 3824, 10);
    expect(deltaYears(scale, perYear * 3, BAR)).toBe(3);
    expect(deltaYears(scale, perYear * 3.4, BAR)).toBe(3);
    expect(deltaYears(scale, perYear * 3.6, BAR)).toBe(4);
    expect(deltaYears(scale, -perYear * 2, BAR)).toBe(-2);
    expect(deltaYears(scale, 5, 0)).toBe(0);
  });

  it("puts a band from the start of its first year to the end of its last", () => {
    const band = bandFractions(scale, { from: 1966, to: 1981 });
    expect(band.left).toBeCloseTo(fractionForYear(scale, 1966), 10);
    expect(band.right).toBeCloseTo(fractionForYear(scale, 1982), 10);
    const oneYear = bandFractions(scale, { from: 1990, to: 1990 });
    expect(oneYear.right - oneYear.left).toBeCloseTo(72 / 3824, 10);
  });
});

describe("making a selection", () => {
  it("runs from the pressed year to the released year, whichever way it is dragged", () => {
    expect(createPeriod(1966, 1981, span)).toEqual({ from: 1966, to: 1981 });
    expect(createPeriod(1981, 1966, span)).toEqual({ from: 1966, to: 1981 });
  });

  it("is one year at the least: a press and release in the same year", () => {
    expect(createPeriod(1975, 1975, span)).toEqual({ from: 1975, to: 1975 });
  });

  it("stays inside the years of the films", () => {
    expect(createPeriod(1949, 1960, span)).toEqual({ from: 1950, to: 1960 });
    expect(createPeriod(1990, 2001, span)).toEqual({ from: 1990, to: 2000 });
    expect(createPeriod(1949, 2001, span)).toEqual({ from: 1950, to: 2000 });
    // Both ends past the same side give the year at that end.
    expect(createPeriod(1940, 1945, span)).toEqual({ from: 1950, to: 1950 });
  });
});

describe("moving a selection", () => {
  const start = { from: 1966, to: 1981 };

  it("moves by whole years and keeps its length", () => {
    expect(movePeriod(start, 5, span)).toEqual({ from: 1971, to: 1986 });
    expect(movePeriod(start, -10, span)).toEqual({ from: 1956, to: 1971 });
    expect(movePeriod(start, 0, span)).toEqual(start);
  });

  it("stops at the ends of the span instead of shrinking", () => {
    expect(movePeriod(start, -100, span)).toEqual({ from: 1950, to: 1965 });
    expect(movePeriod(start, 100, span)).toEqual({ from: 1985, to: 2000 });
  });

  it("moves a one-year band too", () => {
    expect(movePeriod({ from: 1990, to: 1990 }, 7, span)).toEqual({ from: 1997, to: 1997 });
    expect(movePeriod({ from: 1990, to: 1990 }, 50, span)).toEqual({ from: 2000, to: 2000 });
  });
});

describe("resizing a selection", () => {
  const start = { from: 1966, to: 1981 };

  it("moves one edge and leaves the other", () => {
    expect(resizePeriod(start, "start", -4, span)).toEqual({ from: 1962, to: 1981 });
    expect(resizePeriod(start, "end", 10, span)).toEqual({ from: 1966, to: 1991 });
  });

  it("never lets the edges cross: one year is the shortest", () => {
    expect(resizePeriod(start, "start", 100, span)).toEqual({ from: 1981, to: 1981 });
    expect(resizePeriod(start, "end", -100, span)).toEqual({ from: 1966, to: 1966 });
  });

  it("stays inside the span", () => {
    expect(resizePeriod(start, "start", -100, span)).toEqual({ from: 1950, to: 1981 });
    expect(resizePeriod(start, "end", 100, span)).toEqual({ from: 1966, to: 2000 });
  });
});

describe("keys on a handle", () => {
  const period = { from: 1966, to: 1981 };

  it("moves the edge a year with the arrows and five with Shift", () => {
    expect(keyboardPeriod("ArrowLeft", false, "start", period, span)).toEqual({ from: 1965, to: 1981 });
    expect(keyboardPeriod("ArrowRight", false, "start", period, span)).toEqual({ from: 1967, to: 1981 });
    expect(keyboardPeriod("ArrowLeft", true, "end", period, span)).toEqual({ from: 1966, to: 1976 });
    expect(keyboardPeriod("ArrowRight", true, "end", period, span)).toEqual({ from: 1966, to: 1986 });
  });

  it("takes an edge to its limit with Home and End", () => {
    expect(keyboardPeriod("Home", false, "start", period, span)).toEqual({ from: 1950, to: 1981 });
    expect(keyboardPeriod("End", false, "end", period, span)).toEqual({ from: 1966, to: 2000 });
    expect(keyboardPeriod("End", false, "start", period, span)).toEqual({ from: 1981, to: 1981 });
  });

  it("is null for other keys, and for a key that changes nothing", () => {
    expect(keyboardPeriod("Enter", false, "start", period, span)).toBeNull();
    expect(keyboardPeriod("a", false, "end", period, span)).toBeNull();
    expect(keyboardPeriod("ArrowLeft", false, "start", { from: 1950, to: 1981 }, span)).toBeNull();
    expect(keyboardPeriod("ArrowRight", false, "end", { from: 1966, to: 2000 }, span)).toBeNull();
    expect(keyboardPeriod("ArrowRight", false, "start", { from: 1981, to: 1981 }, span)).toBeNull();
  });
});

describe("committing a selection", () => {
  it("is a period when it covers part of the span", () => {
    expect(commitPeriod({ from: 1966, to: 1981 }, span)).toEqual({ from: 1966, to: 1981 });
    expect(commitPeriod({ from: 1950, to: 1999 }, span)).toEqual({ from: 1950, to: 1999 });
    expect(commitPeriod({ from: 1951, to: 2000 }, span)).toEqual({ from: 1951, to: 2000 });
  });

  it("is no period when it covers all of the span", () => {
    expect(commitPeriod({ from: 1950, to: 2000 }, span)).toBeNull();
  });

  it("compares periods", () => {
    expect(samePeriod(null, null)).toBe(true);
    expect(samePeriod({ from: 1, to: 2 }, { from: 1, to: 2 })).toBe(true);
    expect(samePeriod({ from: 1, to: 2 }, { from: 1, to: 3 })).toBe(false);
    expect(samePeriod({ from: 1, to: 2 }, null)).toBe(false);
  });
});

describe("where a press lands", () => {
  const selection = { left: 300, right: 500 };
  const viewport = { left: 100, right: 250 };
  const half = BRUSH_HANDLE_HIT / 2;

  it("creates a selection anywhere outside the viewport indicator, when there is no band", () => {
    expect(brushTarget({ x: 600, selection: null, viewport })).toBe("create");
    expect(brushTarget({ x: 50, selection: null, viewport })).toBe("create");
    expect(brushTarget({ x: 251, selection: null, viewport })).toBe("create");
  });

  it("scrolls on the viewport indicator, edges included", () => {
    expect(brushTarget({ x: 100, selection: null, viewport })).toBe("viewport");
    expect(brushTarget({ x: 180, selection: null, viewport })).toBe("viewport");
    expect(brushTarget({ x: 250, selection: null, viewport })).toBe("viewport");
  });

  it("creates everywhere when the indicator covers the whole bar", () => {
    expect(brushTarget({ x: 400, selection: null, viewport: null })).toBe("create");
  });

  it("creates over the indicator with Shift held", () => {
    expect(brushTarget({ x: 180, selection: null, viewport, forceCreate: true })).toBe("create");
  });

  it("resizes at a handle: its touch target reaches half its width either side of the edge", () => {
    expect(brushTarget({ x: 300, selection, viewport })).toBe("start");
    expect(brushTarget({ x: 300 - half, selection, viewport })).toBe("start");
    expect(brushTarget({ x: 300 + half, selection, viewport })).toBe("start");
    expect(brushTarget({ x: 500, selection, viewport })).toBe("end");
    expect(brushTarget({ x: 500 - half, selection, viewport })).toBe("end");
    expect(brushTarget({ x: 500 + half, selection, viewport })).toBe("end");
  });

  it("moves on the band between its handles", () => {
    expect(brushTarget({ x: 400, selection, viewport })).toBe("move");
    expect(brushTarget({ x: 300 + half + 1, selection, viewport })).toBe("move");
    expect(brushTarget({ x: 500 - half - 1, selection, viewport })).toBe("move");
  });

  it("outside the band and its handles is a new selection again", () => {
    expect(brushTarget({ x: 300 - half - 1, selection, viewport })).toBe("create");
    expect(brushTarget({ x: 500 + half + 1, selection, viewport })).toBe("create");
  });

  it("lets the band and its handles win over the viewport indicator and Shift", () => {
    const over = { left: 280, right: 520 };
    expect(brushTarget({ x: 400, selection, viewport: over })).toBe("move");
    expect(brushTarget({ x: 300, selection, viewport: over })).toBe("start");
    expect(brushTarget({ x: 400, selection, viewport: over, forceCreate: true })).toBe("move");
  });

  it("gives a thin band two handles that meet in its middle", () => {
    const thin = { left: 400, right: 405 };
    expect(brushTarget({ x: 400, selection: thin, viewport: null })).toBe("start");
    expect(brushTarget({ x: 402, selection: thin, viewport: null })).toBe("start");
    expect(brushTarget({ x: 403, selection: thin, viewport: null })).toBe("end");
    expect(brushTarget({ x: 405, selection: thin, viewport: null })).toBe("end");
    expect(brushTarget({ x: 400 - half, selection: thin, viewport: null })).toBe("start");
    expect(brushTarget({ x: 405 + half, selection: thin, viewport: null })).toBe("end");
    expect(brushTarget({ x: 405 + half + 1, selection: thin, viewport: null })).toBe("create");
  });

  it("finds the viewport indicator in pixels, or none when it covers the bar", () => {
    expect(viewportExtent({ left: 0.25, width: 0.5 }, 800)).toEqual({ left: 200, right: 600 });
    expect(viewportExtent({ left: 0, width: 1 }, 800)).toBeNull();
    expect(viewportExtent({ left: 0, width: 0.996 }, 800)).toBeNull();
  });
});

describe("the live label", () => {
  const years = [1966, 1968, 1971, 1974, 1981, 1991, 1993];

  it("counts the films of the period", () => {
    expect(filmsInPeriod(years, { from: 1966, to: 1981 })).toBe(5);
    expect(filmsInPeriod(years, { from: 1982, to: 1990 })).toBe(0);
    expect(filmsInPeriod([], { from: 1966, to: 1981 })).toBe(0);
  });

  it("names the years and the films, as the card does", () => {
    expect(brushLabel({ from: 1966, to: 1981 }, years)).toBe("1966–1981 · 5 films");
    expect(brushLabel({ from: 1991, to: 1991 }, years)).toBe("1991 · 1 film");
    expect(brushLabel({ from: 1982, to: 1990 }, years)).toBe("1982–1990 · 0 films");
  });
});
