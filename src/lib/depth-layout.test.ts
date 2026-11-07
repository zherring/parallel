import { describe, expect, it } from "vitest";
import { combineLanes } from "@/lib/combined-track";
import {
  DEPTH,
  anchorScrollTop,
  bandFor,
  blurFor,
  columnOffset,
  depthLayout,
  hashUnit,
  layerDepth,
  layerFactor,
  type DepthFilm,
} from "@/lib/depth-layout";
import { personSlots } from "@/lib/person-colors";
import { xForDate } from "@/lib/timeline-layout";
import type { Film } from "@/lib/types";

const TODAY = "2026-01-01";

function film(id: number, releaseDate: string): Film {
  return {
    id,
    title: `Film ${id}`,
    releaseDate,
    year: Number(releaseDate.slice(0, 4)),
    posterPath: null,
    voteCount: 0,
    credits: [{ role: "director", job: "Director", minor: false }],
    minor: false,
  };
}

/** The entries of `combineLanes` for people 10, 20, 30 ... with the films given by id/date. */
function entriesOf(lanes: [number, string][][]) {
  const people = lanes.map((_, i) => ({ id: (i + 1) * 10 }));
  const made = lanes.map((films, i) => ({ person: people[i], films: films.map(([id, date]) => film(id, date)) }));
  return { entries: combineLanes(made, personSlots(people), TODAY), peopleCount: people.length };
}

const layout = (lanes: [number, string][][]) => {
  const { entries, peopleCount } = entriesOf(lanes);
  return depthLayout(entries, peopleCount, TODAY);
};
const byId = (l: ReturnType<typeof layout>, id: number) => l.films.find((f) => f.film.id === id) as DepthFilm;

describe("layerFactor", () => {
  it("is 1 at the screen plane and decreases with every layer", () => {
    expect(layerFactor(0)).toBe(1);
    const factors = DEPTH.z.map((_, layer) => layerFactor(layer));
    for (let i = 1; i < factors.length; i++) expect(factors[i]).toBeLessThan(factors[i - 1]);
    expect(layerFactor(1)).toBeCloseTo(1000 / 1320, 10);
  });

  it("takes the perspective as a parameter and clamps layers past the table to the last one", () => {
    expect(layerFactor(1, 500)).toBeCloseTo(500 / 820, 10);
    expect(layerDepth(99)).toBe(DEPTH.z[DEPTH.z.length - 1]);
    expect(layerDepth(-3)).toBe(0);
  });
});

describe("columnOffset", () => {
  it("alternates around the centre line: 0, +s, -s, +2s, -2s", () => {
    expect([0, 1, 2, 3, 4, 5].map((col) => columnOffset(col, 100))).toEqual([0, 100, -100, 200, -200, 300]);
  });

  it("is the centre line for anything below column 0", () => {
    expect(columnOffset(-2, 100)).toBe(0);
  });
});

describe("hashUnit", () => {
  it("is deterministic and in [0, 1)", () => {
    for (const id of [0, 1, 2, 278, 550, 1234567, 99999999]) {
      const value = hashUnit(id);
      expect(value).toBe(hashUnit(id));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("spreads neighbouring ids apart", () => {
    const values = Array.from({ length: 200 }, (_, id) => hashUnit(id));
    expect(new Set(values).size).toBe(200);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
  });
});

describe("bandFor", () => {
  it("is the middle for one person and the slot's band for several", () => {
    expect(bandFor(0, 1)).toBe(0.5);
    expect(bandFor(0, 2)).toBe(0.3);
    expect(bandFor(1, 2)).toBe(0.7);
    expect(bandFor(2, 3)).toBe(0.18);
    expect(bandFor(3, 4)).toBe(0.82);
  });
});

describe("blurFor", () => {
  it("leaves the front layer sharp and blurs the ones behind it more the further back they are", () => {
    expect([0, 1, 2, 3, 4].map((layer) => blurFor(layer, true))).toEqual([0, 2, 3, 3, 3]);
  });

  it("keeps the first person's layer sharp when nothing is shared, as it is then the front-most", () => {
    expect([0, 1, 2, 3].map((layer) => blurFor(layer, false))).toEqual([0, 0, 3, 3]);
  });
});

describe("depthLayout", () => {
  // Person 10 and 20 share film 2 (2000) and film 5 (2010); 10 has 1 (1990), 20 has 3 (1995) and 4 (2002).
  const pair: [number, string][][] = [
    [[1, "1990-01-01"], [2, "2000-01-01"], [5, "2010-01-01"]],
    [[3, "1995-01-01"], [2, "2000-01-01"], [4, "2002-01-01"], [5, "2010-01-01"]],
  ];

  it("puts the films several people made on layer 0, at the centre of the width", () => {
    const l = layout(pair);
    for (const id of [2, 5]) {
      expect(byId(l, id)).toMatchObject({ layer: 0, shared: true, xFrac: 0.5, dx: 0, w: DEPTH.collab.w, h: DEPTH.collab.h, slots: [0, 1] });
    }
    expect(l.hasShared).toBe(true);
  });

  it("puts each person's own films on their layer, at their band, jittered by less than half a gap", () => {
    const l = layout(pair);
    expect(byId(l, 1)).toMatchObject({ layer: 1, shared: false, xFrac: 0.3, w: DEPTH.solo.w, h: DEPTH.solo.h });
    expect(byId(l, 3)).toMatchObject({ layer: 2, xFrac: 0.7 });
    expect(byId(l, 4)).toMatchObject({ layer: 2, xFrac: 0.7 });
    for (const id of [1, 3, 4]) {
      const f = byId(l, id);
      expect(Math.abs(f.dx - columnOffset(f.col, DEPTH.solo.w + DEPTH.colGap))).toBeLessThanOrEqual(DEPTH.colGap / 2);
      expect(Math.abs(f.y - xForDate(l.scale, f.film.releaseDate))).toBeLessThanOrEqual(DEPTH.rowGap / 2);
    }
  });

  it("lays every film at its release date on one scale, oldest at the top", () => {
    const l = layout(pair);
    expect(l.scale.pxPerYear).toBe(DEPTH.pxPerYear);
    expect(l.scale.pad).toBe(DEPTH.pad);
    for (const id of [2, 5]) expect(byId(l, id).y).toBe(xForDate(l.scale, byId(l, id).film.releaseDate));
    expect(byId(l, 2).y).toBeGreaterThan(byId(l, 1).y);
    expect(byId(l, 5).y).toBeGreaterThan(byId(l, 2).y);
    // The axis runs one year past the first and last films.
    expect(l.scale.axisStartYear).toBe(1989);
    expect(l.scale.axisEndYear).toBe(2011);
    expect(l.trackHeight).toBe(DEPTH.pad * 2 + 22 * DEPTH.pxPerYear);
    expect(l.layerCount).toBe(3);
  });

  it("lists the films layer by layer, each layer top to bottom", () => {
    const l = layout(pair);
    const keys = l.films.map((f) => [f.layer, f.y]);
    expect(keys).toEqual([...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1]));
    expect(l.films.map((f) => f.layer)).toEqual([0, 0, 1, 2, 2]);
  });

  it("is the same layout every time", () => {
    expect(layout(pair)).toEqual(layout(pair));
  });

  it("shows a film that only some of three people made on layer 0 when it is released, in the colours of those people", () => {
    const l = layout([[[1, "2000-01-01"]], [[1, "2000-01-01"], [2, "1995-01-01"]], [[3, "1990-01-01"]]]);
    expect(byId(l, 1)).toMatchObject({ layer: 0, shared: true, slots: [0, 1] });
    expect(byId(l, 2)).toMatchObject({ layer: 2, xFrac: 0.7 });
    expect(byId(l, 3)).toMatchObject({ layer: 3, xFrac: 0.18 });
    expect(l.layerCount).toBe(4);
  });

  it("puts an upcoming film several people are making on its first person's layer, at the size of a solo poster", () => {
    const l = layout([[[1, "2030-01-01"]], [[1, "2030-01-01"], [2, "2000-01-01"]]]);
    expect(byId(l, 1)).toMatchObject({ layer: 1, shared: false, slots: [0, 1], w: DEPTH.solo.w, h: DEPTH.solo.h, xFrac: 0.3 });
    expect(l.hasShared).toBe(false);
  });

  it("keeps one person in the middle of the width, all on the first person's layer", () => {
    const l = layout([[[1, "1990-01-01"], [2, "2000-01-01"]]]);
    expect(l.films.map((f) => [f.layer, f.xFrac])).toEqual([
      [1, 0.5],
      [1, 0.5],
    ]);
    expect(l.hasShared).toBe(false);
    expect(l.layerCount).toBe(2);
  });

  it("scrolls the whole span of the films even when nothing is shared", () => {
    const l = layout([[[1, "1950-01-01"]], [[2, "2020-01-01"]]]);
    expect(l.hasShared).toBe(false);
    expect(l.trackHeight).toBe(DEPTH.pad * 2 + (2021 - 1949) * DEPTH.pxPerYear);
    expect(l.films.every((f) => f.layer > 0)).toBe(true);
  });

  it("brackets today when there are no films, and has no anchor", () => {
    const l = depthLayout([], 1, TODAY);
    expect(l.films).toEqual([]);
    expect(l.scale.axisStartYear).toBe(2025);
    expect(l.scale.axisEndYear).toBe(2027);
    expect(l.trackHeight).toBe(DEPTH.pad * 2 + 2 * DEPTH.pxPerYear);
    expect(l.anchorY).toBeNull();
    expect(l.hasShared).toBe(false);
  });

  it("leaves out a film whose date cannot be read", () => {
    const { entries } = entriesOf([[[1, "1990-01-01"], [2, "soon"]]]);
    expect(depthLayout(entries, 1, TODAY).films.map((f) => f.film.id)).toEqual([1]);
  });

  describe("columns", () => {
    // Nine films a year and a half apart, 168 + 14 px is about 1.4 years: neighbours collide, so they take columns.
    const crowded = (layer: "shared" | "solo") => {
      const dates = Array.from({ length: 9 }, (_, i): [number, string] => [100 + i, `${2000 + Math.floor(i * 0.5)}-0${1 + (i % 2) * 5}-01`]);
      return layer === "shared" ? layout([dates, dates]) : layout([dates, [[1, "1990-01-01"]]]);
    };

    it("lets no two posters of a layer overlap, jitter included", () => {
      for (const l of [crowded("shared"), crowded("solo"), layout([[[1, "2000-01-01"], [2, "2000-02-01"], [3, "2000-03-01"], [4, "2000-04-01"]]])]) {
        for (const a of l.films) {
          for (const b of l.films) {
            if (a === b || a.layer !== b.layer || a.xFrac !== b.xFrac) continue;
            const apartX = Math.abs(a.dx - b.dx) >= (a.w + b.w) / 2 - 1e-9;
            const apartY = Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 1e-9;
            expect(apartX || apartY).toBe(true);
          }
        }
      }
    });

    it("uses more than the centre column when films crowd, and only the centre when they do not", () => {
      expect(Math.max(...crowded("shared").films.map((f) => f.col))).toBeGreaterThan(0);
      const sparse = layout([[[1, "1990-01-01"], [2, "2000-01-01"], [3, "2010-01-01"]], [[1, "1990-01-01"], [2, "2000-01-01"], [3, "2010-01-01"]]]);
      expect(sparse.films.every((f) => f.col === 0 && f.dx === 0)).toBe(true);
    });

    it("spreads the collaboration columns left and right of the centre", () => {
      const l = crowded("shared");
      const offsets = new Set(l.films.map((f) => f.dx));
      expect(offsets.has(0)).toBe(true);
      expect(offsets.has(DEPTH.collab.w + DEPTH.colGap)).toBe(true);
    });
  });

  describe("anchorY", () => {
    it("is the first film several people made", () => {
      const l = layout(pair_());
      expect(l.anchorY).toBe(xForDate(l.scale, "2000-01-01"));
    });

    it("is, with two or more people and nothing shared, where the latest-starting person begins", () => {
      const l = layout([[[1, "1980-01-01"], [2, "2010-01-01"]], [[3, "1995-01-01"], [4, "2005-01-01"]]]);
      expect(l.anchorY).toBe(xForDate(l.scale, "1995-01-01"));
    });

    it("ignores a person with no films, and is null for a person on their own and for no films", () => {
      const l = layout([[[1, "1980-01-01"]], []]);
      expect(l.anchorY).toBe(xForDate(l.scale, "1980-01-01"));
      expect(layout([[[1, "1980-01-01"], [2, "1990-01-01"]]]).anchorY).toBeNull();
      expect(layout([[], []]).anchorY).toBeNull();
    });

    function pair_(): [number, string][][] {
      return [
        [[1, "1990-01-01"], [2, "2000-01-01"]],
        [[3, "1985-01-01"], [2, "2000-01-01"]],
      ];
    }
  });
});

describe("anchorScrollTop", () => {
  it("centres the anchor in the viewport", () => {
    expect(anchorScrollTop(2000, 800, 10_000)).toBe(1600);
  });

  it("stays inside the scroll area", () => {
    expect(anchorScrollTop(100, 800, 10_000)).toBe(0);
    expect(anchorScrollTop(9900, 800, 10_000)).toBe(9200);
    expect(anchorScrollTop(500, 800, 600)).toBe(0);
  });

  it("opens at the top without an anchor", () => {
    expect(anchorScrollTop(null, 800, 10_000)).toBe(0);
  });
});
