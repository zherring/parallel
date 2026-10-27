import { describe, expect, it } from "vitest";
import { sharedFilms } from "@/lib/shared";
import {
  CARD_GAP,
  CARD_HEIGHT,
  CARD_TOP,
  CARD_WIDTH,
  DEFAULT_ZOOM,
  LANE_PAD_BOTTOM,
  MAX_ZOOM,
  MIN_ZOOM,
  ROW_GAP,
  TRACK_PAD,
  ZOOM_STEPS,
  axisRange,
  axisTicks,
  buildConnectors,
  cardTopInLane,
  centerYear,
  filmMembership,
  initialAnchorX,
  initialScrollLeft,
  labelStep,
  laneHeight,
  makeScale,
  nextZoom,
  packFilms,
  rowCount,
  scrollLeftForCenter,
  stackLanes,
  totalHeight,
  trackWidth,
  xForDate,
  yearFraction,
} from "@/lib/timeline-layout";
import type { Credit, Film, PersonTimeline } from "@/lib/types";

const f = (id: number, releaseDate: string) => ({ id, releaseDate });
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

  it("stacks lanes with cumulative tops", () => {
    const boxes = stackLanes([1, 3, 2]);
    expect(boxes[0].top).toBe(0);
    expect(boxes[1].top).toBe(laneHeight(1));
    expect(boxes[2].top).toBe(laneHeight(1) + laneHeight(3));
    expect(totalHeight(boxes)).toBe(laneHeight(1) + laneHeight(3) + laneHeight(2));
    expect(totalHeight([])).toBe(0);
  });
});

describe("buildConnectors", () => {
  const lane = (top: number, items: { id: number; x: number; row: number }[]) => ({
    box: { top, height: 0 },
    items: items.map(({ id, x, row }) => ({ film: { id }, x, row })),
  });

  it("links a film's cards in two lanes, bottom of the upper to top of the lower", () => {
    const boxes = stackLanes([1, 1]);
    const lanes = [
      { box: boxes[0], items: [{ film: { id: 1 }, x: 300, row: 0 }] },
      { box: boxes[1], items: [{ film: { id: 1 }, x: 300, row: 0 }] },
    ];
    expect(buildConnectors(lanes)).toEqual([
      {
        filmId: 1,
        x: 300,
        y1: CARD_TOP + CARD_HEIGHT,
        y2: boxes[1].top + CARD_TOP,
        fromLane: 0,
        toLane: 1,
        kind: "all",
      },
    ]);
  });

  it("accounts for sub-rows on either side", () => {
    const boxes = stackLanes([3, 2]);
    const lanes = [
      { box: boxes[0], items: [{ film: { id: 1 }, x: 100, row: 2 }] },
      { box: boxes[1], items: [{ film: { id: 1 }, x: 100, row: 1 }] },
    ];
    const [c] = buildConnectors(lanes);
    expect(c.y1).toBe(cardTopInLane(2) + CARD_HEIGHT);
    expect(c.y2).toBe(boxes[1].top + cardTopInLane(1));
    expect(c.y2).toBeGreaterThan(c.y1);
  });

  it("ignores films that appear in one lane only", () => {
    const lanes = [lane(0, [{ id: 1, x: 10, row: 0 }]), lane(200, [{ id: 2, x: 10, row: 0 }])];
    expect(buildConnectors(lanes)).toEqual([]);
    expect(buildConnectors([lane(0, [{ id: 1, x: 10, row: 0 }])])).toEqual([]);
    expect(buildConnectors([])).toEqual([]);
  });

  it("chains neighbours for 3 lanes and marks all-lane films", () => {
    const lanes = [0, 1, 2].map((i) => lane(i * 200, [{ id: 7, x: 50, row: 0 }]));
    const connectors = buildConnectors(lanes);
    expect(connectors.map((c) => [c.fromLane, c.toLane, c.kind])).toEqual([
      [0, 1, "all"],
      [1, 2, "all"],
    ]);
  });

  it("marks partial films as 'some' and links only lanes that show them", () => {
    const lanes = [
      lane(0, [{ id: 1, x: 40, row: 0 }]),
      lane(200, []),
      lane(400, [{ id: 1, x: 40, row: 0 }]),
    ];
    const connectors = buildConnectors(lanes);
    expect(connectors).toHaveLength(1);
    expect(connectors[0]).toMatchObject({ fromLane: 0, toLane: 2, kind: "some" });
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
      person: { id, name: `P${id}`, profilePath: null, knownFor: null, birthday: null, deathday: null },
      films,
    });
    const timelines = [
      person(1, [film(10, "1995-01-01"), film(20, "1999-01-01"), film(30, "2004-01-01")]),
      person(2, [film(20, "1999-01-01"), film(30, "2004-01-01"), film(40, "2010-01-01")]),
      person(3, [film(20, "1999-01-01"), film(40, "2010-01-01")]),
    ];
    const lanes = timelines.map((t, i) => ({
      box: stackLanes([1, 1, 1])[i],
      items: packFilms(t.films, base).map((p) => ({ film: p.film, x: p.x, row: p.row })),
    }));

    const all = new Set(buildConnectors(lanes).filter((c) => c.kind === "all").map((c) => c.filmId));
    expect(all).toEqual(new Set(sharedFilms(timelines, { includeMinor: false }).map((s) => s.id)));
    expect(filmMembership(lanes).get(30)).toEqual([0, 1]);
  });

  it("is deterministic", () => {
    const lanes = [lane(0, [{ id: 1, x: 5, row: 0 }, { id: 2, x: 9, row: 1 }]), lane(300, [{ id: 2, x: 9, row: 0 }, { id: 1, x: 5, row: 0 }])];
    expect(buildConnectors(lanes)).toEqual(buildConnectors(lanes));
    expect(buildConnectors(lanes).map((c) => c.filmId)).toEqual([1, 2]);
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
