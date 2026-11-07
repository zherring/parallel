import { describe, expect, it } from "vitest";
import { combineLanes } from "@/lib/combined-track";
import {
  DEPTH,
  SOLO_COLUMNS,
  TIER_MIN_WIDTH,
  anchorScrollTop,
  bandFor,
  blurFor,
  columnIndex,
  columnOffset,
  depthLayout,
  depthSceneCss,
  docCenterX,
  hashUnit,
  isBlurred,
  phoneBlurFor,
  layerDepth,
  layerFactor,
  tierOf,
  xSpec,
  type DepthFilm,
  type DepthTier,
} from "@/lib/depth-layout";
import { projectX } from "@/lib/depth-projection";
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
  it("is above 1 for the films several people made, in front of the screen plane, and decreases with every layer behind it", () => {
    expect(layerFactor(0)).toBeGreaterThan(1);
    expect(layerFactor(0)).toBeCloseTo(1000 / 900, 10);
    const factors = DEPTH.z.map((_, layer) => layerFactor(layer));
    for (let i = 1; i < factors.length; i++) expect(factors[i]).toBeLessThan(factors[i - 1]);
    expect(layerFactor(1)).toBeCloseTo(1000 / 1320, 10);
  });

  it("brings the films several people made 100px forward and keeps the rest behind", () => {
    expect(DEPTH.z[0]).toBe(-100);
    expect(DEPTH.z.slice(1).every((z) => z > 0)).toBe(true);
  });

  it("takes the perspective as a parameter and clamps layers past the table to the last one", () => {
    expect(layerFactor(1, 500)).toBeCloseTo(500 / 820, 10);
    expect(layerDepth(99)).toBe(DEPTH.z[DEPTH.z.length - 1]);
    expect(layerDepth(-3)).toBe(DEPTH.z[0]);
  });
});

describe("a page of one person", () => {
  it("has its person's layer at the screen plane, not 320px back: a factor of 1, level with the rail", () => {
    expect(layerDepth(1, 1)).toBe(DEPTH.singleZ);
    expect(DEPTH.singleZ).toBeGreaterThanOrEqual(-100);
    expect(DEPTH.singleZ).toBeLessThanOrEqual(0);
    expect(layerFactor(1, undefined, 1)).toBe(1);
    // A page of several people is as it was.
    expect(layerDepth(1, 2)).toBe(DEPTH.z[1]);
    expect(layerDepth(1)).toBe(DEPTH.z[1]);
    expect(layerFactor(1, undefined, 3)).toBeCloseTo(1000 / 1320, 10);
  });

  it("is never blurred, so it has no soft image and no focus crossfade", () => {
    // Nothing can be shared on a page of one person, so the first person's layer is the sharp front.
    expect(blurFor(1, false)).toBe(0);
    expect(phoneBlurFor(1, false)).toBe(0);
    expect(isBlurred(1, false)).toBe(false);
  });
});

describe("columnIndex", () => {
  it("counts steps from the centre line: 0, +1, -1, +2, -2", () => {
    expect([0, 1, 2, 3, 4, 5].map(columnIndex)).toEqual([0, 1, -1, 2, -2, 3]);
    expect(columnIndex(-3)).toBe(0);
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

describe("tierOf", () => {
  it("is the spacing of Tailwind's sm and lg breakpoints", () => {
    expect([390, 639].map(tierOf)).toEqual(["phone", "phone"]);
    expect([TIER_MIN_WIDTH.tablet, 800, 1023].map(tierOf)).toEqual(["tablet", "tablet", "tablet"]);
    expect([TIER_MIN_WIDTH.desktop, 1440, 2560].map(tierOf)).toEqual(["desktop", "desktop", "desktop"]);
  });
});

describe("bandFor", () => {
  it("is the middle for one person and the slot's band, a fraction of the stage, for several", () => {
    expect(bandFor(0, 1)).toBe(0.5);
    expect(bandFor(0, 2)).toBe(0.24);
    expect(bandFor(1, 2)).toBe(0.76);
    expect([0, 1, 2].map((slot) => bandFor(slot, 3))).toEqual([0.2, 0.8, 0.5]);
    expect([0, 1, 2, 3].map((slot) => bandFor(slot, 4))).toEqual([0.15, 0.85, 0.35, 0.65]);
  });

  it("draws the bands in towards the middle on a smaller viewport, symmetrically", () => {
    for (const people of [2, 3, 4]) {
      const wide = bandFor(0, people, "desktop");
      const narrow = bandFor(0, people, "phone");
      expect(narrow).toBeGreaterThan(wide);
      expect(narrow).toBeLessThan(0.5);
      expect(bandFor(1, people, "phone") - 0.5).toBeCloseTo(0.5 - narrow, 10);
    }
  });
});

describe("xSpec", () => {
  const tiers: DepthTier[] = ["phone", "tablet", "desktop"];

  it("gives one band per person, and a wider column step to a page of one person", () => {
    for (const tier of tiers) {
      expect(xSpec(tier, 3).bands).toHaveLength(3);
      expect(xSpec(tier, 1).bands).toEqual([0.5]);
      expect(xSpec(tier, 1).stepSolo).toBeGreaterThan(xSpec(tier, 2).stepSolo);
    }
  });

  it("widens the columns and the bands with the viewport", () => {
    expect(xSpec("desktop", 2).stepSolo).toBeGreaterThan(xSpec("phone", 2).stepSolo);
    expect(xSpec("desktop", 2).stepCollab).toBeGreaterThan(xSpec("phone", 2).stepCollab);
    expect(xSpec("desktop", 2).bands[0]).toBeLessThan(xSpec("phone", 2).bands[0]);
  });

  it("keeps the columns of a layer further apart than a poster and the jitter, so none overlap, even on the first layer back (the least shrunk)", () => {
    for (const tier of tiers) {
      for (const people of [1, 2, 3, 4]) {
        const spec = xSpec(tier, people);
        // A page of one person has its own layer at the front (factor 1) and bigger posters, scaled down on a small screen.
        const drawn = people === 1 ? DEPTH.single.w * spec.soloScale : DEPTH.solo.w;
        expect((spec.stepSolo - spec.jitterSpan) / layerFactor(1, undefined, people)).toBeGreaterThanOrEqual(drawn);
        // The posters several people made, as drawn (scaled for the viewport), one step apart in the layer's own space.
        expect(spec.stepCollab / layerFactor(0)).toBeGreaterThanOrEqual(DEPTH.collab.w * spec.collabScale);
      }
    }
  });

  it("draws the posters several people made about 150 x 225 px on a desktop and smaller on a phone, so they fit left of the rail", () => {
    const drawn = (tier: "phone" | "tablet" | "desktop") => {
      const scale = xSpec(tier, 2).collabScale * layerFactor(0);
      return { w: DEPTH.collab.w * scale, h: DEPTH.collab.h * scale };
    };
    expect(drawn("desktop").w).toBeGreaterThan(148);
    expect(drawn("desktop").h).toBeGreaterThan(222);
    expect(drawn("phone").w).toBeLessThan(drawn("tablet").w);
    expect(drawn("tablet").w).toBeLessThan(drawn("desktop").w);
    // Three columns of them side by side (the most a crowd opens that stay on screen) fit a 390px phone's stage, which is
    // 390 less the 28px rail, gutters included.
    const spec = xSpec("phone", 2);
    expect(3 * drawn("phone").w + 2 * spec.gutter).toBeLessThanOrEqual(390 - spec.rail);
  });

  it("draws a page of one person's posters bigger than a page of several's, and fits three columns of them on a 390px phone", () => {
    for (const tier of ["phone", "tablet", "desktop"] as const) {
      expect(DEPTH.single.w * xSpec(tier, 1).soloScale).toBeGreaterThan(DEPTH.solo.w * layerFactor(1));
      // The layer is at the screen plane, so its factor is 1; pages of several keep their own size.
      expect(xSpec(tier, 2).soloScale).toBe(1);
      expect(xSpec(tier, 1).people).toBe(1);
    }
    expect(DEPTH.single.w * xSpec("desktop", 1).soloScale).toBe(120);
    expect(DEPTH.single.h * xSpec("desktop", 1).soloScale).toBe(180);
    const phone = xSpec("phone", 1);
    const w = DEPTH.single.w * phone.soloScale;
    expect(3 * w + 2 * phone.gutter).toBeLessThanOrEqual(390 - phone.rail);
    // Columns one step apart, jitter included, stay clear of each other and inside the stage.
    expect(phone.stepSolo - phone.jitterSpan).toBeGreaterThanOrEqual(w);
    const stage = 390 - phone.rail;
    expect(stage / 2 + phone.stepSolo + w / 2 + phone.jitterSpan / 2).toBeLessThanOrEqual(stage - phone.gutter);
  });

  it("leaves a phone room for the year rail's 28px and a desktop its 60px", () => {
    expect(xSpec("phone", 2).rail).toBe(28);
    expect(xSpec("tablet", 2).rail).toBe(60);
    expect(xSpec("desktop", 2).rail).toBe(60);
  });
});

describe("docCenterX", () => {
  const film = (layer: number, band: number | null, col = 0, jitter = 0, people = 2) => ({
    layer,
    band,
    col,
    jitter,
    w: layer === 0 ? DEPTH.collab.w : people === 1 ? DEPTH.single.w : DEPTH.solo.w,
  });
  /** Where on screen the poster's centre is. */
  const onScreen = (item: ReturnType<typeof film>, width: number, spec: ReturnType<typeof xSpec>) =>
    projectX(docCenterX(item, width, spec), width, layerFactor(item.layer, undefined, spec.people));

  it("puts a band where it was asked for, on screen, whatever the depth of its layer", () => {
    const width = 1440;
    const spec = xSpec("desktop", 2);
    const stage = width - spec.rail;
    expect(onScreen(film(1, 0), width, spec)).toBeCloseTo(stage * 0.24, 6);
    expect(onScreen(film(2, 1), width, spec)).toBeCloseTo(stage * 0.76, 6);
    // The same band on a layer further back lands in the same place: that is what undoing the perspective is for.
    expect(onScreen(film(4, 0), width, spec)).toBeCloseTo(stage * 0.24, 6);
  });

  it("centres the films several people made in the stage, left of the rail", () => {
    for (const [width, tier] of [[1440, "desktop"], [820, "tablet"], [390, "phone"]] as const) {
      const spec = xSpec(tier, 2);
      expect(onScreen(film(0, null), width, spec)).toBeCloseTo((width - spec.rail) / 2, 6);
    }
  });

  it("spreads columns by the step and the jitter by its span, as they are on screen, whatever the layer", () => {
    const width = 1440;
    const spec = xSpec("desktop", 2);
    for (const layer of [1, 2, 3]) {
      const centre = onScreen(film(layer, 0), width, spec);
      expect(onScreen(film(layer, 0, 1), width, spec) - centre).toBeCloseTo(spec.stepSolo, 6);
      expect(onScreen(film(layer, 0, 2), width, spec) - centre).toBeCloseTo(-spec.stepSolo, 6);
      expect(onScreen(film(layer, 0, 0, 0.25), width, spec) - centre).toBeCloseTo(0.25 * spec.jitterSpan, 6);
    }
    expect(onScreen(film(0, null, 1), width, spec) - onScreen(film(0, null), width, spec)).toBeCloseTo(spec.stepCollab, 6);
  });

  it("never lets a poster sit under the rail or past the left edge, however deep its column", () => {
    for (const [width, tier] of [[1440, "desktop"], [1024, "desktop"], [820, "tablet"], [640, "tablet"], [414, "phone"], [390, "phone"], [320, "phone"]] as const) {
      for (const people of [1, 2, 3, 4]) {
        const spec = xSpec(tier, people);
        for (let layer = 0; layer <= people; layer++) {
          const half = (layer === 0 ? DEPTH.collab.w * spec.collabScale : (people === 1 ? DEPTH.single.w : DEPTH.solo.w) * spec.soloScale) / 2;
          for (let slot = 0; slot < people; slot++) {
            for (let col = 0; col < 10; col++) {
              const item = film(layer, layer === 0 ? null : slot, col, 0.5, people);
              const x = onScreen(item, width, spec);
              const f = layerFactor(layer, undefined, people);
              expect(x - half * f).toBeGreaterThanOrEqual(spec.gutter - 1e-6);
              expect(x + half * f).toBeLessThanOrEqual(width - spec.rail - spec.gutter + 1e-6);
            }
          }
        }
      }
    }
  });
});

describe("depthSceneCss", () => {
  it("declares the spacing of each viewport, from the numbers the JS uses", () => {
    const css = depthSceneCss(2);
    for (const tier of ["phone", "tablet", "desktop"] as const) {
      const spec = xSpec(tier, 2);
      expect(css).toContain(`--rail:${spec.rail}px`);
      expect(css).toContain(`--step-solo:${spec.stepSolo}px`);
      expect(css).toContain(`--step-collab:${spec.stepCollab}px`);
      expect(css).toContain(`--collab-scale:${spec.collabScale}`);
      expect(css).toContain(`--band-0:${spec.bands[0]}`);
      expect(css).toContain(`--band-1:${spec.bands[1]}`);
    }
    expect(css).toContain(`@media (min-width:${TIER_MIN_WIDTH.tablet}px)`);
    expect(css).toContain(`@media (min-width:${TIER_MIN_WIDTH.desktop}px)`);
  });

  it("declares one band per person and places posters with one rule", () => {
    expect(depthSceneCss(3)).toContain("--band-2:");
    expect(depthSceneCss(2)).not.toContain("--band-2:");
    expect(depthSceneCss(2).match(/\[data-poster\]\{left:/g)).toHaveLength(1);
  });

  it("is the same every time, for the server and the browser to agree", () => {
    expect(depthSceneCss(4)).toBe(depthSceneCss(4));
  });
});

describe("blurFor", () => {
  it("leaves the front layer sharp and blurs the ones behind it more the further back they are", () => {
    expect([0, 1, 2, 3, 4].map((layer) => blurFor(layer, true))).toEqual([0, 1, 1.5, 1.5, 1.5]);
  });

  it("keeps the first person's layer sharp when nothing is shared, as it is then the front-most", () => {
    expect([0, 1, 2, 3].map((layer) => blurFor(layer, false))).toEqual([0, 0, 1.5, 1.5]);
  });
});

describe("phoneBlurFor", () => {
  it("is a light blur on the first person's layer only, and none further back (the cost is on the phone)", () => {
    expect([0, 1, 2, 3, 4].map((layer) => phoneBlurFor(layer, true))).toEqual([0, 0.75, 0, 0, 0]);
  });

  it("is none where the layer is not blurred at all: nothing shared, so the first person's layer is the sharp front", () => {
    expect([0, 1, 2, 3].map((layer) => phoneBlurFor(layer, false))).toEqual([0, 0, 0, 0]);
  });
});

describe("isBlurred", () => {
  it("is whether blurFor blurs the layer: the focus field only drives those", () => {
    expect([0, 1, 2, 3].map((layer) => isBlurred(layer, true))).toEqual([false, true, true, true]);
    expect([0, 1, 2, 3].map((layer) => isBlurred(layer, false))).toEqual([false, false, true, true]);
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
      expect(byId(l, id)).toMatchObject({ layer: 0, shared: true, band: null, col: 0, jitter: 0, w: DEPTH.collab.w, h: DEPTH.collab.h, slots: [0, 1] });
    }
    expect(l.hasShared).toBe(true);
  });

  it("puts each person's own films on their layer, on their band, jittered by less than half the span", () => {
    const l = layout(pair);
    expect(byId(l, 1)).toMatchObject({ layer: 1, shared: false, band: 0, w: DEPTH.solo.w, h: DEPTH.solo.h });
    expect(byId(l, 3)).toMatchObject({ layer: 2, band: 1 });
    expect(byId(l, 4)).toMatchObject({ layer: 2, band: 1 });
    for (const id of [1, 3, 4]) {
      const f = byId(l, id);
      expect(Math.abs(f.jitter)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(f.y - xForDate(l.scale, f.film.releaseDate))).toBeLessThanOrEqual(DEPTH.rowGap / 2);
    }
    expect(new Set([1, 3, 4].map((id) => byId(l, id).jitter)).size).toBe(3);
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
    expect(byId(l, 2)).toMatchObject({ layer: 2, band: 1 });
    expect(byId(l, 3)).toMatchObject({ layer: 3, band: 2 });
    expect(l.layerCount).toBe(4);
  });

  it("puts an upcoming film several people are making on its first person's layer, at the size of a solo poster", () => {
    const l = layout([[[1, "2030-01-01"]], [[1, "2030-01-01"], [2, "2000-01-01"]]]);
    expect(byId(l, 1)).toMatchObject({ layer: 1, shared: false, slots: [0, 1], w: DEPTH.solo.w, h: DEPTH.solo.h, band: 0 });
    expect(l.hasShared).toBe(false);
  });

  it("keeps one person on one band, all on the first person's layer", () => {
    const l = layout([[[1, "1990-01-01"], [2, "2000-01-01"]]]);
    expect(l.films.map((f) => [f.layer, f.band])).toEqual([
      [1, 0],
      [1, 0],
    ]);
    expect(xSpec("desktop", 1).bands).toEqual([0.5]);
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
    // Nine films a year and a half apart, 204 + 14 px is about 1.7 years: neighbours collide, so they take columns.
    const crowded = (layer: "shared" | "solo") => {
      const dates = Array.from({ length: 9 }, (_, i): [number, string] => [100 + i, `${2000 + Math.floor(i * 0.5)}-0${1 + (i % 2) * 5}-01`]);
      return layer === "shared" ? layout([dates, dates]) : layout([dates, [[1, "1990-01-01"]]]);
    };

    it("lets no two posters of a layer overlap, jitter included, on any viewport", () => {
      for (const l of [crowded("shared"), crowded("solo"), layout([[[1, "2000-01-01"], [2, "2000-02-01"], [3, "2000-03-01"], [4, "2000-04-01"]]])]) {
        for (const tier of ["phone", "tablet", "desktop"] as const) {
          const people = l.layerCount - 1;
          const spec = xSpec(tier, people);
          // Across in the layer's own space: what is chosen on screen, undone by the layer's scale.
          const xOf = (f: DepthFilm) => (columnOffset(f.col, f.layer === 0 ? spec.stepCollab : spec.stepSolo) + f.jitter * spec.jitterSpan) / layerFactor(f.layer, undefined, people);
          for (const a of l.films) {
            for (const b of l.films) {
              if (a === b || a.layer !== b.layer || a.band !== b.band) continue;
              // As drawn: the films several people made are scaled down on a small screen.
              const drawnW = (f: DepthFilm) => f.w * (f.layer === 0 ? spec.collabScale : spec.soloScale);
              const apartX = Math.abs(xOf(a) - xOf(b)) >= (drawnW(a) + drawnW(b)) / 2 - 1e-9;
              const apartY = Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 1e-9;
              expect(apartX || apartY).toBe(true);
            }
          }
        }
      }
    });

    it("keeps the films several people made on the centre line unless they crowd", () => {
      expect(Math.max(...crowded("shared").films.map((f) => f.col))).toBeGreaterThan(0);
      const sparse = layout([[[1, "1990-01-01"], [2, "2000-01-01"], [3, "2010-01-01"]], [[1, "1990-01-01"], [2, "2000-01-01"], [3, "2010-01-01"]]]);
      expect(sparse.films.every((f) => f.col === 0 && f.jitter === 0)).toBe(true);
    });

    it("spreads the collaboration columns left and right of the centre", () => {
      const l = crowded("shared");
      const steps = new Set(l.films.map((f) => columnIndex(f.col)));
      expect(steps.has(0)).toBe(true);
      expect(steps.has(1)).toBe(true);
    });

    it("scatters a person's own films over the columns even when nothing crowds them, and opens more only for a crowd", () => {
      // 40 films, one every 3 years: far enough apart for one column to hold them all.
      const dates = Array.from({ length: 40 }, (_, i): [number, string] => [200 + i, `${1900 + i * 3}-06-01`]);
      const sparse = layout([dates, [[1, "1890-01-01"]]]);
      const cols = new Set(sparse.films.filter((f) => f.layer === 1).map((f) => f.col));
      expect([...cols].sort()).toEqual(Array.from({ length: SOLO_COLUMNS }, (_, i) => i));
      // A dozen films in a year need more than three columns at 120 + 14 px each.
      const dense = layout([Array.from({ length: 12 }, (_, i): [number, string] => [300 + i, `2000-0${1 + (i % 9)}-15`]), [[1, "1990-01-01"]]]);
      expect(Math.max(...dense.films.filter((f) => f.layer === 1).map((f) => f.col))).toBeGreaterThanOrEqual(SOLO_COLUMNS);
    });

    it("scatters the same way every time", () => {
      const dates = Array.from({ length: 40 }, (_, i): [number, string] => [200 + i, `${1900 + i * 3}-06-01`]);
      expect(layout([dates, [[1, "1890-01-01"]]]).films.map((f) => f.col)).toEqual(layout([dates, [[1, "1890-01-01"]]]).films.map((f) => f.col));
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
