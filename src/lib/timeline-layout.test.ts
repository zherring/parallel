import { describe, expect, it } from "vitest";
import { GROUP_SLOT, pairIndex } from "@/lib/connections";
import { sharedFilms } from "@/lib/shared";
import {
  CARD_GAP,
  CARD_HEIGHT,
  CARD_TOP,
  CARD_WIDTH,
  DEFAULT_MAX_ROWS,
  DEFAULT_ZOOM,
  DOT_HIT_MIN,
  DOT_HIT_SIZE,
  LANE_PAD_BOTTOM,
  LINE_HALO,
  LINE_Y,
  MAX_ZOOM,
  MIN_ZOOM,
  OVERFLOW_ROW,
  ROW_GAP,
  STRIP_PAD,
  TRACK_PAD,
  ZOOM_STEPS,
  axisRange,
  axisTicks,
  buildConnectors,
  cardTopInLane,
  centerYear,
  connectorSegments,
  filmMembership,
  filmsInEveryLane,
  initialAnchorX,
  initialScrollLeft,
  isCrossed,
  labelStep,
  laneHeight,
  laneObstacles,
  layoutMode,
  makeScale,
  nextZoom,
  nodeHitWidths,
  overflowCount,
  packFilms,
  packLane,
  placeNodes,
  rowCount,
  scrollLeftForCenter,
  stackLanes,
  stackStripLanes,
  stripCardTop,
  stripHeight,
  totalHeight,
  trackWidth,
  xForDate,
  yearFraction,
} from "@/lib/timeline-layout";
import type { Credit, Film, PersonTimeline } from "@/lib/types";

const f = (id: number, releaseDate: string, voteCount?: number) => ({
  id,
  releaseDate,
  ...(voteCount === undefined ? {} : { voteCount }),
});
const MIN_DISTANCE = CARD_WIDTH + CARD_GAP;
const base = { pxPerYear: 72, axisStartYear: 1990 };

describe("yearFraction", () => {
  it("is the bare year on January 1st", () => {
    expect(yearFraction("1999-01-01")).toBe(1999);
    expect(yearFraction("2024-01-01")).toBe(2024);
  });

  it("uses the day of the year", () => {
    expect(yearFraction("1999-10-15")).toBeCloseTo(1999 + 287 / 365, 10);
    expect(yearFraction("1999-12-31")).toBeCloseTo(1999 + 364 / 365, 10);
  });

  it("knows leap years", () => {
    expect(yearFraction("2024-12-31")).toBeCloseTo(2024 + 365 / 366, 10);
    expect(yearFraction("2024-03-01")).toBeCloseTo(2024 + 60 / 366, 10);
    expect(yearFraction("1900-12-31")).toBeCloseTo(1900 + 364 / 365, 10);
    expect(yearFraction("2000-12-31")).toBeCloseTo(2000 + 365 / 366, 10);
  });

  it("stays strictly inside its year", () => {
    expect(yearFraction("2020-12-31")).toBeLessThan(2021);
  });

  it("orders dates chronologically", () => {
    const dates = ["1999-10-15", "1999-10-16", "2000-01-01", "1998-12-31"];
    const sorted = [...dates].sort((a, b) => yearFraction(a) - yearFraction(b));
    expect(sorted).toEqual([...dates].sort());
  });

  it("falls back to mid-year or NaN for malformed input", () => {
    expect(yearFraction("1999")).toBe(1999.5);
    expect(yearFraction("1999-xx")).toBe(1999.5);
    expect(yearFraction("")).toBeNaN();
    expect(yearFraction("soon")).toBeNaN();
  });
});

describe("axisRange", () => {
  it("pads one year either side of the extremes", () => {
    expect(axisRange([1999, 2014, 1995], 2026)).toEqual({ startYear: 1994, endYear: 2015 });
  });

  it("handles a single film", () => {
    expect(axisRange([2001], 2026)).toEqual({ startYear: 2000, endYear: 2002 });
  });

  it("brackets the fallback year when there are no films", () => {
    expect(axisRange([], 2026)).toEqual({ startYear: 2025, endYear: 2027 });
    expect(axisRange([Number.NaN], 2026)).toEqual({ startYear: 2025, endYear: 2027 });
  });

  it("reaches far-future releases", () => {
    expect(axisRange([1920, 2031], 2026)).toEqual({ startYear: 1919, endYear: 2032 });
  });
});

describe("scale and x", () => {
  const scale = makeScale({ startYear: 1990, endYear: 2000 }, 100);

  it("puts the axis start at the padding", () => {
    expect(xForDate(scale, "1990-01-01")).toBe(TRACK_PAD);
  });

  it("is linear in time", () => {
    expect(xForDate(scale, "1991-01-01") - xForDate(scale, "1990-01-01")).toBeCloseTo(100, 6);
    expect(xForDate(scale, "1995-01-01")).toBe(TRACK_PAD + 500);
  });

  it("depends only on the date and scale, never on whose film it is", () => {
    const a = packFilms([f(1, "1999-10-15")], { ...base, axisStartYear: 1990 });
    const b = packFilms([f(2, "1999-01-01"), f(1, "1999-10-15"), f(3, "2005-05-05")], { ...base, axisStartYear: 1990 });
    expect(a[0].x).toBe(b.find((p) => p.film.id === 1)?.x);
  });

  it("sizes the track to the axis plus padding on both sides", () => {
    expect(trackWidth(scale)).toBe(Math.round(TRACK_PAD * 2 + 1000));
  });

  it("keeps the last possible date inside the track", () => {
    const x = xForDate(scale, "1999-12-31");
    expect(x).toBeLessThan(trackWidth(scale) - TRACK_PAD);
  });

  it("scales with zoom", () => {
    const zoomed = makeScale({ startYear: 1990, endYear: 2000 }, 200);
    expect(xForDate(zoomed, "1995-01-01") - TRACK_PAD).toBe(1000);
  });
});

describe("axisTicks", () => {
  it("has a tick for every year, inclusive of both ends", () => {
    const ticks = axisTicks(makeScale({ startYear: 1994, endYear: 2015 }, 72));
    expect(ticks).toHaveLength(22);
    expect(ticks[0].year).toBe(1994);
    expect(ticks[ticks.length - 1].year).toBe(2015);
  });

  it("marks decades and always labels them", () => {
    for (const px of [24, 40, 72, 200]) {
      const ticks = axisTicks(makeScale({ startYear: 1994, endYear: 2015 }, px));
      const decades = ticks.filter((t) => t.kind === "decade");
      expect(decades.map((t) => t.year)).toEqual([2000, 2010]);
      expect(decades.every((t) => t.label === String(t.year))).toBe(true);
    }
  });

  it("labels every year when zoomed in, every 5 in the middle, decades only when far out", () => {
    const labelled = (px: number) =>
      axisTicks(makeScale({ startYear: 1994, endYear: 2015 }, px))
        .filter((t) => t.label)
        .map((t) => t.year);
    expect(labelled(72)).toHaveLength(22);
    expect(labelled(40)).toEqual([1995, 2000, 2005, 2010, 2015]);
    expect(labelled(24)).toEqual([2000, 2010]);
  });

  it("positions ticks with the same function as films", () => {
    const scale = makeScale({ startYear: 1994, endYear: 2015 }, 72);
    const tick = axisTicks(scale).find((t) => t.year === 2000);
    expect(tick?.x).toBe(xForDate(scale, "2000-01-01"));
  });

  it("thresholds for labelStep", () => {
    expect(labelStep(56)).toBe(1);
    expect(labelStep(55)).toBe(5);
    expect(labelStep(28)).toBe(5);
    expect(labelStep(27)).toBe(10);
  });
});

describe("packFilms", () => {
  it("returns nothing for no films", () => {
    expect(packFilms([], base)).toEqual([]);
    expect(rowCount([])).toBe(1);
  });

  it("puts well-spaced films all on row 0", () => {
    const packed = packFilms([f(1, "1992-01-01"), f(2, "1995-01-01"), f(3, "2000-01-01")], base);
    expect(packed.map((p) => p.row)).toEqual([0, 0, 0]);
  });

  it("bumps a card that is closer than card width + gap", () => {
    // 72 px/year: films one year apart sit exactly 72 px apart, which is the minimum.
    const exact = packFilms([f(1, "1992-01-01"), f(2, "1993-01-01")], base);
    expect(exact[1].x - exact[0].x).toBeCloseTo(MIN_DISTANCE, 6);
    expect(exact.map((p) => p.row)).toEqual([0, 0]);

    const closer = packFilms([f(1, "1992-01-01"), f(2, "1992-12-30")], base);
    expect(closer.map((p) => p.row)).toEqual([0, 1]);
  });

  it("stacks same-date films in separate rows, ordered by id", () => {
    const packed = packFilms([f(9, "2001-05-05"), f(3, "2001-05-05"), f(5, "2001-05-05")], base);
    expect(packed.map((p) => [p.film.id, p.row])).toEqual([
      [3, 0],
      [5, 1],
      [9, 2],
    ]);
    expect(new Set(packed.map((p) => p.x)).size).toBe(1);
  });

  it("reuses a lower row once a later card is clear of it", () => {
    const packed = packFilms([f(1, "1992-01-01"), f(2, "1992-06-01"), f(3, "1993-04-01")], base);
    expect(packed.map((p) => p.row)).toEqual([0, 1, 0]);
  });

  it("never overlaps two cards in the same row (dense pseudo-random years)", () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const films = Array.from({ length: 300 }, (_, i) => {
      const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
      const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
      return f(i + 1, `${1990 + Math.floor(rand() * 8)}-${month}-${day}`);
    });
    for (const pxPerYear of [24, 72, 200]) {
      const packed = packFilms(films, { pxPerYear, axisStartYear: 1989 });
      expect(packed).toHaveLength(300);
      for (let i = 0; i < packed.length; i++) {
        for (let j = i + 1; j < packed.length; j++) {
          if (packed[i].row === packed[j].row) {
            expect(Math.abs(packed[i].x - packed[j].x)).toBeGreaterThanOrEqual(MIN_DISTANCE - 1e-9);
          }
        }
      }
    }
  });

  it("uses no more rows than the densest cluster needs when packing left to right", () => {
    // Five films inside one card-width of each other need five rows; spreading them out needs one.
    const cluster = Array.from({ length: 5 }, (_, i) => f(i + 1, `2000-01-0${i + 1}`));
    expect(rowCount(packFilms(cluster, base))).toBe(5);
    const spread = Array.from({ length: 5 }, (_, i) => f(i + 1, `${2000 + i * 2}-01-01`));
    expect(rowCount(packFilms(spread, base))).toBe(1);
  });

  it("needs more rows when zoomed out and fewer when zoomed in", () => {
    const films = Array.from({ length: 20 }, (_, i) => f(i + 1, `${2000 + Math.floor(i / 2)}-0${1 + (i % 2) * 5}-01`));
    const rowsAt = (pxPerYear: number) => rowCount(packFilms(films, { pxPerYear, axisStartYear: 1999 }));
    expect(rowsAt(24)).toBeGreaterThan(rowsAt(72));
    expect(rowsAt(72)).toBeGreaterThanOrEqual(rowsAt(200));
    expect(rowsAt(200)).toBe(1);
  });

  it("lets priority films claim row 0 even when they come later in time", () => {
    const films = [f(1, "2000-01-01"), f(2, "2000-02-01"), f(3, "2000-03-01")];
    const plain = packFilms(films, base);
    expect(plain.find((p) => p.film.id === 3)?.row).toBe(2);

    const prioritized = packFilms(films, { ...base, priorityIds: new Set([3]) });
    expect(prioritized.find((p) => p.film.id === 3)?.row).toBe(0);
    // Every other film is still placed without overlap.
    const rows = prioritized.map((p) => p.row);
    expect(new Set(rows).size).toBe(3);
  });

  it("gives shared films the same x in every lane even when rows differ", () => {
    const laneA = packFilms([f(1, "1999-10-15"), f(2, "1999-11-01")], base);
    const laneB = packFilms([f(1, "1999-10-15")], base);
    expect(laneA.find((p) => p.film.id === 1)?.x).toBe(laneB[0].x);
  });

  it("orders output by x then id", () => {
    const packed = packFilms([f(2, "2005-01-01"), f(1, "2005-01-01"), f(3, "1999-01-01")], base);
    expect(packed.map((p) => p.film.id)).toEqual([3, 1, 2]);
  });

  it("handles extreme dates", () => {
    const packed = packFilms([f(1, "1895-12-28"), f(2, "2031-12-31")], { pxPerYear: 200, axisStartYear: 1894 });
    expect(packed[0].x).toBeGreaterThan(0);
    expect(packed[1].x).toBeGreaterThan(packed[0].x);
    expect(packed.map((p) => p.row)).toEqual([0, 0]);
  });

  it("honours custom card width and gap", () => {
    const films = [f(1, "2000-01-01"), f(2, "2000-07-01")];
    // 72 px/year puts these about 36 px apart.
    expect(packFilms(films, { ...base, axisStartYear: 1999, cardWidth: 30, gap: 4 }).map((p) => p.row)).toEqual([0, 0]);
    expect(packFilms(films, { ...base, axisStartYear: 1999, cardWidth: 40, gap: 8 }).map((p) => p.row)).toEqual([0, 1]);
  });
});

describe("packFilms with a row cap", () => {
  const byId = <T extends { film: { id: number } }>(packed: T[]) => new Map(packed.map((p) => [p.film.id, p]));
  // Five films within a few days of each other: each needs its own row when uncapped.
  const cluster = [
    f(1, "2000-01-01", 100),
    f(2, "2000-01-02", 900),
    f(3, "2000-01-03", 500),
    f(4, "2000-01-04", 700),
    f(5, "2000-01-05", 300),
  ];
  const lcg = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  it("exports 2 as the default number of rows", () => {
    expect(DEFAULT_MAX_ROWS).toBe(2);
  });

  it("gives the cards to the most voted films and turns the rest into overflow", () => {
    const packed = byId(packFilms(cluster, { ...base, maxRows: 2 }));

    expect(packed.get(2)).toMatchObject({ row: 0, overflow: false }); // 900 votes
    expect(packed.get(4)).toMatchObject({ row: 1, overflow: false }); // 700 votes
    for (const id of [3, 5, 1]) expect(packed.get(id)).toMatchObject({ row: OVERFLOW_ROW, overflow: true });
  });

  it("breaks vote ties by date", () => {
    const tied = [f(3, "2000-01-03", 10), f(1, "2000-01-01", 10), f(2, "2000-01-02", 10)];
    const packed = byId(packFilms(tied, { ...base, maxRows: 1 }));
    expect(packed.get(1)).toMatchObject({ overflow: false });
    expect(packed.get(2)).toMatchObject({ overflow: true });
    expect(packed.get(3)).toMatchObject({ overflow: true });
  });

  it("treats a missing vote count as 0", () => {
    const films = [f(1, "2000-01-01"), f(2, "2000-01-02", 5)];
    const packed = byId(packFilms(films, { ...base, maxRows: 1 }));
    expect(packed.get(2)).toMatchObject({ overflow: false });
    expect(packed.get(1)).toMatchObject({ overflow: true });
  });

  it("fits films that do not collide into row 0 regardless of the cap", () => {
    const spread = [f(1, "1990-01-01", 1), f(2, "1995-01-01", 2), f(3, "2000-01-01", 3), f(4, "2005-01-01", 4)];
    const packed = packFilms(spread, { ...base, axisStartYear: 1989, maxRows: 1 });
    expect(packed.every((p) => p.row === 0 && !p.overflow)).toBe(true);
  });

  it("only overflows what really does not fit", () => {
    // 1 and 2 collide; 3 is two years away and fits row 0 even though it is the least voted.
    const films = [f(1, "2000-01-01", 50), f(2, "2000-02-01", 40), f(3, "2002-01-01", 1)];
    const packed = packFilms(films, { ...base, axisStartYear: 1999, maxRows: 1 });
    expect(packed.map((p) => [p.film.id, p.overflow])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
  });

  it("never puts two cards closer than a card width in the same row, and never uses more than the cap", () => {
    const rand = lcg(7);
    const films = Array.from({ length: 200 }, (_, i) => {
      const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
      return f(i + 1, `${1990 + Math.floor(rand() * 6)}-${month}-15`, Math.floor(rand() * 1000));
    });
    for (const maxRows of [1, 2, 3]) {
      const packed = packFilms(films, { pxPerYear: 72, axisStartYear: 1989, maxRows });
      const cards = packed.filter((p) => !p.overflow);
      expect(cards.every((p) => p.row >= 0 && p.row < maxRows)).toBe(true);
      expect(rowCount(packed)).toBeLessThanOrEqual(maxRows);
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          if (cards[i].row === cards[j].row) {
            expect(Math.abs(cards[i].x - cards[j].x)).toBeGreaterThanOrEqual(MIN_DISTANCE - 1e-9);
          }
        }
      }
    }
  });

  it("only overflows a film that collides with a card in every allowed row", () => {
    const rand = lcg(99);
    const films = Array.from({ length: 120 }, (_, i) =>
      f(i + 1, `${2000 + Math.floor(rand() * 4)}-0${1 + Math.floor(rand() * 9)}-10`, Math.floor(rand() * 500)),
    );
    const packed = packFilms(films, { pxPerYear: 72, axisStartYear: 1999, maxRows: 2 });
    const cards = packed.filter((p) => !p.overflow);
    expect(overflowCount(packed)).toBeGreaterThan(0);
    for (const dot of packed.filter((p) => p.overflow)) {
      for (const row of [0, 1]) {
        expect(cards.some((c) => c.row === row && Math.abs(c.x - dot.x) < MIN_DISTANCE)).toBe(true);
      }
    }
  });

  it("places priority (shared) films first and exempts them from the cap", () => {
    const films = [f(1, "2000-01-01", 900), f(2, "2000-01-02", 800), f(3, "2000-01-03", 700), f(4, "2000-01-04", 1)];
    const packed = byId(packFilms(films, { ...base, maxRows: 2, priorityIds: new Set([4]) }));

    expect(packed.get(4)).toMatchObject({ row: 0, overflow: false });
    expect(packed.get(1)).toMatchObject({ row: 1, overflow: false });
    expect(packed.get(2)).toMatchObject({ overflow: true });
    expect(packed.get(3)).toMatchObject({ overflow: true });
  });

  it("lets priority films use rows beyond the cap when they need them", () => {
    const shared = [f(1, "2000-01-01", 1), f(2, "2000-01-02", 2), f(3, "2000-01-03", 3), f(4, "2000-01-04", 4)];
    const packed = byId(
      packFilms([...shared, f(9, "2000-01-05", 9999)], {
        ...base,
        maxRows: 2,
        priorityIds: new Set([1, 2, 3, 4]),
      }),
    );

    for (const { id } of shared) expect(packed.get(id)?.overflow).toBe(false);
    expect(Math.max(...shared.map(({ id }) => packed.get(id)!.row))).toBe(3);
    // The shared films filled every row first, so even the most voted film is a dot.
    expect(packed.get(9)).toMatchObject({ overflow: true });
  });

  it("exempts exemptIds from the cap without putting them ahead of priority films", () => {
    const films = [f(1, "2000-01-01", 900), f(2, "2000-01-02", 800), f(3, "2000-01-03", 1), f(4, "2000-01-04", 2)];
    const packed = byId(
      packFilms(films, { ...base, maxRows: 2, priorityIds: new Set([4]), exemptIds: new Set([3]) }),
    );

    expect(packed.get(4)).toMatchObject({ row: 0 });
    expect(packed.get(3)).toMatchObject({ row: 1, overflow: false }); // exempt, so ahead of the 900-vote film
    expect(packed.get(1)).toMatchObject({ overflow: true });
    expect(packed.get(2)).toMatchObject({ overflow: true });
  });

  it("keeps every film's x, with or without the cap", () => {
    const uncapped = packFilms(cluster, base);
    const capped = packFilms(cluster, { ...base, maxRows: 1 });
    expect(capped.map((p) => [p.film.id, p.x])).toEqual(uncapped.map((p) => [p.film.id, p.x]));
  });

  it("returns everything in x order, dots included", () => {
    const packed = packFilms(cluster, { ...base, maxRows: 2 });
    expect(packed.map((p) => p.film.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("is the old behavior without a cap: nothing overflows", () => {
    const packed = packFilms(cluster, base);
    expect(packed.some((p) => p.overflow)).toBe(false);
    expect(packed.map((p) => p.row)).toEqual([0, 1, 2, 3, 4]);
  });

  it("treats a cap below 1 as 1", () => {
    const packed = packFilms(cluster, { ...base, maxRows: 0 });
    expect(rowCount(packed)).toBe(1);
    expect(overflowCount(packed)).toBe(4);
  });

  it("counts overflow and ignores it for the row count", () => {
    const packed = packFilms(cluster, { ...base, maxRows: 2 });
    expect(overflowCount(packed)).toBe(3);
    expect(rowCount(packed)).toBe(2);
    expect(rowCount(packFilms(cluster, { ...base, maxRows: 1 }))).toBe(1);
    expect(overflowCount(packFilms(cluster, base))).toBe(0);
  });
});

describe("nodeHitWidths", () => {
  const node = (id: number, x: number) => ({ film: { id }, x });

  it("gives an isolated node the full hit area", () => {
    expect(nodeHitWidths([node(1, 100)]).get(1)).toBe(DOT_HIT_SIZE);
    expect(nodeHitWidths([node(1, 100), node(2, 400)]).get(1)).toBe(DOT_HIT_SIZE);
  });

  it("narrows to the distance to the nearest neighbouring node", () => {
    const widths = nodeHitWidths([node(1, 100), node(2, 110), node(3, 300)]);
    expect(widths.get(1)).toBe(10);
    expect(widths.get(2)).toBe(10);
    expect(widths.get(3)).toBe(DOT_HIT_SIZE);
  });

  it("never goes below the minimum, even for identical x", () => {
    const widths = nodeHitWidths([node(1, 100), node(2, 100)]);
    expect(widths.get(1)).toBe(DOT_HIT_MIN);
    expect(widths.get(2)).toBe(DOT_HIT_MIN);
  });

  it("keeps neighbouring hit areas from overlapping whenever the gap allows", () => {
    const xs = [0, 12, 20, 60, 61, 90];
    const widths = nodeHitWidths(xs.map((x, i) => node(i, x)));
    for (let i = 0; i < xs.length - 1; i++) {
      const gap = xs[i + 1] - xs[i];
      if (gap >= DOT_HIT_MIN) expect(widths.get(i)! / 2 + widths.get(i + 1)! / 2).toBeLessThanOrEqual(gap + 1e-9);
    }
  });

  it("sizes every film of a lane, whether it has a card or not", () => {
    const lane = packFilms([f(1, "2000-01-01", 9), f(2, "2000-01-02", 1), f(3, "2005-01-01", 5)], { ...base, maxRows: 1 });
    expect([...nodeHitWidths(lane).keys()]).toEqual([1, 2, 3]);
  });
});

describe("packFilms with soft obstacles", () => {
  // Two films collide; the cap lets only one keep a card.
  const pair = [f(1, "2000-01-01", 900), f(2, "2000-02-01", 100)];
  const at1 = packFilms(pair, { ...base, axisStartYear: 1999 })[0].x;

  it("changes nothing without obstacles", () => {
    const packed = packFilms(pair, { ...base, axisStartYear: 1999, maxRows: 1 });
    expect(packed.map((p) => p.overflow)).toEqual([false, true]);
  });

  it("lets the card of a film under another film's line give way to one the line misses, when the rows are contested", () => {
    // A line just inside film 1's left edge (film 2's card, 6px to the right, is clear of it).
    const clear = packFilms(pair, {
      ...base,
      axisStartYear: 1999,
      maxRows: 1,
      obstacles: [{ filmId: 99, x: at1 - CARD_WIDTH / 2 + 1 }],
    });
    // Film 1 is the voted one, but it is crossed and film 2 is not, so film 2 takes the card.
    expect(clear.map((p) => p.overflow)).toEqual([true, false]);
  });

  it("falls back to the vote order when every card in the contest is crossed", () => {
    const packed = packFilms(pair, { ...base, axisStartYear: 1999, maxRows: 1, obstacles: [{ filmId: 99, x: at1 + 3 }] });
    expect(packed.map((p) => p.overflow)).toEqual([false, true]);
  });

  it("keeps a crossed card when a row is still free: the rule is soft", () => {
    const packed = packFilms(pair, {
      ...base,
      axisStartYear: 1999,
      maxRows: 2,
      obstacles: [{ filmId: 99, x: at1 - CARD_WIDTH / 2 + 1 }],
    });
    expect(packed.every((p) => !p.overflow)).toBe(true);
  });

  it("never counts a film's own line against it", () => {
    const packed = packFilms(pair, { ...base, axisStartYear: 1999, maxRows: 1, obstacles: [{ filmId: 1, x: at1 }] });
    expect(packed.map((p) => p.overflow)).toEqual([false, true]);
  });

  it("does not touch films that are exempt from the cap", () => {
    const packed = packFilms(pair, {
      ...base,
      axisStartYear: 1999,
      maxRows: 1,
      exemptIds: new Set([1]),
      obstacles: [{ filmId: 99, x: at1 }],
    });
    expect(packed[0]).toMatchObject({ overflow: false, row: 0 });
  });

  it("only affects who wins a slot, never how many cards there are", () => {
    const films = Array.from({ length: 30 }, (_, i) => f(i + 1, `${2000 + Math.floor(i / 3)}-0${1 + (i % 3)}-15`, 100 - i));
    const plain = packFilms(films, { ...base, axisStartYear: 1999, maxRows: 2 });
    const soft = packFilms(films, {
      ...base,
      axisStartYear: 1999,
      maxRows: 2,
      obstacles: [{ filmId: 999, x: plain[10].x }, { filmId: 998, x: plain[20].x }],
    });
    const cards = (packed: typeof plain) => packed.filter((p) => !p.overflow);
    expect(Math.abs(cards(soft).length - cards(plain).length)).toBeLessThanOrEqual(1);
    for (const p of cards(soft)) expect(p.row).toBeLessThan(2);
  });
});

describe("isCrossed", () => {
  it("is true when another film's line is within half a card width of the card's centre", () => {
    expect(isCrossed(1, 100, [{ filmId: 2, x: 100 + CARD_WIDTH / 2 - 1 }])).toBe(true);
    expect(isCrossed(1, 100, [{ filmId: 2, x: 100 - CARD_WIDTH / 2 + 1 }])).toBe(true);
    expect(isCrossed(1, 100, [{ filmId: 2, x: 100 + CARD_WIDTH / 2 + LINE_HALO }])).toBe(false);
  });

  it("ignores the card's own film and no lines", () => {
    expect(isCrossed(1, 100, [{ filmId: 1, x: 100 }])).toBe(false);
    expect(isCrossed(1, 100, [])).toBe(false);
  });
});

describe("laneObstacles", () => {
  const lanes = [
    { films: [f(1, "2000-01-01"), f(2, "2002-01-01"), f(5, "2004-01-01")] },
    { films: [f(1, "2000-01-01"), f(3, "2003-01-01"), f(5, "2004-01-01")] },
    { films: [f(5, "2004-01-01"), f(3, "2003-01-01"), f(4, "2006-01-01")] },
  ];
  const obstacles = laneObstacles(lanes, base);

  it("lists, per lane, the lines of films shown in several lanes that run through it", () => {
    expect(obstacles[0].map((o) => o.filmId)).toEqual([1, 5]); // both start in lane 0 and go on
    expect(obstacles[1].map((o) => o.filmId)).toEqual([3, 5]); // 1 ended here; 3 and 5 go on to lane 2
  });

  it("never has a line through the last lane that shows the film, so the last lane is never crossed", () => {
    expect(obstacles[2]).toEqual([]);
  });

  it("puts each line at its film's x, in x order", () => {
    const scale = makeScale({ startYear: 1990, endYear: 2010 }, 72);
    expect(obstacles[0]).toEqual([
      { filmId: 1, x: xForDate(scale, "2000-01-01") },
      { filmId: 5, x: xForDate(scale, "2004-01-01") },
    ]);
  });

  it("covers a lane a film skips (shown in lanes 0 and 2 only)", () => {
    const skipped = laneObstacles([{ films: [f(1, "2000-01-01")] }, { films: [] }, { films: [f(1, "2000-01-01")] }], base);
    expect(skipped[1].map((o) => o.filmId)).toEqual([1]);
  });

  it("is empty for a single lane", () => {
    expect(laneObstacles([{ films: [f(1, "2000-01-01")] }], base)).toEqual([[]]);
  });
});

describe("packLane", () => {
  const films = [f(1, "1995-01-01", 5), f(2, "1999-01-01", 9), f(3, "2004-01-01", 7)];

  it("packs everything when no film is shared", () => {
    expect(packLane(films, new Set(), base)).toEqual(packFilms(films, base));
  });

  it("leaves the shared films as nodes without a card, and packs the rest", () => {
    const lane = packLane(films, new Set([2]), { ...base, maxRows: 2 });
    expect(lane.map((p) => p.film.id)).toEqual([1, 2, 3]);
    expect(lane.find((p) => p.film.id === 2)).toMatchObject({ row: OVERFLOW_ROW, overflow: true });
    expect(lane.filter((p) => p.film.id !== 2).every((p) => !p.overflow)).toBe(true);
  });

  it("keeps the x of a shared film identical to the x of its poster in the strip", () => {
    const lane = packLane(films, new Set([2]), base);
    const strip = packFilms([films[1]], base);
    expect(lane.find((p) => p.film.id === 2)!.x).toBe(strip[0].x);
  });

  it("does not count shared nodes as lost cards", () => {
    const shared = new Set([2]);
    const lane = packLane(films, shared, { ...base, maxRows: 2 });
    expect(overflowCount(lane)).toBe(1);
    expect(overflowCount(lane, shared)).toBe(0);
  });

  it("is only as tall as the unshared posters need", () => {
    const dense = [f(1, "2000-01-01", 1), f(2, "2000-01-02", 1), f(3, "2000-01-03", 1)];
    expect(rowCount(packLane(dense, new Set([1, 2, 3]), base))).toBe(1);
    expect(rowCount(packLane(dense, new Set([1]), base))).toBe(2);
  });
});

describe("lane geometry", () => {
  it("grows with rows", () => {
    expect(laneHeight(1)).toBe(CARD_TOP + CARD_HEIGHT + LANE_PAD_BOTTOM);
    expect(laneHeight(3)).toBe(CARD_TOP + 3 * CARD_HEIGHT + 2 * ROW_GAP + LANE_PAD_BOTTOM);
    expect(laneHeight(0)).toBe(laneHeight(1));
  });

  it("offsets rows by card height plus gap", () => {
    expect(cardTopInLane(0)).toBe(CARD_TOP);
    expect(cardTopInLane(2)).toBe(CARD_TOP + 2 * (CARD_HEIGHT + ROW_GAP));
  });

  it("keeps the last row inside its lane", () => {
    for (const rows of [1, 2, 5]) {
      expect(cardTopInLane(rows - 1) + CARD_HEIGHT + LANE_PAD_BOTTOM).toBe(laneHeight(rows));
    }
  });

  it("derives a capped lane's height from the rows actually used", () => {
    const dense = Array.from({ length: 12 }, (_, i) => f(i + 1, `2000-01-${String(i + 1).padStart(2, "0")}`, i));
    const capped = packFilms(dense, { ...base, maxRows: DEFAULT_MAX_ROWS });
    expect(laneHeight(rowCount(capped))).toBe(laneHeight(2));
    // The uncapped lane needs 12 rows; expanding it is what grows the lane.
    expect(laneHeight(rowCount(packFilms(dense, base)))).toBe(laneHeight(12));

    const sparse = packFilms([f(1, "1990-01-01", 1), f(2, "2000-01-01", 1)], { ...base, maxRows: DEFAULT_MAX_ROWS });
    expect(laneHeight(rowCount(sparse))).toBe(laneHeight(1));
  });

  it("counts a priority film in a row beyond the cap towards the height", () => {
    const films = Array.from({ length: 4 }, (_, i) => f(i + 1, `2000-01-0${i + 1}`, 1));
    const packed = packFilms(films, { ...base, maxRows: 2, priorityIds: new Set([1, 2, 3, 4]) });
    expect(rowCount(packed)).toBe(4);
  });

  it("stacks lanes with cumulative tops", () => {
    const boxes = stackLanes([1, 3, 2]);
    expect(boxes[0].top).toBe(0);
    expect(boxes[1].top).toBe(laneHeight(1));
    expect(boxes[2].top).toBe(laneHeight(1) + laneHeight(3));
    expect(totalHeight(boxes)).toBe(laneHeight(1) + laneHeight(3) + laneHeight(2));
    expect(totalHeight([])).toBe(0);
  });
});

describe("placeNodes", () => {
  it("places every film at its date's x, ordered by x then id, all as nodes", () => {
    const nodes = placeNodes([f(3, "2000-01-01"), f(1, "1995-01-01"), f(2, "1995-01-01")], base);
    expect(nodes.map((n) => n.film.id)).toEqual([1, 2, 3]);
    expect(nodes.every((n) => n.overflow && n.row === OVERFLOW_ROW)).toBe(true);
    expect(nodes[2].x).toBe(xForDate(makeScale({ startYear: 1990, endYear: 2010 }, 72), "2000-01-01"));
  });

  it("uses the same x as packFilms, so a poster and a node of one film line up", () => {
    const films = [f(1, "1999-10-15"), f(2, "2001-03-04")];
    const nodes = placeNodes(films, base);
    const packed = packFilms(films, base);
    expect(nodes.map((n) => n.x)).toEqual(packed.map((p) => p.x));
  });

  it("takes no card rows: a lane of nodes is as tall as a one-row lane", () => {
    expect(rowCount(placeNodes([f(1, "2000-01-01"), f(2, "2000-01-02")], base))).toBe(1);
    expect(overflowCount(placeNodes([f(1, "2000-01-01"), f(2, "2000-01-02")], base))).toBe(2);
  });
});

describe("layoutMode and filmsInEveryLane", () => {
  const lane = (...ids: number[]) => ({ films: ids.map((id) => ({ id })) });

  it("is strip with 2+ lanes and a film every lane shows", () => {
    expect(layoutMode([lane(1, 2), lane(2, 3)], new Set([2]))).toBe("strip");
    expect(filmsInEveryLane([lane(1, 2), lane(2, 3)], new Set([2]))).toEqual([2]);
  });

  it("is plain for a single lane, even when the film is in the shared set", () => {
    expect(layoutMode([lane(1, 2)], new Set([1, 2]))).toBe("plain");
    expect(filmsInEveryLane([lane(1, 2)], new Set([1, 2]))).toEqual([]);
  });

  it("is plain when nothing is shared by all lanes", () => {
    expect(layoutMode([lane(1), lane(2)], new Set())).toBe("plain");
    expect(layoutMode([lane(1, 2), lane(2, 3), lane(1, 3)], new Set())).toBe("plain");
  });

  it("only counts shared films that every lane actually shows (the minor toggle can hide one)", () => {
    expect(layoutMode([lane(1, 2), lane(2), lane(3)], new Set([2]))).toBe("plain");
    expect(filmsInEveryLane([lane(5, 2, 9), lane(9, 2), lane(2, 9)], new Set([2, 9, 5]))).toEqual([2, 9]);
  });

  it("is plain with no lanes at all", () => {
    expect(layoutMode([], new Set([1]))).toBe("plain");
  });
});

describe("strip layout geometry", () => {
  it("sizes each lane by its poster rows, with the strip under the first one", () => {
    const stack = stackStripLanes([1, 2], 1);
    expect(stack.lanes[0]).toEqual({ top: 0, height: laneHeight(1) });
    expect(stack.strip).toEqual({ top: laneHeight(1), height: stripHeight(1) });
    expect(stack.lanes[1]).toEqual({ top: laneHeight(1) + stripHeight(1), height: laneHeight(2) });
    expect(totalHeight(stack.lanes)).toBe(laneHeight(1) + stripHeight(1) + laneHeight(2));
  });

  it("puts the strip only in the first gap; further lanes follow directly", () => {
    const stack = stackStripLanes([2, 1, 1, 3], 2);
    expect(stack.lanes.map((l) => l.top)).toEqual([
      0,
      laneHeight(2) + stripHeight(2),
      laneHeight(2) + stripHeight(2) + laneHeight(1),
      laneHeight(2) + stripHeight(2) + laneHeight(1) * 2,
    ]);
    expect(stack.lanes.map((l) => l.height)).toEqual([laneHeight(2), laneHeight(1), laneHeight(1), laneHeight(3)]);
  });

  it("is the plain stack plus the strip", () => {
    const rows = [2, 1, 2];
    const stack = stackStripLanes(rows, 3);
    expect(totalHeight(stack.lanes)).toBe(totalHeight(stackLanes(rows)) + stripHeight(3));
  });

  it("returns the lane heights the poster view needs: about 188px for one row, 338px for two", () => {
    expect(laneHeight(1)).toBe(188);
    expect(laneHeight(2)).toBe(338);
  });

  it("grows the strip by one card row per packed row", () => {
    expect(stripHeight(1)).toBe(STRIP_PAD * 2 + CARD_HEIGHT);
    expect(stripHeight(3)).toBe(STRIP_PAD * 2 + 3 * CARD_HEIGHT + 2 * ROW_GAP);
    expect(stripHeight(0)).toBe(stripHeight(1));
  });

  it("keeps the last strip row inside the strip", () => {
    for (const rows of [1, 2, 4]) expect(stripCardTop(rows - 1) + CARD_HEIGHT + STRIP_PAD).toBe(stripHeight(rows));
  });

  it("packs strip posters into extra rows when they collide, with no cap", () => {
    const films = Array.from({ length: 5 }, (_, i) => f(i + 1, `2000-01-0${i + 1}`));
    const posters = packFilms(films, base);
    expect(rowCount(posters)).toBe(5);
    expect(posters.every((p) => !p.overflow)).toBe(true);
    // Well-spaced shared films share row 0.
    expect(rowCount(packFilms([f(1, "1992-01-01"), f(2, "1995-01-01")], base))).toBe(1);
  });
});

describe("buildConnectors", () => {
  /** A lane's films: those with a `row` have a poster card there, the others are only nodes. */
  const makeLane = (box: { top: number; height: number }, items: { id: number; x: number; row?: number }[]) => ({
    box,
    items: items.map(({ id, x, row }) => ({
      film: { id },
      x,
      row: row ?? OVERFLOW_ROW,
      overflow: row === undefined,
    })),
  });

  describe("with the shared strip", () => {
    it("runs one continuous line from the first lane's node to the last lane's node", () => {
      const stack = stackStripLanes([1, 1], 1);
      const lanes = stack.lanes.map((box) => makeLane(box, [{ id: 1, x: 300 }]));
      const connectors = buildConnectors(lanes, { box: stack.strip, rows: new Map([[1, 0]]) });
      expect(connectors).toHaveLength(1);
      const top = stack.strip.top + stripCardTop(0);
      expect(connectors[0]).toEqual({
        filmId: 1,
        x: 300,
        y1: LINE_Y,
        y2: stack.lanes[1].top + LINE_Y,
        fromLane: 0,
        toLane: 1,
        lanes: [0, 1],
        kind: "all",
        slot: null,
        gaps: [{ y1: top, y2: top + CARD_HEIGHT }],
      });
    });

    it("keeps the line unbroken apart from the film's own poster in the strip", () => {
      const stack = stackStripLanes([2, 1], 1);
      const lanes = stack.lanes.map((box) => makeLane(box, [{ id: 1, x: 300 }]));
      const [c] = buildConnectors(lanes, { box: stack.strip, rows: new Map([[1, 0]]) });
      const segments = connectorSegments(c);
      expect(segments).toHaveLength(2);
      // It runs the whole height of the first lane's two poster rows, enters the strip poster from above and leaves it below.
      expect(segments[0].y1).toBe(c.y1);
      expect(segments[0].y2).toBe(stack.strip.top + STRIP_PAD);
      expect(segments[1].y1).toBe(stack.strip.top + STRIP_PAD + CARD_HEIGHT);
      expect(segments[1].y2).toBe(c.y2);
      expect(segments[0].y2).toBe(c.gaps[0].y1);
      expect(segments[1].y1).toBe(c.gaps[0].y2);
    });

    it("continues through the lanes below the strip with 3 lanes", () => {
      const stack = stackStripLanes([1, 2, 1], 1);
      const lanes = stack.lanes.map((box) => makeLane(box, [{ id: 1, x: 80 }]));
      const [c] = buildConnectors(lanes, { box: stack.strip, rows: new Map([[1, 0]]) });
      expect(c).toMatchObject({ fromLane: 0, toLane: 2, lanes: [0, 1, 2], kind: "all", slot: null });
      expect(c.y1).toBe(LINE_Y);
      expect(c.y2).toBe(stack.lanes[2].top + LINE_Y);
      const segments = connectorSegments(c);
      expect(segments).toHaveLength(2);
      expect(segments[1].y2).toBe(c.y2);
    });

    it("ends every line on a node, whichever strip row the poster is in", () => {
      const stack = stackStripLanes([1, 1], 3);
      const lanes = stack.lanes.map((box) => makeLane(box, [{ id: 1, x: 5 }, { id: 2, x: 9 }]));
      const connectors = buildConnectors(lanes, { box: stack.strip, rows: new Map([[1, 2], [2, 0]]) });
      for (const c of connectors) {
        expect(c.y1).toBe(lanes[0].box.top + LINE_Y);
        expect(c.y2).toBe(lanes[1].box.top + LINE_Y);
        const segments = connectorSegments(c);
        expect(segments[0].y1).toBe(c.y1);
        expect(segments[segments.length - 1].y2).toBe(c.y2);
      }
      const [one] = connectors.filter((c) => c.filmId === 1);
      expect(one.gaps[0].y1).toBe(stack.strip.top + stripCardTop(2));
    });

    it("does not skip the unshared posters it runs over: only the film's own poster is skipped", () => {
      const stack = stackStripLanes([1, 1], 1);
      const lanes = [
        // Film 9 is a poster of the first lane right under the shared film's line.
        makeLane(stack.lanes[0], [{ id: 1, x: 300 }, { id: 9, x: 310, row: 0 }]),
        makeLane(stack.lanes[1], [{ id: 1, x: 300 }]),
      ];
      const [c] = buildConnectors(lanes, { box: stack.strip, rows: new Map([[1, 0]]) });
      expect(c.gaps).toHaveLength(1);
      expect(c.gaps[0].y1).toBe(stack.strip.top + STRIP_PAD);
    });

    it("colours a partial share by its pair and skips its own card in every lane above the last", () => {
      const stack = stackStripLanes([1, 1, 1], 1);
      const lanes = [
        makeLane(stack.lanes[0], [{ id: 1, x: 40 }, { id: 7, x: 90, row: 0 }]),
        makeLane(stack.lanes[1], [{ id: 7, x: 90, row: 0 }, { id: 8, x: 200 }]),
        makeLane(stack.lanes[2], [{ id: 1, x: 40 }, { id: 8, x: 200, row: 0 }]),
      ];
      // Film 1 is in lanes 0 and 2, film 7 in lanes 0 and 1, film 8 in lanes 1 and 2; none is in all three.
      const connectors = buildConnectors(lanes, { box: stack.strip, rows: new Map() });
      const byFilm = new Map(connectors.map((c) => [c.filmId, c]));

      expect(byFilm.get(1)).toMatchObject({ kind: "some", fromLane: 0, toLane: 2, lanes: [0, 2], slot: pairIndex(0, 2), gaps: [] });
      expect(byFilm.get(7)).toMatchObject({ kind: "some", fromLane: 0, toLane: 1, slot: pairIndex(0, 1) });
      expect(byFilm.get(8)).toMatchObject({ kind: "some", fromLane: 1, toLane: 2, slot: pairIndex(1, 2) });
      expect(new Set(connectors.map((c) => c.slot)).size).toBe(3);

      // 7 has a card in lane 0 (it hangs below the node, in the line's way) and its end node in lane 1 is the last.
      expect(byFilm.get(7)!.gaps).toEqual([{ y1: cardTopInLane(0), y2: cardTopInLane(0) + CARD_HEIGHT }]);
      // 8 has no card in lane 1: nothing to skip there, and the card in lane 2 is at the line's end.
      expect(byFilm.get(8)!.gaps).toEqual([]);
      expect(byFilm.get(1)!.y1).toBe(LINE_Y);
      expect(byFilm.get(1)!.y2).toBe(stack.lanes[2].top + LINE_Y);
    });

    it("draws a film of every lane green and one of fewer lanes in a pair colour, with 4 lanes too", () => {
      const stack = stackStripLanes([1, 1, 1, 1], 1);
      const lanes = stack.lanes.map((box, i) =>
        makeLane(box, [{ id: 1, x: 10 }, ...(i >= 2 ? [{ id: 2, x: 50 }] : []), ...(i >= 1 ? [{ id: 3, x: 90 }] : [])]),
      );
      const connectors = buildConnectors(lanes, { box: stack.strip, rows: new Map([[1, 0]]) });
      expect(connectors.find((c) => c.filmId === 1)).toMatchObject({ kind: "all", slot: null });
      expect(connectors.find((c) => c.filmId === 2)).toMatchObject({ kind: "some", lanes: [2, 3], slot: pairIndex(2, 3) });
      // Three of the four lanes share the group slot.
      expect(connectors.find((c) => c.filmId === 3)).toMatchObject({ kind: "some", lanes: [1, 2, 3], slot: GROUP_SLOT });
    });
  });

  describe("without a strip", () => {
    it("joins the nodes on the lane lines and skips the upper lane's own card", () => {
      const boxes = stackLanes([1, 1]);
      const lanes = [makeLane(boxes[0], [{ id: 1, x: 300, row: 0 }]), makeLane(boxes[1], [{ id: 1, x: 300, row: 0 }])];
      const [c] = buildConnectors(lanes);
      expect(c.y1).toBe(LINE_Y);
      expect(c.y2).toBe(boxes[1].top + LINE_Y);
      expect(c.gaps).toEqual([{ y1: CARD_TOP, y2: CARD_TOP + CARD_HEIGHT }]);
      expect(connectorSegments(c)).toEqual([
        { y1: LINE_Y, y2: CARD_TOP },
        { y1: CARD_TOP + CARD_HEIGHT, y2: boxes[1].top + LINE_Y },
      ]);
    });

    it("accounts for sub-rows in the upper lane", () => {
      const boxes = stackLanes([3, 2]);
      const lanes = [makeLane(boxes[0], [{ id: 1, x: 100, row: 2 }]), makeLane(boxes[1], [{ id: 1, x: 100, row: 1 }])];
      const [c] = buildConnectors(lanes);
      expect(c.gaps).toEqual([{ y1: cardTopInLane(2), y2: cardTopInLane(2) + CARD_HEIGHT }]);
      expect(c.y2).toBe(boxes[1].top + LINE_Y);
    });

    it("counts nodes without a card as lane members and has nothing to skip for them", () => {
      const boxes = stackLanes([2, 1]);
      const lanes = [makeLane(boxes[0], [{ id: 1, x: 100 }]), makeLane(boxes[1], [{ id: 1, x: 100, row: 0 }])];
      expect(filmMembership(lanes).get(1)).toEqual([0, 1]);
      const [c] = buildConnectors(lanes);
      expect(c.gaps).toEqual([]);
      expect(connectorSegments(c)).toEqual([{ y1: LINE_Y, y2: boxes[1].top + LINE_Y }]);
    });

    it("connects shared films in a capped layout, even in a row beyond the cap", () => {
      const upper = packFilms(
        [f(1, "2000-01-01", 1), f(2, "2000-01-02", 2), f(3, "2000-01-03", 3), f(7, "2000-01-04", 1)],
        { ...base, maxRows: 2, priorityIds: new Set([7]) },
      );
      const lower = packFilms([f(7, "2000-01-04", 1)], { ...base, maxRows: 2, priorityIds: new Set([7]) });
      const boxes = stackLanes([rowCount(upper), rowCount(lower)]);
      const lanes = [
        { box: boxes[0], items: upper },
        { box: boxes[1], items: lower },
      ];

      const connectors = buildConnectors(lanes);
      expect(connectors).toHaveLength(1);
      expect(connectors[0]).toMatchObject({ filmId: 7, kind: "all", x: upper.find((p) => p.film.id === 7)!.x });
      expect(connectors[0].y2).toBe(boxes[1].top + LINE_Y);
      expect(connectors[0].y2).toBeGreaterThan(connectors[0].y1);
      expect(boxes[0].height).toBe(laneHeight(rowCount(upper)));
    });
  });

  it("ignores films that appear in one lane only", () => {
    const lanes = [makeLane({ top: 0, height: 200 }, [{ id: 1, x: 10 }]), makeLane({ top: 200, height: 200 }, [{ id: 2, x: 10 }])];
    expect(buildConnectors(lanes)).toEqual([]);
    expect(buildConnectors([makeLane({ top: 0, height: 200 }, [{ id: 1, x: 10 }])])).toEqual([]);
    expect(buildConnectors([])).toEqual([]);
  });

  it("agrees with sharedFilms about which films are shared by every lane", () => {
    const credit: Credit = { role: "director", job: "Director", minor: false };
    const film = (id: number, releaseDate: string): Film => ({
      id,
      title: `Film ${id}`,
      releaseDate,
      year: Number(releaseDate.slice(0, 4)),
      posterPath: null,
      voteCount: 0,
      credits: [credit],
      minor: false,
    });
    const person = (id: number, films: Film[]): PersonTimeline => ({
      person: { id, name: `P${id}`, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
      films,
    });
    const timelines = [
      person(1, [film(10, "1995-01-01"), film(20, "1999-01-01"), film(30, "2004-01-01")]),
      person(2, [film(20, "1999-01-01"), film(30, "2004-01-01"), film(40, "2010-01-01")]),
      person(3, [film(20, "1999-01-01"), film(40, "2010-01-01")]),
    ];
    const stack = stackStripLanes([1, 1, 1], 1);
    const lanes = timelines.map((t, i) => ({ box: stack.lanes[i], items: placeNodes(t.films, base) }));

    const all = new Set(buildConnectors(lanes).filter((c) => c.kind === "all").map((c) => c.filmId));
    expect(all).toEqual(new Set(sharedFilms(timelines, { includeMinor: false }).map((s) => s.id)));
    expect(filmMembership(lanes).get(30)).toEqual([0, 1]);
    expect(filmsInEveryLane(timelines.map((t) => ({ films: t.films })), new Set([20, 30, 40]))).toEqual([20]);
  });

  it("is deterministic and ordered by x then film", () => {
    const lanes = [
      makeLane({ top: 0, height: 200 }, [{ id: 1, x: 5 }, { id: 2, x: 9 }]),
      makeLane({ top: 300, height: 200 }, [{ id: 2, x: 9 }, { id: 1, x: 5 }]),
    ];
    expect(buildConnectors(lanes)).toEqual(buildConnectors(lanes));
    expect(buildConnectors(lanes).map((c) => c.filmId)).toEqual([1, 2]);
  });

  it("puts a film's node at the same x in every lane, so the line stands exactly vertical", () => {
    const films = [f(1, "1995-03-04"), f(2, "2001-07-19")];
    const lanes = [packLane([...films, f(5, "1998-01-01", 3)], new Set([1, 2]), base), packLane(films, new Set([1, 2]), base)];
    for (const film of films) {
      const xs = lanes.map((items) => items.find((p) => p.film.id === film.id)!.x);
      expect(new Set(xs).size).toBe(1);
    }
  });
});

describe("connectorSegments", () => {
  it("is the whole line without gaps", () => {
    expect(connectorSegments({ y1: 10, y2: 100, gaps: [] })).toEqual([{ y1: 10, y2: 100 }]);
  });

  it("leaves out each gap, in order", () => {
    expect(
      connectorSegments({ y1: 0, y2: 100, gaps: [{ y1: 60, y2: 80 }, { y1: 20, y2: 30 }] }),
    ).toEqual([
      { y1: 0, y2: 20 },
      { y1: 30, y2: 60 },
      { y1: 80, y2: 100 },
    ]);
  });

  it("never draws a zero-length piece", () => {
    expect(connectorSegments({ y1: 0, y2: 100, gaps: [{ y1: 0, y2: 40 }] })).toEqual([{ y1: 40, y2: 100 }]);
    expect(connectorSegments({ y1: 0, y2: 100, gaps: [{ y1: 60, y2: 100 }] })).toEqual([{ y1: 0, y2: 60 }]);
  });
});

describe("zoom", () => {
  it("steps through the table within 24..200", () => {
    expect(MIN_ZOOM).toBe(24);
    expect(MAX_ZOOM).toBe(200);
    expect(ZOOM_STEPS).toContain(DEFAULT_ZOOM);
    expect(nextZoom(72, "in")).toBe(96);
    expect(nextZoom(72, "out")).toBe(56);
  });

  it("clamps at both ends", () => {
    expect(nextZoom(MAX_ZOOM, "in")).toBe(MAX_ZOOM);
    expect(nextZoom(MIN_ZOOM, "out")).toBe(MIN_ZOOM);
  });

  it("handles off-table values", () => {
    expect(nextZoom(80, "in")).toBe(96);
    expect(nextZoom(80, "out")).toBe(72);
    expect(nextZoom(5, "in")).toBe(24);
    expect(nextZoom(999, "out")).toBe(200);
  });

  it("reaches every step in order", () => {
    let z: number = MIN_ZOOM;
    const seen = [z];
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      z = nextZoom(z, "in");
      seen.push(z);
    }
    expect([...new Set(seen)]).toEqual([...ZOOM_STEPS]);
  });

  it("keeps the centre year fixed across a zoom", () => {
    const range = { startYear: 1960, endYear: 2030 };
    const viewport = 900;
    for (const [from, to] of [
      [72, 96],
      [72, 24],
      [24, 200],
      [200, 56],
    ]) {
      const before = makeScale(range, from);
      const scrollLeft = 1234;
      const year = centerYear(scrollLeft, viewport, before);
      const after = makeScale(range, to);
      const nextScroll = scrollLeftForCenter(year, viewport, after);
      expect(centerYear(nextScroll, viewport, after)).toBeCloseTo(year, 9);
    }
  });

  it("keeps the centre year fixed when the axis start moves too (minor toggle)", () => {
    const viewport = 800;
    const before = makeScale({ startYear: 1990, endYear: 2020 }, 72);
    const after = makeScale({ startYear: 1982, endYear: 2020 }, 72);
    const year = centerYear(500, viewport, before);
    const nextScroll = scrollLeftForCenter(year, viewport, after);
    expect(nextScroll - 500).toBeCloseTo(8 * 72, 6);
  });
});

describe("initialScrollLeft", () => {
  it("starts at the beginning without shared films", () => {
    expect(initialScrollLeft(null, 900)).toBe(0);
  });

  it("brings the first shared film into view with a margin", () => {
    expect(initialScrollLeft(2000, 800)).toBe(1800);
    expect(initialScrollLeft(2000, 2000)).toBe(1760);
  });

  it("never scrolls negative", () => {
    expect(initialScrollLeft(40, 800)).toBe(0);
  });
});

describe("initialAnchorX", () => {
  const item = (id: number, x: number) => ({ film: { id }, x });

  it("is null for a single lane or none", () => {
    expect(initialAnchorX([], new Set())).toBeNull();
    expect(initialAnchorX([[item(1, 100)]], new Set([1]))).toBeNull();
  });

  it("anchors on the earliest shared film", () => {
    const lanes = [
      [item(1, 100), item(2, 400), item(3, 900)],
      [item(2, 400), item(3, 900), item(4, 1200)],
    ];
    expect(initialAnchorX(lanes, new Set([2, 3]))).toBe(400);
  });

  it("falls back to where the latest-starting lane begins when nothing is shared", () => {
    const lanes = [[item(1, 100)], [item(2, 700), item(3, 800)], [item(4, 300)]];
    expect(initialAnchorX(lanes, new Set())).toBe(700);
  });

  it("ignores empty lanes in the fallback and returns null when all are empty", () => {
    expect(initialAnchorX([[item(1, 100)], []], new Set())).toBe(100);
    expect(initialAnchorX([[], []], new Set())).toBeNull();
  });
});
