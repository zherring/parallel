import { describe, expect, it } from "vitest";
import { GROUP_SLOT, connectionLegend, pairIndex } from "@/lib/connections";
import { sharedFilms } from "@/lib/shared";
import {
  CARD_GAP,
  CARD_FROM_BOTTOM,
  CARD_HEIGHT,
  CARD_WIDTH,
  DEFAULT_MAX_ROWS,
  DEFAULT_ZOOM,
  DOT_HIT_MIN,
  DOT_HIT_SIZE,
  LANE_PAD_TOP,
  LINE_FROM_BOTTOM,
  LINE_HALO,
  LINE_TO_CARD,
  MAX_ZOOM,
  MIN_ZOOM,
  OVERFLOW_ROW,
  POSTER_HEIGHT,
  QUIET_CARD_WIDTH,
  QUIET_POSTER_HEIGHT,
  QUIET_RESTORE_SCALE,
  ROW_GAP,
  TRACK_PAD,
  ZOOM_STEPS,
  axisRange,
  axisTicks,
  buildConnectors,
  cardTopInLane,
  cardWidthOf,
  centerYear,
  filmMembership,
  initialAnchorX,
  initialScrollLeft,
  isCrossed,
  labelStep,
  laneHeight,
  laneObstacles,
  makeScale,
  nextZoom,
  lineYInLane,
  nodeHitWidths,
  nodeY,
  overflowCount,
  packFilms,
  quietFilmIds,
  rowCount,
  scrollLeftForCenter,
  sharedAcrossLanes,
  stackLanes,
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
/** The date every connection test runs on: the films below came out long before it, the upcoming ones come after. */
const TODAY = "2025-06-15";

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

  it("does not touch priority films", () => {
    const packed = packFilms(pair, {
      ...base,
      axisStartYear: 1999,
      maxRows: 1,
      priorityIds: new Set([1]),
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
  const obstacles = laneObstacles(lanes, base, TODAY);

  it("lists, per lane, the lines of films shown in several lanes that run through it", () => {
    expect(obstacles[1].map((o) => o.filmId)).toEqual([1, 5]); // both start in lane 0 and come down to here; 1 ends on its node here
    expect(obstacles[2].map((o) => o.filmId)).toEqual([3, 5]); // 3 starts in lane 1, 5 in lane 0: both end on their nodes here
  });

  it("never has a line through the first lane that shows the film, so the first lane is never crossed", () => {
    expect(obstacles[0]).toEqual([]);
  });

  it("puts each line at its film's x, in x order", () => {
    const scale = makeScale({ startYear: 1990, endYear: 2010 }, 72);
    expect(obstacles[1]).toEqual([
      { filmId: 1, x: xForDate(scale, "2000-01-01") },
      { filmId: 5, x: xForDate(scale, "2004-01-01") },
    ]);
  });

  it("covers a lane a film skips (shown in lanes 0 and 2 only)", () => {
    const skipped = laneObstacles(
      [{ films: [f(1, "2000-01-01")] }, { films: [] }, { films: [f(1, "2000-01-01")] }],
      base,
      TODAY,
    );
    expect(skipped.map((o) => o.map((x) => x.filmId))).toEqual([[], [1], [1]]);
  });

  it("is empty for a single lane", () => {
    expect(laneObstacles([{ films: [f(1, "2000-01-01")] }], base, TODAY)).toEqual([[]]);
  });

  it("has no line for a film that is not out yet", () => {
    const upcoming = f(9, "2029-12-19");
    const withUpcoming = laneObstacles(
      [{ films: [f(1, "2000-01-01"), upcoming] }, { films: [f(1, "2000-01-01"), upcoming] }],
      base,
      TODAY,
    );
    expect(withUpcoming[0]).toEqual([]);
    expect(withUpcoming[1].map((o) => o.filmId)).toEqual([1]);
  });
});

describe("lane geometry", () => {
  it("grows with rows", () => {
    expect(laneHeight(1)).toBe(CARD_FROM_BOTTOM + CARD_HEIGHT + LANE_PAD_TOP);
    expect(laneHeight(3)).toBe(CARD_FROM_BOTTOM + 3 * CARD_HEIGHT + 2 * ROW_GAP + LANE_PAD_TOP);
    expect(laneHeight(0)).toBe(laneHeight(1));
  });

  it("offsets rows by card height plus gap, upward from the line", () => {
    const height = laneHeight(3);
    expect(cardTopInLane(0, height)).toBe(height - CARD_FROM_BOTTOM - CARD_HEIGHT);
    expect(cardTopInLane(2, height)).toBe(height - CARD_FROM_BOTTOM - CARD_HEIGHT - 2 * (CARD_HEIGHT + ROW_GAP));
  });

  it("keeps the highest row inside its lane", () => {
    for (const rows of [1, 2, 5]) {
      expect(cardTopInLane(rows - 1, laneHeight(rows))).toBe(LANE_PAD_TOP);
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

  it("uses the poster view's heights: about 188px for one row, 338px for two", () => {
    expect(laneHeight(1)).toBe(188);
    expect(laneHeight(2)).toBe(338);
  });

  it("stacks lanes from y = 0 with nothing between them: the page loses no height to a shared strip", () => {
    expect(stackLanes([1, 2]).map((b) => b.top)).toEqual([0, 188]);
    expect(totalHeight(stackLanes([1, 2]))).toBe(526);
    expect(totalHeight(stackLanes([2, 2]))).toBe(676);
    expect(totalHeight(stackLanes([2, 2, 2, 2]))).toBe(4 * laneHeight(2));
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

describe("sharedAcrossLanes", () => {
  const lane = (...ids: number[]) => ({ films: ids.map((id) => ({ id, releaseDate: "2000-01-01" })) });

  it("is the films that two or more lanes show", () => {
    expect(sharedAcrossLanes([lane(1, 2), lane(2, 3), lane(3, 4, 2)], TODAY)).toEqual(new Set([2, 3]));
  });

  it("counts a film once per lane", () => {
    expect(sharedAcrossLanes([lane(1, 1), lane(2)], TODAY)).toEqual(new Set());
  });

  it("leaves out a film that is not out yet, however many lanes list it", () => {
    const upcoming = (id: number) => ({ id, releaseDate: "2029-12-19" });
    const lanes = [{ films: [...lane(1, 2).films, upcoming(9)] }, { films: [...lane(2, 3).films, upcoming(9)] }];
    expect(sharedAcrossLanes(lanes, TODAY)).toEqual(new Set([2]));
  });

  it("counts a film released today and leaves out one released tomorrow", () => {
    const dated = (releaseDate: string) => ({ films: [{ id: 5, releaseDate }] });
    expect(sharedAcrossLanes([dated(TODAY), dated(TODAY)], TODAY)).toEqual(new Set([5]));
    expect(sharedAcrossLanes([dated("2025-06-16"), dated("2025-06-16")], TODAY)).toEqual(new Set());
  });

  it("is empty for a single lane, no lanes, or lanes with nothing in common", () => {
    expect(sharedAcrossLanes([lane(1, 2)], TODAY)).toEqual(new Set());
    expect(sharedAcrossLanes([], TODAY)).toEqual(new Set());
    expect(sharedAcrossLanes([lane(1), lane(2), lane(3)], TODAY)).toEqual(new Set());
  });
});

describe("quietFilmIds", () => {
  const lane = (...ids: number[]) => ({ films: ids.map((id) => ({ id, releaseDate: "2000-01-01" })) });

  it("is every film of one lane only, when a film is shared", () => {
    expect(quietFilmIds([lane(1, 2, 3), lane(3, 4)], TODAY)).toEqual(new Set([1, 2, 4]));
  });

  it("is empty for a single lane, however many films it has", () => {
    expect(quietFilmIds([lane(1, 2, 3)], TODAY)).toEqual(new Set());
    expect(quietFilmIds([], TODAY)).toEqual(new Set());
  });

  it("is empty when nothing is shared: there is nothing to stand out from", () => {
    expect(quietFilmIds([lane(1, 2), lane(3, 4)], TODAY)).toEqual(new Set());
    expect(quietFilmIds([lane(1), lane(2), lane(3)], TODAY)).toEqual(new Set());
    expect(quietFilmIds([lane(1, 1), lane(2)], TODAY)).toEqual(new Set());
  });

  it("leaves a film shared by any pair of lanes out, with 3+ lanes", () => {
    // 2 is shared by lanes 0 and 1, 3 by lanes 1 and 2; 1, 4 and 5 belong to one lane.
    expect(quietFilmIds([lane(1, 2), lane(2, 3), lane(3, 4, 5)], TODAY)).toEqual(new Set([1, 4, 5]));
  });

  it("leaves an upcoming film both lanes list quiet while something else is connected", () => {
    const upcoming = { id: 9, releaseDate: "2029-12-19" };
    const lanes = [{ films: [...lane(1, 2).films, upcoming] }, { films: [...lane(2, 3).films, upcoming] }];
    expect(quietFilmIds(lanes, TODAY)).toEqual(new Set([1, 3, 9]));
  });

  it("is empty when the only film two lanes share is not out yet: the pair has no connection at all", () => {
    const upcoming = { id: 9, releaseDate: "2029-12-19" };
    const lanes = [{ films: [...lane(1, 2).films, upcoming] }, { films: [...lane(3, 4).films, upcoming] }];
    expect(quietFilmIds(lanes, TODAY)).toEqual(new Set());
  });

  it("is exactly the films that have no connector line", () => {
    const lanes = [lane(1, 2, 3, 9), lane(2, 3, 4), lane(3, 5, 9), lane(6)];
    const quiet = quietFilmIds(lanes, TODAY);
    const connected = new Set(
      buildConnectors(
        lanes.map((l, index) => ({
          box: { top: index * 100, height: 100 },
          items: l.films.map((film) => ({ film, x: film.id * 10 })),
        })),
        TODAY,
      ).map((c) => c.filmId),
    );
    const all = new Set(lanes.flatMap((l) => l.films.map((film) => film.id)));
    expect(connected.size).toBeGreaterThan(0);
    for (const id of all) expect(quiet.has(id)).toBe(!connected.has(id));
  });

  it("is exactly the films that have no connector line, upcoming films included", () => {
    const upcoming = { id: 9, releaseDate: "2029-12-19" };
    const lanes = [
      { films: [...lane(1, 2, 3).films, upcoming] },
      { films: [...lane(2, 3, 4).films, upcoming] },
      { films: [...lane(3, 5).films, upcoming] },
    ];
    const quiet = quietFilmIds(lanes, TODAY);
    const connected = new Set(
      buildConnectors(
        lanes.map((l, index) => ({
          box: { top: index * 100, height: 100 },
          items: l.films.map((film) => ({ film, x: film.id * 10 })),
        })),
        TODAY,
      ).map((c) => c.filmId),
    );
    expect(connected).toEqual(new Set([2, 3]));
    expect(quiet.has(9)).toBe(true);
    for (const id of new Set(lanes.flatMap((l) => l.films.map((film) => film.id)))) {
      expect(quiet.has(id)).toBe(!connected.has(id));
    }
  });
});

describe("packFilms with quiet cards", () => {
  const quietIds = (...ids: number[]) => new Set(ids);
  const QUIET_DISTANCE = QUIET_CARD_WIDTH + CARD_GAP;

  it("is the quiet card size, 78% of the full one with the same 2:3 poster", () => {
    expect(QUIET_CARD_WIDTH).toBeLessThan(CARD_WIDTH);
    expect(QUIET_CARD_WIDTH / CARD_WIDTH).toBeGreaterThanOrEqual(0.75);
    expect(QUIET_CARD_WIDTH / CARD_WIDTH).toBeLessThanOrEqual(0.8);
    expect(QUIET_POSTER_HEIGHT / QUIET_CARD_WIDTH).toBeCloseTo(POSTER_HEIGHT / CARD_WIDTH, 6);
    expect(cardWidthOf(true)).toBe(QUIET_CARD_WIDTH);
    expect(cardWidthOf(false)).toBe(CARD_WIDTH);
    // Growing back by this much gives the full size poster.
    expect(QUIET_CARD_WIDTH * QUIET_RESTORE_SCALE).toBeCloseTo(CARD_WIDTH, 6);
    expect(QUIET_POSTER_HEIGHT * QUIET_RESTORE_SCALE).toBeCloseTo(POSTER_HEIGHT, 6);
  });

  it("changes nothing for films that are not quiet", () => {
    const films = [f(1, "1999-01-01"), f(2, "1999-03-01"), f(3, "1999-04-01"), f(4, "2003-01-01")];
    expect(packFilms(films, { ...base, quietIds: new Set() })).toEqual(packFilms(films, base));
    expect(packFilms(films, { ...base, quietIds: quietIds(99) })).toEqual(packFilms(films, base));
  });

  it("keeps two quiet cards a gap apart, which is closer than two full ones", () => {
    // About 66 px apart (11 months at 72 px/year): too close for two full cards (72), enough for two quiet ones (58).
    const close = (months: number) => [f(1, "1992-01-01"), f(2, `1992-${String(months).padStart(2, "0")}-01`)];
    const full = packFilms(close(11), base);
    expect(full[1].x - full[0].x).toBeLessThan(MIN_DISTANCE);
    expect(full.map((p) => p.row)).toEqual([0, 1]);
    const quiet = packFilms(close(11), { ...base, quietIds: quietIds(1, 2) });
    expect(quiet[1].x - quiet[0].x).toBeGreaterThanOrEqual(QUIET_DISTANCE);
    expect(quiet.map((p) => p.row)).toEqual([0, 0]);
  });

  it("packs a quiet card against a full one by half of each width plus the gap", () => {
    const mixed = (months: number, quiet: number[]) =>
      packFilms([f(1, "1992-01-01"), f(2, `1992-${String(months).padStart(2, "0")}-01`)], { ...base, quietIds: quietIds(...quiet) });
    const needed = (CARD_WIDTH + QUIET_CARD_WIDTH) / 2 + CARD_GAP; // 65
    // At 72 px/year, January to November is about 60 px (too close for 65), January to December about 66 px (enough).
    expect(mixed(12, [2])[1].x - mixed(12, [2])[0].x).toBeGreaterThanOrEqual(needed);
    expect(mixed(12, [2]).map((p) => p.row)).toEqual([0, 0]);
    expect(mixed(12, [1]).map((p) => p.row)).toEqual([0, 0]);
    expect(mixed(11, [2]).map((p) => p.row)).toEqual([0, 1]);
    expect(mixed(11, [1]).map((p) => p.row)).toEqual([0, 1]);
  });

  it("never overlaps two cards of a row, whatever their widths (dense pseudo-random years)", () => {
    let seed = 99;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const films = Array.from({ length: 300 }, (_, i) => {
      const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
      const day = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
      return f(i + 1, `${1990 + Math.floor(rand() * 8)}-${month}-${day}`, Math.floor(rand() * 1000));
    });
    const quiet = new Set(films.filter((_, i) => i % 3 !== 0).map((film) => film.id));
    const priority = new Set(films.filter((_, i) => i % 3 === 0 && i % 9 === 0).map((film) => film.id));
    for (const pxPerYear of [24, 72, 200]) {
      for (const maxRows of [undefined, 2]) {
        const packed = packFilms(films, { pxPerYear, axisStartYear: 1989, quietIds: quiet, priorityIds: priority, maxRows });
        const placed = packed.filter((p) => !p.overflow);
        const width = (id: number) => (quiet.has(id) ? QUIET_CARD_WIDTH : CARD_WIDTH);
        for (let i = 0; i < placed.length; i++) {
          for (let j = i + 1; j < placed.length; j++) {
            if (placed[i].row !== placed[j].row) continue;
            const needed = (width(placed[i].film.id) + width(placed[j].film.id)) / 2 + CARD_GAP;
            expect(Math.abs(placed[i].x - placed[j].x)).toBeGreaterThanOrEqual(needed - 1e-9);
          }
        }
      }
    }
  });

  it("overflows fewer cards under the row cap when the crowd is quiet", () => {
    // Twelve films 152 days (about 30 px at 72 px/year) apart: every other card is 60 px from the last, which
    // two quiet cards clear (58) and two full ones do not (72), so two rows hold all the quiet ones but not the full ones.
    const films = Array.from({ length: 12 }, (_, i) =>
      f(i + 1, new Date(Date.UTC(1990, 0, 1) + i * 152 * 86_400_000).toISOString().slice(0, 10), 100 - i),
    );
    const overflowWith = (quiet: ReadonlySet<number> | undefined) =>
      overflowCount(packFilms(films, { ...base, axisStartYear: 1989, maxRows: DEFAULT_MAX_ROWS, quietIds: quiet }));
    expect(overflowWith(undefined)).toBeGreaterThan(0);
    expect(overflowWith(new Set(films.map((film) => film.id)))).toBe(0);
  });

  it("is deterministic and keeps every film's x and the output order", () => {
    const films = [f(5, "2001-03-01", 3), f(2, "2001-02-01", 9), f(9, "2001-02-20", 1), f(1, "1999-01-01")];
    const quiet = quietIds(2, 5);
    const first = packFilms(films, { ...base, axisStartYear: 1998, maxRows: 2, quietIds: quiet });
    const second = packFilms([...films].reverse(), { ...base, axisStartYear: 1998, maxRows: 2, quietIds: quiet });
    expect(second).toEqual(first);
    expect(first.map((p) => p.film.id)).toEqual(packFilms(films, { ...base, axisStartYear: 1998 }).map((p) => p.film.id));
    expect(first.map((p) => p.x)).toEqual(packFilms(films, { ...base, axisStartYear: 1998 }).map((p) => p.x));
  });

  it("checks a quiet card against the lines of other films by its own width", () => {
    // A line 30 px from the centre of a 64 px card runs over it, but is clear of a 50 px one.
    const line = [{ filmId: 99, x: 100 + 30 }];
    expect(isCrossed(1, 100, line, CARD_WIDTH)).toBe(true);
    expect(isCrossed(1, 100, line, QUIET_CARD_WIDTH)).toBe(false);

    // Packing agrees. Film 1 (many votes) is 30 px from the line, film 2 (few votes) 40 px on the other side; they
    // collide, and one row is all there is. A full card of film 1 is under the line, so film 2 wins the slot; a quiet
    // card of film 1 clears the line, so the votes decide and film 1 does.
    const x1 = xForDate({ ...base, pad: TRACK_PAD }, "1992-01-01");
    const crowd = [f(1, "1992-01-01", 900), f(2, "1991-11-10", 10)];
    const obstacles = [{ filmId: 99, x: x1 + 30 }];
    const overflowOf = (quiet: ReadonlySet<number>) =>
      packFilms(crowd, { ...base, maxRows: 1, obstacles, quietIds: quiet })
        .filter((p) => p.overflow)
        .map((p) => p.film.id);
    expect(overflowOf(new Set())).toEqual([1]);
    expect(overflowOf(quietIds(1, 2))).toEqual([2]);
  });
});

describe("packing shared films into every lane", () => {
  const byId = <T extends { film: { id: number } }>(packed: T[]) => new Map(packed.map((p) => [p.film.id, p]));
  // Films 7 and 8 are shown by both lanes; they come out a few days apart, so their cards collide.
  const waking = f(7, "2001-10-19", 40);
  const tape = f(8, "2001-10-31", 30);
  const crowd = [f(1, "2001-10-01", 900), f(2, "2001-10-10", 800), f(3, "2001-11-05", 700)];
  const shared = new Set([7, 8]);
  const lanes = [
    [...crowd, waking, tape],
    [waking, tape, f(4, "2001-10-25", 950), f(5, "1995-01-01", 10)],
  ];
  const packed = lanes.map((films) => byId(packFilms(films, { ...base, axisStartYear: 2000, maxRows: DEFAULT_MAX_ROWS, priorityIds: shared })));

  it("gives a shared film a card in every lane that shows it, whatever the cap", () => {
    for (const lane of packed) for (const id of shared) expect(lane.get(id)).toMatchObject({ overflow: false });
  });

  it("places shared films ahead of better-voted films of the lane, on the lowest rows", () => {
    expect(packed[0].get(7)).toMatchObject({ row: 0 });
    expect(packed[0].get(8)).toMatchObject({ row: 1 });
    // The crowd that is not shared only gets what is left: nothing, in this lane.
    for (const id of [1, 2, 3]) expect(packed[0].get(id)).toMatchObject({ overflow: true });
    expect(packed[1].get(7)).toMatchObject({ row: 0 });
    expect(packed[1].get(8)).toMatchObject({ row: 1 });
    expect(packed[1].get(4)).toMatchObject({ overflow: true });
  });

  it("puts a shared film at the same x in every lane, and on the same row while the lanes share the same crowd", () => {
    for (const id of shared) {
      expect(packed[0].get(id)!.x).toBe(packed[1].get(id)!.x);
      expect(packed[0].get(id)!.row).toBe(packed[1].get(id)!.row);
    }
  });

  it("exempts shared films from the cap, so a lane can need more rows than the cap for them", () => {
    const films = Array.from({ length: 4 }, (_, i) => f(i + 1, `2001-10-0${i + 1}`, 1));
    const lane = packFilms(films, { ...base, axisStartYear: 2000, maxRows: DEFAULT_MAX_ROWS, priorityIds: new Set([1, 2, 3, 4]) });
    expect(lane.every((p) => !p.overflow)).toBe(true);
    expect(rowCount(lane)).toBe(4);
  });

  it("keeps a lane at one row of posters when its shared films do not collide", () => {
    const lane = packFilms([f(1, "1995-01-01"), f(2, "2000-01-01"), f(3, "2005-01-01")], {
      ...base,
      maxRows: DEFAULT_MAX_ROWS,
      priorityIds: new Set([2]),
    });
    expect(lane.every((p) => p.row === 0)).toBe(true);
    expect(laneHeight(rowCount(lane))).toBe(188);
  });

  it("counts only films without a card as overflow, which is what 'Show all' offers", () => {
    expect(overflowCount([...packed[0].values()])).toBe(3);
    expect(overflowCount([...packed[1].values()])).toBe(1);
  });
});

describe("buildConnectors", () => {
  /** A lane's films, each a node on its line. */
  const makeLane = (box: { top: number; height: number }, items: { id: number; x: number }[]) => ({
    box,
    items: items.map(({ id, x }) => ({ film: { id, releaseDate: "2000-01-01" }, x })),
  });

  it("runs one continuous line from the first lane's node to the last lane's node", () => {
    const boxes = stackLanes([1, 1]);
    const connectors = buildConnectors(boxes.map((box) => makeLane(box, [{ id: 1, x: 300 }])), TODAY);
    expect(connectors).toEqual([
      {
        filmId: 1,
        x: 300,
        y1: 174,
        y2: 362,
        fromLane: 0,
        toLane: 1,
        lanes: [0, 1],
        kind: "all",
        slot: null,
      },
    ]);
  });

  it("ends on the node of the last lane, wherever the lane heights put it", () => {
    // Each lane's line is LINE_FROM_BOTTOM above the bottom of its lane: lanes of 1, 2 and 3 rows are 188, 338 and 488px tall.
    const cases: [number[], number, number][] = [
      [[1, 1], 174, 362],
      [[2, 1], 324, 512],
      [[2, 2], 324, 662],
      [[1, 3], 174, 662],
    ];
    for (const [rows, y1, y2] of cases) {
      const boxes = stackLanes(rows);
      const [c] = buildConnectors(boxes.map((box) => makeLane(box, [{ id: 1, x: 5 }])), TODAY);
      expect(c.y1).toBe(y1);
      expect(c.y2).toBe(y2);
      expect(c.y1).toBe(laneHeight(rows[0]) - LINE_FROM_BOTTOM);
      expect(c.y2).toBe(laneHeight(rows[0]) + laneHeight(rows[1]) - LINE_FROM_BOTTOM);
    }
  });

  it("continues through the lanes between with 3 lanes", () => {
    const boxes = stackLanes([1, 2, 1]);
    const [c] = buildConnectors(boxes.map((box) => makeLane(box, [{ id: 1, x: 80 }])), TODAY);
    expect(c).toMatchObject({ fromLane: 0, toLane: 2, lanes: [0, 1, 2], kind: "all", slot: null });
    expect(c.y1).toBe(174);
    expect(c.y2).toBe(700);
    expect(c.y2).toBe(boxes[2].top + lineYInLane(boxes[2].height));
  });

  it("links the posters of a shared film: it leaves the first lane's node below its poster and reaches the last lane's node under its poster", () => {
    const films = [f(1, "2001-01-01", 5), f(9, "2001-01-20", 900)];
    const lanes = [films, [films[0]]].map((laneFilms) =>
      packFilms(laneFilms, { ...base, axisStartYear: 2000, maxRows: DEFAULT_MAX_ROWS, priorityIds: new Set([1]) }),
    );
    const boxes = stackLanes(lanes.map(rowCount));
    const [c] = buildConnectors(lanes.map((items, i) => ({ box: boxes[i], items })), TODAY);
    const posterOf = (lane: number) => lanes[lane].find((p) => p.film.id === 1)!;
    const posterBottom = (lane: number) =>
      boxes[lane].top + cardTopInLane(posterOf(lane).row, boxes[lane].height) + CARD_HEIGHT;

    expect(c.filmId).toBe(1);
    // The shared film is on the first row in both lanes, which the lane's other film gives way to.
    expect(lanes.map((items) => items.find((p) => p.film.id === 1)!.row)).toEqual([0, 0]);
    expect(lanes[0].find((p) => p.film.id === 9)!.row).toBe(1);
    // The line starts on the node under the poster in the first lane, and ends on the node under the same film's poster in the last.
    expect(c.y1).toBe(nodeY(boxes[0]));
    expect(c.y2).toBe(nodeY(boxes[1]));
    expect(c.y1 - posterBottom(0)).toBe(LINE_TO_CARD);
    expect(c.y2 - posterBottom(1)).toBe(LINE_TO_CARD);
    // Both posters, and both nodes, are at the line's x.
    expect(lanes.map((items) => items.find((p) => p.film.id === 1)!.x)).toEqual([c.x, c.x]);
  });

  it("colours a partial share by its pair, whichever lanes show it", () => {
    const boxes = stackLanes([1, 1, 1]);
    const lanes = [
      makeLane(boxes[0], [{ id: 1, x: 40 }, { id: 7, x: 90 }]),
      makeLane(boxes[1], [{ id: 7, x: 90 }, { id: 8, x: 200 }]),
      makeLane(boxes[2], [{ id: 1, x: 40 }, { id: 8, x: 200 }]),
    ];
    // Film 1 is in lanes 0 and 2, film 7 in lanes 0 and 1, film 8 in lanes 1 and 2; none is in all three.
    const byFilm = new Map(buildConnectors(lanes, TODAY).map((c) => [c.filmId, c]));

    expect(byFilm.get(1)).toMatchObject({ kind: "some", fromLane: 0, toLane: 2, lanes: [0, 2], slot: pairIndex(0, 2) });
    expect(byFilm.get(7)).toMatchObject({ kind: "some", fromLane: 0, toLane: 1, slot: pairIndex(0, 1) });
    expect(byFilm.get(8)).toMatchObject({ kind: "some", fromLane: 1, toLane: 2, slot: pairIndex(1, 2) });
    expect(new Set([...byFilm.values()].map((c) => c.slot)).size).toBe(3);
    expect(byFilm.get(1)!.y1).toBe(174);
    expect(byFilm.get(1)!.y2).toBe(boxes[2].top + 174);
  });

  it("draws a film of every lane green and one of fewer lanes in a pair colour, with 4 lanes too", () => {
    const boxes = stackLanes([1, 1, 1, 1]);
    const lanes = boxes.map((box, i) =>
      makeLane(box, [{ id: 1, x: 10 }, ...(i >= 2 ? [{ id: 2, x: 50 }] : []), ...(i >= 1 ? [{ id: 3, x: 90 }] : [])]),
    );
    const connectors = buildConnectors(lanes, TODAY);
    expect(connectors.find((c) => c.filmId === 1)).toMatchObject({ kind: "all", slot: null });
    expect(connectors.find((c) => c.filmId === 2)).toMatchObject({ kind: "some", lanes: [2, 3], slot: pairIndex(2, 3) });
    // Three of the four lanes share the group slot.
    expect(connectors.find((c) => c.filmId === 3)).toMatchObject({ kind: "some", lanes: [1, 2, 3], slot: GROUP_SLOT });
  });

  it("counts every film of a lane as a member, with a card or without", () => {
    const upper = packFilms(
      [f(1, "2000-01-01", 1), f(2, "2000-01-02", 2), f(3, "2000-01-03", 3), f(7, "2000-01-04", 1)],
      { ...base, maxRows: 2, priorityIds: new Set([7]) },
    );
    const lower = packFilms([f(7, "2000-01-04", 1), f(2, "2000-01-02", 2)], { ...base, maxRows: 2, priorityIds: new Set([7]) });
    const boxes = stackLanes([rowCount(upper), rowCount(lower)]);
    const lanes = [
      { box: boxes[0], items: upper },
      { box: boxes[1], items: lower },
    ];
    expect(filmMembership(lanes, TODAY).get(7)).toEqual([0, 1]);
    // 2 is in both lanes too, even though it is only a node in the first one (no card: over the cap).
    expect(upper.find((p) => p.film.id === 2)).toMatchObject({ overflow: true });
    expect(filmMembership(lanes, TODAY).get(2)).toEqual([0, 1]);
  });

  it("connects shared films in a capped layout, even in a row beyond the cap", () => {
    const options = { ...base, maxRows: 2, priorityIds: new Set([7]) };
    const upper = packFilms([f(1, "2000-01-01", 1), f(2, "2000-01-02", 2), f(3, "2000-01-03", 3), f(7, "2000-01-04", 1)], options);
    const lower = packFilms([f(7, "2000-01-04", 1)], options);
    const boxes = stackLanes([rowCount(upper), rowCount(lower)]);
    const lanes = [
      { box: boxes[0], items: upper },
      { box: boxes[1], items: lower },
    ];

    const connectors = buildConnectors(lanes, TODAY);
    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({ filmId: 7, kind: "all", x: upper.find((p) => p.film.id === 7)!.x });
    expect(connectors[0].y1).toBe(boxes[0].height - LINE_FROM_BOTTOM);
    expect(connectors[0].y2).toBe(boxes[1].top + boxes[1].height - LINE_FROM_BOTTOM);
    expect(connectors[0].y2).toBeGreaterThan(connectors[0].y1);
    expect(boxes[0].height).toBe(laneHeight(rowCount(upper)));
  });

  it("ignores films that appear in one lane only", () => {
    const lanes = [makeLane({ top: 0, height: 200 }, [{ id: 1, x: 10 }]), makeLane({ top: 200, height: 200 }, [{ id: 2, x: 10 }])];
    expect(buildConnectors(lanes, TODAY)).toEqual([]);
    expect(buildConnectors([makeLane({ top: 0, height: 200 }, [{ id: 1, x: 10 }])], TODAY)).toEqual([]);
    expect(buildConnectors([], TODAY)).toEqual([]);
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
    const boxes = stackLanes([1, 1, 1]);
    const priorityIds = sharedAcrossLanes(timelines, TODAY);
    const lanes = timelines.map((t, i) => ({ box: boxes[i], items: packFilms(t.films, { ...base, priorityIds }) }));

    const all = new Set(buildConnectors(lanes, TODAY).filter((c) => c.kind === "all").map((c) => c.filmId));
    expect(all).toEqual(new Set(sharedFilms(timelines, { includeMinor: false, today: TODAY }).map((s) => s.id)));
    expect(filmMembership(lanes, TODAY).get(30)).toEqual([0, 1]);
    expect(priorityIds).toEqual(new Set([20, 30, 40]));
  });

  it("is deterministic and ordered by x then film", () => {
    const lanes = [
      makeLane({ top: 0, height: 200 }, [{ id: 1, x: 5 }, { id: 2, x: 9 }]),
      makeLane({ top: 300, height: 200 }, [{ id: 2, x: 9 }, { id: 1, x: 5 }]),
    ];
    expect(buildConnectors(lanes, TODAY)).toEqual(buildConnectors(lanes, TODAY));
    expect(buildConnectors(lanes, TODAY).map((c) => c.filmId)).toEqual([1, 2]);
  });

  it("puts a film's node and poster at the same x in every lane, so the line stands exactly vertical", () => {
    const films = [f(1, "1995-03-04"), f(2, "2001-07-19")];
    const options = { ...base, priorityIds: new Set([1, 2]) };
    const lanes = [packFilms([...films, f(5, "1998-01-01", 3)], options), packFilms(films, options)];
    for (const film of films) {
      const xs = lanes.map((items) => items.find((p) => p.film.id === film.id)!.x);
      expect(new Set(xs).size).toBe(1);
    }
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

describe("films that are not out yet", () => {
  const released = (id: number, releaseDate: string, voteCount = 1) => ({ id, releaseDate, voteCount });
  const UPCOMING = "2029-12-19";

  /** What the timeline does with its lanes, in order: priority and quiet films, obstacles, packing, then membership and connectors. */
  function layOut(laneFilms: ReturnType<typeof released>[][], today: string = TODAY) {
    const lanes = laneFilms.map((films) => ({ films }));
    const options = { ...base, axisStartYear: 1995 };
    const priorityIds = sharedAcrossLanes(lanes, today);
    const quietIds = quietFilmIds(lanes, today);
    const obstacles = laneObstacles(lanes, options, today);
    const packed = lanes.map((lane, i) =>
      packFilms(lane.films, { ...options, priorityIds, quietIds, obstacles: obstacles[i], maxRows: DEFAULT_MAX_ROWS }),
    );
    const boxes = stackLanes(packed.map(rowCount));
    const connectorLanes = packed.map((items, i) => ({ box: boxes[i], items }));
    return {
      priorityIds,
      quietIds,
      packed,
      membership: filmMembership(connectorLanes, today),
      connectors: buildConnectors(connectorLanes, today),
    };
  }

  it("shows a shared upcoming film as an ordinary poster in each lane, with no connector, while another film is connected", () => {
    const layout = layOut([
      [released(1, "2001-05-01"), released(2, "2004-05-01"), released(9, UPCOMING)],
      [released(1, "2001-05-01"), released(3, "2008-05-01"), released(9, UPCOMING)],
    ]);

    // The released shared film is connected, in both lanes; nothing else is.
    expect(layout.connectors.map((c) => c.filmId)).toEqual([1]);
    expect(layout.membership.get(1)).toEqual([0, 1]);
    expect(layout.priorityIds).toEqual(new Set([1]));

    // The upcoming one is in neither: no membership, no priority, and quiet like any film nothing connects.
    expect(layout.membership.has(9)).toBe(false);
    expect(layout.priorityIds.has(9)).toBe(false);
    expect(layout.quietIds).toEqual(new Set([2, 3, 9]));

    // It still has a poster card (not overflow) in each lane, at its own date.
    for (const lane of layout.packed) {
      const poster = lane.find((p) => p.film.id === 9)!;
      expect(poster.overflow).toBe(false);
      expect(poster.x).toBe(xForDate(makeScale({ startYear: 1995, endYear: 2031 }, 72), UPCOMING));
    }
  });

  it("makes a pair whose only shared film is upcoming behave like a pair with no connection: nothing quiet, no connector", () => {
    const layout = layOut([
      [released(1, "2001-05-01"), released(9, UPCOMING)],
      [released(3, "2008-05-01"), released(9, UPCOMING)],
    ]);
    expect(layout.connectors).toEqual([]);
    // Only the released films are members (of one lane each); 9 is not a member of any.
    expect([...layout.membership.keys()].sort()).toEqual([1, 3]);
    expect([...layout.membership.values()].every((lanes) => lanes.length === 1)).toBe(true);
    expect(layout.priorityIds).toEqual(new Set());
    expect(layout.quietIds).toEqual(new Set());
  });

  it("connects the same film once the date has passed it", () => {
    const films = [
      [released(1, "2001-05-01"), released(9, UPCOMING)],
      [released(3, "2008-05-01"), released(9, UPCOMING)],
    ];
    expect(layOut(films, "2029-12-18").connectors).toEqual([]);
    const onTheDay = layOut(films, UPCOMING);
    expect(onTheDay.connectors.map((c) => c.filmId)).toEqual([9]);
    expect(onTheDay.quietIds).toEqual(new Set([1, 3]));
  });

  it("does not count an upcoming film in the legend of a 3-person page", () => {
    const layout = layOut([
      [released(1, "2001-05-01"), released(9, UPCOMING)],
      [released(1, "2001-05-01"), released(9, UPCOMING)],
      [released(1, "2001-05-01"), released(9, UPCOMING), released(7, "2010-01-01")],
    ]);
    expect(layout.connectors.map((c) => [c.filmId, c.kind])).toEqual([[1, "all"]]);
    expect(connectionLegend(layout.connectors, 3)).toEqual([{ key: "all", slot: null, lanes: null, count: 1 }]);
    expect(layout.membership.has(9)).toBe(false);
  });

  it("agrees with sharedFilms: a film is connected in every lane exactly when it is a shared film", () => {
    const credit: Credit = { role: "actor", job: "Actor", minor: false };
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
    const a = person(1, [film(10, "2001-01-01"), film(99, UPCOMING)]);
    const b = person(2, [film(10, "2001-01-01"), film(99, UPCOMING)]);
    const shared = sharedFilms([a, b], { includeMinor: false, today: TODAY });
    const layout = layOut([a, b].map((t) => t.films.map((x) => released(x.id, x.releaseDate))));
    expect(shared.map((x) => x.id)).toEqual([10]);
    expect(layout.connectors.filter((c) => c.kind === "all").map((c) => c.filmId)).toEqual(shared.map((x) => x.id));
  });
});
