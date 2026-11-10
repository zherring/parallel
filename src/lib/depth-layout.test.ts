import { describe, expect, it } from "vitest";
import { combineLanes } from "@/lib/combined-track";
import * as layoutExports from "@/lib/depth-layout";
import {
  COLLAB_SIZE,
  DEPTH,
  OBSCURITY_CUES,
  PULL,
  SOLO_COLUMNS,
  TIER_MIN_WIDTH,
  anchorScrollTop,
  bandFor,
  columnIndex,
  collabHeight,
  collabStep,
  collabWidth,
  columnOffset,
  depthLayout,
  depthPush,
  depthSceneCss,
  docCenterX,
  hashUnit,
  layerDepth,
  layerFactor,
  obscurityOf,
  posterFactor,
  pullFor,
  restOpacityFor,
  tierOf,
  xSpec,
  type DepthFilm,
  type DepthTier,
} from "@/lib/depth-layout";
import { MINOR_OBSCURITY } from "@/lib/depth-minor";
import { projectX } from "@/lib/depth-projection";
import { personSlots } from "@/lib/person-colors";
import { xForDate } from "@/lib/timeline-layout";
import type { Film } from "@/lib/types";

const TODAY = "2026-01-01";

/** A film and (optionally) its vote count: the third entry of a `[id, date, votes]` triple. */
type FilmSpec = [id: number, date: string, votes?: number];

function film(id: number, releaseDate: string, votes = 0): Film {
  return {
    id,
    title: `Film ${id}`,
    releaseDate,
    year: Number(releaseDate.slice(0, 4)),
    posterPath: null,
    voteCount: votes,
    credits: [{ role: "director", job: "Director", minor: false }],
    minor: false,
  };
}

/** The entries of `combineLanes` for people 10, 20, 30 ... with the films given by id/date. */
function entriesOf(lanes: FilmSpec[][]) {
  const people = lanes.map((_, i) => ({ id: (i + 1) * 10 }));
  const made = lanes.map((films, i) => ({ person: people[i], films: films.map(([id, date, votes]) => film(id, date, votes)) }));
  return { entries: combineLanes(made, personSlots(people), TODAY), peopleCount: people.length };
}

const layout = (lanes: FilmSpec[][]) => {
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
    expect(layerFactor(1)).toBeCloseTo(DEPTH.perspective / (DEPTH.perspective + DEPTH.z[1]), 10);
  });

  it("brings the films several people made 100px forward and keeps the rest behind", () => {
    expect(DEPTH.z[0]).toBe(-100);
    expect(DEPTH.z.slice(1).every((z) => z > 0)).toBe(true);
  });

  it("takes the perspective as a parameter and clamps layers past the table to the last one", () => {
    expect(layerFactor(1, 500)).toBeCloseTo(500 / (500 + DEPTH.z[1]), 10);
    expect(layerDepth(99)).toBe(DEPTH.z[DEPTH.z.length - 1]);
    expect(layerDepth(-3)).toBe(DEPTH.z[0]);
  });
});

describe("a page of one person", () => {
  it("has its person's layer at the screen plane, not set back with the other layers: a factor of 1, level with the rail", () => {
    expect(layerDepth(1, 1)).toBe(DEPTH.singleZ);
    expect(DEPTH.singleZ).toBeGreaterThanOrEqual(-100);
    expect(DEPTH.singleZ).toBeLessThanOrEqual(0);
    expect(layerFactor(1, undefined, 1)).toBe(1);
    // A page of several people is as it was.
    expect(layerDepth(1, 2)).toBe(DEPTH.z[1]);
    expect(layerDepth(1)).toBe(DEPTH.z[1]);
    expect(layerFactor(1, undefined, 3)).toBeCloseTo(DEPTH.perspective / (DEPTH.perspective + DEPTH.z[1]), 10);
  });

  it("has no obscurity cue: its posters are level, opaque and not background, whatever their votes", () => {
    const l = layout([[[1, "1990-01-01", 90_000], [2, "2000-01-01", 3], [3, "2005-01-01", 0]]]);
    for (const poster of l.films) {
      expect(poster).toMatchObject({ obscurity: 0, push: 0, depth: DEPTH.singleZ, background: false });
      expect(posterFactor(poster)).toBe(1);
    }
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

  it("draws the bands in towards the middle on a tablet, symmetrically", () => {
    for (const people of [2, 3, 4]) {
      const wide = bandFor(0, people, "desktop");
      const narrow = bandFor(0, people, "tablet");
      expect(narrow).toBeGreaterThan(wide);
      expect(narrow).toBeLessThan(0.5);
      expect(bandFor(1, people, "tablet") - 0.5).toBeCloseTo(0.5 - narrow, 10);
    }
  });

  it("does not draw them in on a phone: three or four people's columns have 362px to share, and bands any closer interleave them", () => {
    // Measured on the real trio and quartet pages at 390 (the screens' mean overlap of the posters of different people, whole scroll): bands drawn in to
    // 0.8 (a tablet's 0.9 is not enough room either) overlapped about 50% more on three people and a third more on four than the bands at the
    // desktop's proportions; wider than them, the columns pile at the gutters and it is worse again.
    for (const people of [2, 3, 4]) for (const slot of [0, 1, people - 1]) expect(bandFor(slot, people, "phone")).toBe(bandFor(slot, people, "desktop"));
    const stage = 390 - xSpec("phone", 3).rail;
    const [first, second, third] = xSpec("phone", 3).bands;
    // Neighbouring people's bands (the first and the third of three) are over 100px apart on the stage, where the columns around them are 70px.
    expect((third - first) * stage).toBeGreaterThan(100);
    expect((second - third) * stage).toBeGreaterThan(100);
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

  it("widens the columns with the viewport, and the bands from a tablet's to a desktop's", () => {
    expect(xSpec("desktop", 2).stepSolo).toBeGreaterThan(xSpec("phone", 2).stepSolo);
    expect(xSpec("desktop", 2).stepCollab).toBeGreaterThan(xSpec("phone", 2).stepCollab);
    expect(xSpec("desktop", 2).bands[0]).toBeLessThan(xSpec("tablet", 2).bands[0]);
  });

  // With the first layer back at `DEPTH.z[1]` a phone's posters are drawn bigger than its column step (70px) less the jitter (8px) clears:
  // two neighbours at the extremes of the jitter overlap by about 7.7px of a 70px poster. Raise the phone's `stepSolo` to ~78 to close it.
  const PHONE_NEIGHBOUR_OVERLAP = 8;

  it("keeps the columns of a layer further apart than a poster and the jitter, so none overlap (a phone's, at the extremes of the jitter, by a few px), even on the first layer back (the least shrunk)", () => {
    for (const tier of tiers) {
      for (const people of [1, 2, 3, 4]) {
        const spec = xSpec(tier, people);
        // A page of one person has its own layer at the front (factor 1) and bigger posters, scaled down on a small screen.
        const drawn = people === 1 ? DEPTH.single.w * spec.soloScale : DEPTH.solo.w;
        // On screen, two neighbours at the extremes of the jitter are a step less a span apart, and a poster is `drawn` times the factor wide.
        const overlap = drawn * layerFactor(1, undefined, people) - (spec.stepSolo - spec.jitterSpan);
        expect(overlap).toBeLessThanOrEqual(tier === "phone" && people > 1 ? PHONE_NEIGHBOUR_OVERLAP : 0);
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
  /** A poster of `layer`, pushed `push` px behind its layer's plane (its obscurity's doing). */
  const film = (layer: number, band: number | null, col = 0, jitter = 0, people = 2, push = 0) => ({
    layer,
    band,
    col,
    jitter,
    w: layer === 0 ? DEPTH.collab.w : people === 1 ? DEPTH.single.w : DEPTH.solo.w,
    depth: layerDepth(layer, people) + push,
  });
  /** Where on screen the poster's centre is. */
  const onScreen = (item: ReturnType<typeof film>, width: number, spec: ReturnType<typeof xSpec>) =>
    projectX(docCenterX(item, width, spec), width, posterFactor(item));

  it("puts a band where it was asked for, on screen, whatever the depth of its layer", () => {
    const width = 1440;
    const spec = xSpec("desktop", 2);
    const stage = width - spec.rail;
    expect(onScreen(film(1, 0), width, spec)).toBeCloseTo(stage * 0.24, 6);
    expect(onScreen(film(2, 1), width, spec)).toBeCloseTo(stage * 0.76, 6);
    // The same band on a layer further back lands in the same place: that is what undoing the perspective is for.
    expect(onScreen(film(4, 0), width, spec)).toBeCloseTo(stage * 0.24, 6);
  });

  it("undoes the poster's own perspective, not its layer's: an obscure film pushed back within its layer lands on the same band", () => {
    const width = 1440;
    const spec = xSpec("desktop", 2);
    const stage = width - spec.rail;
    for (const push of [0, DEPTH.spread / 4, DEPTH.spread / 2, DEPTH.spread]) {
      expect(onScreen(film(1, 0, 0, 0, 2, push), width, spec)).toBeCloseTo(stage * 0.24, 6);
      expect(onScreen(film(2, 1, 0, 0, 2, push), width, spec)).toBeCloseTo(stage * 0.76, 6);
      expect(onScreen(film(1, 0, 1, 0.25, 2, push), width, spec) - onScreen(film(1, 0, 0, 0, 2, push), width, spec)).toBeCloseTo(spec.stepSolo + 0.25 * spec.jitterSpan, 6);
    }
    // In its own plane the further back it is pushed the further from the middle it is (that is the compensation), though not on screen.
    const near = docCenterX(film(1, 0), width, spec);
    const far = docCenterX(film(1, 0, 0, 0, 2, DEPTH.spread), width, spec);
    expect(Math.abs(far - width / 2)).toBeGreaterThan(Math.abs(near - width / 2));
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
              // A background poster at either end of its layer's depth: the nearest and the most obscure.
              for (const push of layer === 0 || people === 1 ? [0] : [0, DEPTH.spread]) {
                const item = film(layer, layer === 0 ? null : slot, col, 0.5, people, push);
                const x = onScreen(item, width, spec);
                const f = posterFactor(item);
                expect(x - half * f).toBeGreaterThanOrEqual(spec.gutter - 1e-6);
                expect(x + half * f).toBeLessThanOrEqual(width - spec.rail - spec.gutter + 1e-6);
              }
            }
          }
        }
      }
    }
  });
});

describe("the size of the films made together", () => {
  it("is 136px wide on a window of 1440 or less, as it always was, and 2:3", () => {
    expect(COLLAB_SIZE).toEqual({ min: 136, vmax: 9.4444, max: 230, aspect: 1.5 });
    for (const vmax of [0, 320, 390, 768, 1024, 1366]) expect(collabWidth(vmax)).toBe(136);
    // Exactly the 136 it was at 1440 (and a hair over it just past: 9.4444% of 1441 is 136.09).
    expect(collabWidth(1440)).toBe(136);
    expect(collabHeight(1366)).toBe(204);
    expect(DEPTH.collab).toEqual({ w: 136, h: 204 });
  });

  it("grows with the larger side of the viewport: about a third larger at 1920 (a 1080 screen), and no larger than 230px (from about 2430)", () => {
    expect(collabWidth(1920) / collabWidth(1440)).toBeCloseTo(4 / 3, 3);
    expect(collabWidth(1920)).toBeCloseTo(181.33, 2);
    expect(collabHeight(1920)).toBeCloseTo(272, 1);
    expect(collabWidth(2430)).toBeLessThan(230);
    expect(collabWidth(2560)).toBe(230);
    expect(collabWidth(7680)).toBe(230);
    expect(collabHeight(7680)).toBe(DEPTH.collabMax.h);
    // Never smaller as the screen gets larger.
    let last = 0;
    for (let vmax = 0; vmax <= 4000; vmax += 40) {
      expect(collabWidth(vmax)).toBeGreaterThanOrEqual(last);
      last = collabWidth(vmax);
    }
  });

  it("is the largest the layout lays out: the packing and the pad are for DEPTH.collabMax", () => {
    expect(DEPTH.collabMax).toEqual({ w: COLLAB_SIZE.max, h: COLLAB_SIZE.max * COLLAB_SIZE.aspect });
    expect(collabHeight(Number.POSITIVE_INFINITY)).toBe(DEPTH.collabMax.h);
  });

  it("leaves a phone's alone: 136px whatever its size, its step as it was, and a tablet's and desktop's growing in step with the posters", () => {
    const phone = xSpec("phone", 2);
    expect(phone.collabFluid).toBe(false);
    for (const vmax of [390, 844, 1100]) {
      expect(collabWidth(vmax, phone.collabFluid)).toBe(136);
      expect(collabStep(phone, vmax)).toBe(phone.stepCollab);
    }
    for (const tier of ["tablet", "desktop"] as const) {
      const spec = xSpec(tier, 2);
      expect(spec.collabFluid).toBe(true);
      expect(collabStep(spec, 1000)).toBe(spec.stepCollab);
      // The same ratio as the posters.
      for (const vmax of [1440, 1920, 2560, 4000]) expect(collabStep(spec, vmax) / spec.stepCollab).toBeCloseTo(collabWidth(vmax) / 136, 9);
    }
    expect(collabStep(xSpec("desktop", 2), 1920)).toBeCloseTo(221.5, 0);
    expect(collabStep(xSpec("desktop", 2), 2560)).toBeCloseTo(280.7, 1);
  });

  it("keeps the columns further apart than the posters, on every screen: the step grown with them clears them, as the smallest step clears the smallest", () => {
    for (const tier of ["tablet", "desktop"] as const) {
      const spec = xSpec(tier, 2);
      for (const vmax of [1024, 1440, 1920, 2560, 3840]) {
        expect(collabStep(spec, vmax) / layerFactor(0)).toBeGreaterThanOrEqual(collabWidth(vmax) * spec.collabScale - 1e-9);
      }
    }
  });

  it("places the films made together by the grown step and kept inside the stage by the grown width", () => {
    const spec = xSpec("desktop", 2);
    const item = (col: number) => ({ layer: 0, band: null, col, jitter: 0, w: DEPTH.collab.w, depth: layerDepth(0, 2) });
    const onScreen = (col: number, width: number, vmax: number) => projectX(docCenterX(item(col), width, spec, vmax), width, posterFactor(item(col)));
    // At 1920 a column over is the grown step away on screen (it is 166px at 1440 and 1.33 times that at 1920), where without `vmax` it is the smallest.
    expect(onScreen(1, 1920, 1920) - onScreen(0, 1920, 1920)).toBeCloseTo(collabStep(spec, 1920), 6);
    expect(onScreen(1, 1920, 0) - onScreen(0, 1920, 0)).toBeCloseTo(spec.stepCollab, 6);
    // A deep column is held inside the stage by the poster as drawn (the larger one).
    for (const col of [1, 2, 3, 4, 7]) {
      const half = (collabWidth(2560) * spec.collabScale * posterFactor(item(col))) / 2;
      const x = onScreen(col, 2560, 2560);
      expect(x - half).toBeGreaterThanOrEqual(spec.gutter - 1e-6);
      expect(x + half).toBeLessThanOrEqual(2560 - spec.rail - spec.gutter + 1e-6);
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
      // A tablet's and a desktop's films made together grow with the viewport (clamped, in vmax: the viewport's larger side) and their column step with them; a phone's do not.
      if (spec.collabFluid) {
        expect(css).toContain(`--step-collab:clamp(${spec.stepCollab}px,`);
      } else {
        expect(css).toContain(`--step-collab:${spec.stepCollab}px`);
      }
      expect(css).toContain(`--collab-scale:${spec.collabScale}`);
      expect(css).toContain(`--band-0:${spec.bands[0]}`);
      expect(css).toContain(`--band-1:${spec.bands[1]}`);
    }
    expect(css).toContain(`@media (min-width:${TIER_MIN_WIDTH.tablet}px)`);
    expect(css).toContain(`@media (min-width:${TIER_MIN_WIDTH.desktop}px)`);
  });

  it("sizes the films made together with one clamp of the viewport's larger side (tablet and desktop), and a phone's fixed", () => {
    const css = depthSceneCss(2);
    // 136px up to a 1440 window, 9.4444% of the larger side after it, 230px at most; the same text for a tablet and a desktop (it is the same clamp).
    expect(css.match(/--collab-w:clamp\(136px,9\.4444vmax,230px\)/g)).toHaveLength(2);
    // The one phone rule has them fixed, and no vmax anywhere in it.
    const phone = css.slice(0, css.indexOf("@media"));
    expect(phone).toContain("--collab-w:136px");
    expect(phone).not.toContain("vmax");
    // The step grows by the same ratio: the desktop's 166px over the posters' 136px, in vmax, to the cap's step.
    expect(css).toContain("--step-collab:clamp(166px,11.528vmax,280.735px)");
    expect(css).toContain("--step-collab:clamp(146px,10.139vmax,246.912px)");
  });

  it("centres the films made together on their y with their own height (a transform), and sizes them in CSS, so the markup is one for every viewport", () => {
    const css = depthSceneCss(2);
    // The rule that places a poster across uses `--w` and `--ps`, which the films made together set from `--collab-w`.
    expect(css).toContain("var(--w) * var(--ps) / 2");
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

describe("obscurityOf", () => {
  const MAX = 26_892;

  it("is 0 for the best-known film, 1 for a film with 0 or 1 votes, and in between for the rest", () => {
    expect(obscurityOf(MAX, MAX)).toBe(0);
    expect(obscurityOf(0, MAX)).toBe(1);
    expect(obscurityOf(1, MAX)).toBe(1);
    for (const votes of [2, 3, 5, 20, 100, 307, 1000, 7907, 14_990, 26_000]) {
      const o = obscurityOf(votes, MAX);
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThan(1);
    }
  });

  it("follows the logarithm of the votes: each tenfold in votes is the same step", () => {
    const step = obscurityOf(10, 100_000) - obscurityOf(100, 100_000);
    expect(step).toBeCloseTo(0.2, 10);
    expect(obscurityOf(100, 100_000) - obscurityOf(1000, 100_000)).toBeCloseTo(step, 10);
    expect(obscurityOf(1000, 100_000) - obscurityOf(10_000, 100_000)).toBeCloseTo(step, 10);
  });

  it("never scores a film with more votes higher, and gives films with the same votes the same score", () => {
    const votes = [0, 1, 1, 2, 3, 7, 7, 40, 41, 300, 5000, 5000, 26_892];
    const scores = votes.map((v) => obscurityOf(v, MAX));
    for (let i = 1; i < votes.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      if (votes[i] === votes[i - 1]) expect(scores[i]).toBe(scores[i - 1]);
    }
    expect(scores.every((o) => o >= 0 && o <= 1)).toBe(true);
  });

  it("stays between 0 and 1 for votes beyond the maximum, and for nonsense", () => {
    expect(obscurityOf(MAX * 10, MAX)).toBe(0);
    expect(obscurityOf(-5, MAX)).toBe(1);
    expect(obscurityOf(Number.NaN, MAX)).toBe(1);
    expect(obscurityOf(100, Number.NaN)).toBe(1);
    expect(obscurityOf(Number.POSITIVE_INFINITY, MAX)).toBe(1);
  });

  it("scores every film alike when nothing on the page has more than one vote (all zero: all obscure, none divides by ln 1)", () => {
    for (const max of [0, 1]) {
      for (const votes of [0, 1]) expect(obscurityOf(votes, max)).toBe(1);
    }
    expect(obscurityOf(0, 0)).toBe(1);
  });

  it("scores a page of equally voted films as the best-known: all 0", () => {
    for (const votes of [2, 100, 5000]) expect(obscurityOf(votes, votes)).toBe(0);
  });

  it("spreads a typical filmography over the whole range (Scorsese's, from TMDB's votes)", () => {
    // Every fifth film of his, from the most-voted to the least; the page's most-voted film is 26,892.
    const votes = [26_892, 7843, 4975, 2390, 1270, 611, 426, 275, 153, 72, 46, 19, 7, 2, 0];
    const scores = votes.map((v) => obscurityOf(v, MAX));
    expect(scores[0]).toBe(0);
    expect(scores[scores.length - 1]).toBe(1);
    // Neither bunched at the famous end nor at the obscure one.
    expect(scores.filter((o) => o < 0.34).length).toBeGreaterThanOrEqual(4);
    expect(scores.filter((o) => o >= 0.34 && o < 0.67).length).toBeGreaterThanOrEqual(4);
    expect(scores.filter((o) => o >= 0.67).length).toBeGreaterThanOrEqual(4);
  });
});

describe("what obscurity does to a poster", () => {
  const range = Array.from({ length: 21 }, (_, i) => i / 20);

  it("pushes a poster back from its layer's plane: nothing for the best-known, the spread for the most obscure, more the more obscure", () => {
    expect(depthPush(0)).toBe(0);
    expect(depthPush(1)).toBe(DEPTH.spread);
    expect(depthPush(0.5)).toBe(DEPTH.spread / 2);
    expect(DEPTH.spread).toBeGreaterThanOrEqual(250);
    expect(DEPTH.spread).toBeLessThanOrEqual(400);
    const pushes = range.map(depthPush);
    for (let i = 1; i < pushes.length; i++) expect(pushes[i]).toBeGreaterThan(pushes[i - 1]);
  });

  it("fades a background poster from 0.56 at rest for the best-known to 0.315 for the most obscure: 0.7 of what it was", () => {
    expect(OBSCURITY_CUES.opacity).toEqual({ best: 0.56, worst: 0.315 });
    // The old range (0.8 down to 0.45) at 70%.
    expect(OBSCURITY_CUES.opacity.best).toBeCloseTo(0.8 * 0.7, 10);
    expect(OBSCURITY_CUES.opacity.worst).toBeCloseTo(0.45 * 0.7, 10);
    expect(restOpacityFor(0)).toBe(0.56);
    expect(restOpacityFor(1)).toBeCloseTo(0.315, 10);
    expect(restOpacityFor(0.5)).toBeCloseTo(0.4375, 10);
    const opacities = range.map(restOpacityFor);
    for (let i = 1; i < opacities.length; i++) expect(opacities[i]).toBeLessThan(opacities[i - 1]);
  });

  it("has no blur at all: obscurity is the poster's depth and its opacity, and nothing else", () => {
    expect(Object.keys(OBSCURITY_CUES)).toEqual(["opacity"]);
    expect(Object.keys(layoutExports)).not.toContain("blurFor");
    expect(Object.keys(layoutExports)).not.toContain("phoneBlurFor");
  });

  it("clamps an obscurity outside 0 to 1, and one that is not a number is the best-known", () => {
    expect([depthPush(-1), depthPush(2)]).toEqual([0, DEPTH.spread]);
    expect([restOpacityFor(-1), restOpacityFor(2)]).toEqual([OBSCURITY_CUES.opacity.best, OBSCURITY_CUES.opacity.worst]);
    expect([depthPush(Number.NaN), restOpacityFor(Number.NaN)]).toEqual([0, OBSCURITY_CUES.opacity.best]);
  });
});

describe("minor films", () => {
  const FAMOUS_CAMEO = 9;
  const lanes: FilmSpec[][] = [
    [[1, "1990-01-01", 20_000], [2, "1995-01-01", 400], [FAMOUS_CAMEO, "2000-01-01", 500_000]],
    [[4, "1991-01-01", 9000], [5, "1996-01-01", 30]],
  ];
  const withMinor = (people: FilmSpec[][], minor: number[]) => {
    const { entries, peopleCount } = entriesOf(people);
    return depthLayout(entries, peopleCount, TODAY, { minorIds: new Set(minor) });
  };

  it("are background posters, at least as faint and far back as MINOR_OBSCURITY says, whatever their votes", () => {
    const l = withMinor(lanes, [FAMOUS_CAMEO]);
    const cameo = byId(l, FAMOUS_CAMEO);
    expect(cameo.background).toBe(true);
    expect(cameo.obscurity).toBe(MINOR_OBSCURITY);
    expect(cameo.push).toBe(depthPush(MINOR_OBSCURITY));
    expect(cameo.depth).toBe(layerDepth(cameo.layer, 2) + cameo.push);
    expect(posterFactor(cameo)).toBeLessThan(posterFactor(byId(l, 1)));
  });

  it("do not move the scale of the page's own work: a cameo in a famous film leaves every other poster as it was", () => {
    const without = layout(lanes.map((films) => films.filter(([id]) => id !== FAMOUS_CAMEO)));
    const l = withMinor(lanes, [FAMOUS_CAMEO]);
    for (const { film: { id } } of without.films) expect(byId(l, id).obscurity).toBe(byId(without, id).obscurity);
  });

  it("keep a more obscure film more obscure than the floor", () => {
    const l = withMinor([[[1, "1990-01-01", 20_000], [2, "1995-01-01", 0]], [[4, "1991-01-01", 9000]]], [2]);
    expect(byId(l, 2).obscurity).toBe(1);
  });

  it("are background posters on a page of one person too, where every other poster is sharp, opaque and level", () => {
    const l = withMinor([[[1, "1990-01-01", 20_000], [2, "1995-01-01", 400], [3, "2000-01-01", 90_000]]], [3]);
    expect(byId(l, 1)).toMatchObject({ background: false, obscurity: 0, push: 0 });
    expect(byId(l, 2)).toMatchObject({ background: false, obscurity: 0, push: 0 });
    expect(byId(l, 3)).toMatchObject({ background: true, obscurity: MINOR_OBSCURITY, depth: DEPTH.singleZ + depthPush(MINOR_OBSCURITY) });
  });

  it("change nothing when there are none", () => {
    const { entries, peopleCount } = entriesOf(lanes);
    expect(depthLayout(entries, peopleCount, TODAY, { minorIds: new Set() })).toEqual(depthLayout(entries, peopleCount, TODAY));
  });
});

describe("posterFactor", () => {
  it("is the perspective over the perspective plus the poster's own depth", () => {
    expect(posterFactor({ depth: 0 })).toBe(1);
    expect(posterFactor({ depth: -100 })).toBeCloseTo(1000 / 900, 10);
    expect(posterFactor({ depth: DEPTH.z[1] })).toBeCloseTo(layerFactor(1), 10);
    expect(posterFactor({ depth: DEPTH.z[1] + DEPTH.spread })).toBeCloseTo(1000 / (1000 + DEPTH.z[1] + DEPTH.spread), 10);
    expect(posterFactor({ depth: 500 }, 500)).toBeCloseTo(0.5, 10);
  });

  it("is smaller for a poster pushed back within its layer, and bounded by the layer's factor", () => {
    for (const layer of [1, 2, 3, 4]) {
      const base = posterFactor({ depth: layerDepth(layer) });
      expect(base).toBeCloseTo(layerFactor(layer), 10);
      let last = base;
      for (const o of [0.25, 0.5, 0.75, 1]) {
        const f = posterFactor({ depth: layerDepth(layer) + depthPush(o) });
        expect(f).toBeLessThan(last);
        last = f;
      }
    }
  });
});

describe("the cloud of a person's films", () => {
  // Scorsese-like: one famous film, some middling, one with no votes; Schoonmaker-like on the other layer; one shared film (layer 0, not counted).
  const pair: FilmSpec[][] = [
    [[1, "1990-01-01", 20_000], [2, "1995-01-01", 400], [3, "2000-01-01", 0], [9, "2005-01-01", 90_000]],
    [[4, "1991-01-01", 9000], [5, "1996-01-01", 30], [9, "2005-01-01", 90_000]],
  ];

  it("measures obscurity against the most-voted background film of the page, not against a film several people made", () => {
    const l = layout(pair);
    // 9 (90,000 votes) is shared, so layer 0: it neither has a cue nor sets the scale.
    expect(byId(l, 9)).toMatchObject({ layer: 0, obscurity: 0, push: 0, depth: DEPTH.z[0], background: false });
    expect(byId(l, 1).obscurity).toBe(0);
    expect(byId(l, 3).obscurity).toBe(1);
    expect(byId(l, 2).obscurity).toBeCloseTo(1 - Math.log(400) / Math.log(20_000), 10);
    // The other person's films are measured on the same scale: 9,000 votes is a little more obscure than 20,000.
    expect(byId(l, 4).obscurity).toBeCloseTo(1 - Math.log(9000) / Math.log(20_000), 10);
    expect(byId(l, 4).obscurity).toBeGreaterThan(0);
    expect(byId(l, 5).obscurity).toBeGreaterThan(byId(l, 2).obscurity);
  });

  it("gives each background poster the depth of its layer plus a push by its obscurity, and a factor of its own", () => {
    const l = layout(pair);
    for (const poster of l.films.filter((f) => f.background)) {
      expect(poster.layer).toBeGreaterThan(0);
      expect(poster.push).toBe(depthPush(poster.obscurity));
      expect(poster.depth).toBe(layerDepth(poster.layer, 2) + poster.push);
    }
    // Two of the first person's posters, one famous and one with no votes, are `DEPTH.spread` apart in depth and so differ in factor.
    expect(byId(l, 1).depth).toBe(DEPTH.z[1]);
    expect(byId(l, 3).depth).toBe(DEPTH.z[1] + DEPTH.spread);
    expect(posterFactor(byId(l, 3))).toBeLessThan(posterFactor(byId(l, 1)));
    expect(posterFactor(byId(l, 1))).toBeCloseTo(layerFactor(1), 10);
  });

  it("keeps the order of the people: the best-known of each is on its layer's plane, and the ranges overlap by at most a little", () => {
    for (let layer = 1; layer < DEPTH.z.length - 1; layer++) {
      // The nearest a person's film can be is its layer's plane, so the best-known films of person 1 are in front of person 2's.
      expect(DEPTH.z[layer]).toBeLessThan(DEPTH.z[layer + 1]);
      const overlap = DEPTH.z[layer] + DEPTH.spread - DEPTH.z[layer + 1];
      expect(overlap).toBeLessThanOrEqual(DEPTH.spread / 2);
    }
    // The first two people, the pair that every page of two or three has, do not overlap at all.
    expect(DEPTH.z[1] + DEPTH.spread).toBeLessThanOrEqual(DEPTH.z[2]);
    // And a person's films never come nearer than their layer's plane nor go further back than the spread.
    const l = layout([
      Array.from({ length: 20 }, (_, i): FilmSpec => [100 + i, `${1980 + i}-01-01`, Math.floor(10 ** (i / 4))]),
      Array.from({ length: 20 }, (_, i): FilmSpec => [200 + i, `${1980 + i}-06-01`, Math.floor(10 ** (i / 4))]),
      [[300, "1990-01-01", 5]],
    ]);
    for (const poster of l.films) {
      expect(poster.depth).toBeGreaterThanOrEqual(layerDepth(poster.layer, 3));
      expect(poster.depth).toBeLessThanOrEqual(layerDepth(poster.layer, 3) + DEPTH.spread);
    }
    const first = l.films.filter((f) => f.layer === 1);
    const second = l.films.filter((f) => f.layer === 2);
    // Person 1's median film is still in front of person 2's.
    const median = (posters: DepthFilm[]) => [...posters].map((f) => f.depth).sort((a, b) => a - b)[Math.floor(posters.length / 2)];
    expect(median(first)).toBeLessThan(median(second));
  });

  it("treats every film of a page of several people as background when nothing is shared, and none of a page of one person's", () => {
    const apart = layout([[[1, "1990-01-01", 500], [2, "2000-01-01", 5]], [[3, "1995-01-01", 80]]]);
    expect(apart.hasShared).toBe(false);
    expect(apart.films.every((f) => f.background)).toBe(true);
    expect(byId(apart, 1).obscurity).toBe(0);
    expect(byId(apart, 2).obscurity).toBeGreaterThan(0.5);
    const alone = layout([[[1, "1990-01-01", 500], [2, "2000-01-01", 5]]]);
    expect(alone.films.every((f) => !f.background && f.obscurity === 0 && f.push === 0)).toBe(true);
  });

  it("gives films with the same votes the same cue, and a page where every film has none the most obscure", () => {
    const l = layout([[[1, "1990-01-01", 70], [2, "2000-01-01", 70]], [[3, "1995-01-01", 70], [4, "1999-01-01", 5]]]);
    expect(new Set([1, 2, 3].map((id) => byId(l, id).obscurity))).toEqual(new Set([0]));
    expect(byId(l, 4).obscurity).toBeGreaterThan(0);
    const none = layout([[[1, "1990-01-01"], [2, "2000-01-01"]], [[3, "1995-01-01"]]]);
    expect(none.films.every((f) => f.obscurity === 1 && f.push === DEPTH.spread)).toBe(true);
  });

  it("puts the cue on an upcoming film several people are making, as on any film of the first person's layer", () => {
    const l = layout([[[1, "2030-01-01", 0], [2, "2000-01-01", 900]], [[1, "2030-01-01", 0], [3, "1999-01-01", 40]]]);
    expect(byId(l, 1)).toMatchObject({ layer: 1, background: true, obscurity: 1 });
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
          // Across on screen: what is chosen on screen is the same for every depth, and a poster is drawn `f` times its width.
          const xOf = (f: DepthFilm) => columnOffset(f.col, f.layer === 0 ? spec.stepCollab : spec.stepSolo) + f.jitter * spec.jitterSpan;
          for (const a of l.films) {
            for (const b of l.films) {
              if (a === b || a.layer !== b.layer || a.band !== b.band) continue;
              // As drawn: the films several people made are scaled down on a small screen.
              const drawnW = (f: DepthFilm) => f.w * (f.layer === 0 ? spec.collabScale : spec.soloScale) * posterFactor(f);
              const apartX = Math.abs(xOf(a) - xOf(b)) >= (drawnW(a) + drawnW(b)) / 2 - 1e-9;
              // (Down the axis it is the layer's own space: posters of one layer at different depths do cross on screen, by parallax.)
              const apartY = Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 1e-9;
              expect(apartX || apartY).toBe(true);
            }
          }
        }
      }
    });

    it("the films made together never overlap, at any width: two in a column are a poster and its label apart, and two in different columns are a poster apart across, at every size the clamp reaches", () => {
      const sparse = layout([[[1, "1990-01-01"], [2, "2000-01-01"], [3, "2010-01-01"]], [[1, "1990-01-01"], [2, "2000-01-01"], [3, "2010-01-01"]]]);
      // Dense: a film every four months for nine years (about a third of a poster's height apart at 128px a year), and every ~6 months, and a real-looking cluster.
      const monthly = Array.from({ length: 28 }, (_, i): [number, string] => [200 + i, `${2000 + Math.floor((i * 4) / 12)}-${String(1 + ((i * 4) % 12)).padStart(2, "0")}-01`]);
      const cluster = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n): [number, string] => [300 + n, `${1970 + (n % 3)}-0${1 + (n % 9)}-15`]);
      for (const l of [crowded("shared"), sparse, layout([monthly, monthly]), layout([cluster, cluster])]) {
        const collab = l.films.filter((f) => f.layer === 0);
        expect(collab.length).toBeGreaterThan(2);
        for (const tier of ["phone", "tablet", "desktop"] as const) {
          const spec = xSpec(tier, 2);
          // From a phone, through the 1440 window the sizes were laid out for, to the largest and beyond.
          for (const vmax of [390, 844, 1024, 1440, 1920, 2560, 3840, 7680]) {
            const w = collabWidth(vmax, spec.collabFluid);
            const h = collabHeight(vmax, spec.collabFluid);
            // The tablet's and phone's scale is about the poster's centre: they are drawn smaller than laid out, never larger.
            const drawnW = w * spec.collabScale;
            const xOf = (f: DepthFilm) => columnOffset(f.col, collabStep(spec, vmax));
            for (const a of collab) {
              for (const b of collab) {
                if (a === b) continue;
                if (a.col === b.col) {
                  // One column: the poster and its label's room (`collabGap`) apart down the axis, at this size.
                  expect(Math.abs(a.y - b.y), `${vmax} ${tier}`).toBeGreaterThanOrEqual(h + DEPTH.collabGap - 1e-9);
                } else {
                  // Different columns: a step apart across, which is as much as a poster is wide (as drawn), or the same apart down the axis.
                  const apartX = Math.abs(xOf(a) - xOf(b)) >= drawnW * layerFactor(0) - 1e-9;
                  const apartY = Math.abs(a.y - b.y) >= h - 1e-9;
                  expect(apartX || apartY, `${vmax} ${tier}`).toBe(true);
                }
              }
            }
          }
        }
      }
    });

    it("leaves room under a film made together, for its label, before the next one in the column (and none of the solo gap)", () => {
      for (const l of [crowded("shared"), layout([[[1, "2000-01-01"], [2, "2001-06-01"], [3, "2003-01-01"]], [[1, "2000-01-01"], [2, "2001-06-01"], [3, "2003-01-01"]]])]) {
        const collab = l.films.filter((f) => f.layer === 0);
        for (const a of collab) {
          for (const b of collab) {
            if (a === b || a.col !== b.col) continue;
            // The packing is for the largest the posters can be on any screen, so it holds on every one (see "the films made together never overlap, at any width").
            expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(DEPTH.collabMax.h + DEPTH.collabGap - 1e-9);
          }
        }
      }
      // The label: 6px of air under the poster, two lines at most on a desktop (22px lines at most, a phone's) and 6px of air to the next poster: nothing hangs over a
      // poster's top edge. (A third line, for a rare title on a small screen, fits in the room that the film's smaller scale gives.)
      const air = 6;
      const lines = 2 * 22;
      expect(DEPTH.collabGap).toBeGreaterThanOrEqual(air + lines + air);
      // A person's own films have no labels and keep the tighter gap.
      expect(DEPTH.rowGap).toBeLessThan(DEPTH.collabGap);
    });

    it("leaves room in the track above the first film made together (its poster) and below the last (its poster and its label)", () => {
      // Nothing hangs over the poster's top edge; the label hangs 6px under the bottom edge, three 22px lines at most. The layer is drawn `layerFactor(0)` larger.
      // (On the largest screen: the posters grow with the viewport.)
      const above = (DEPTH.collabMax.h / 2) * layerFactor(0);
      const below = (DEPTH.collabMax.h / 2 + 6 + 3 * 22) * layerFactor(0);
      expect(DEPTH.pad).toBeGreaterThanOrEqual(above);
      expect(DEPTH.pad).toBeGreaterThanOrEqual(below);
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

describe("filling the empty middle: the pull towards the centre", () => {
  const widths = [390, 640, 820, 1024, 1440];
  const vmaxOf = (width: number) => Math.max(width, Math.round(width * 0.6));
  /** A person's films, `perYear` a year from `from`: ids from `firstId`, votes spread over a few orders of magnitude so that the cloud has depth. */
  const lane = (firstId: number, from: number, perYear: number, count: number): FilmSpec[] =>
    Array.from({ length: count }, (_, i): FilmSpec => {
      const at = from + i / perYear;
      return [firstId + i, `${Math.floor(at)}-${String(1 + Math.floor((at % 1) * 12)).padStart(2, "0")}-15`, Math.floor(10 ** (1 + ((i * 7) % 40) / 10))];
    });
  const together: FilmSpec = [9000, "1965-06-01", 50_000];
  /** Two people with a film every five months from 1950 to 1990 (three columns each, no more), and one film made together in 1965: a long stretch after it with none. */
  const stretch = () => layout([[...lane(100, 1950, 2.4, 95), together], [...lane(500, 1950.1, 2.4, 95), together]]);
  /** The same two people with nothing in common. */
  const apart = () => layout([lane(100, 1950, 2.4, 95), lane(500, 1950.1, 2.4, 95)]);
  const backgrounds = (l: ReturnType<typeof layout>) => l.films.filter((f) => f.background);
  /** Where on screen a poster's centre is, with its pull (or without it). */
  const screenX = (item: DepthFilm, width: number, pulled = true) =>
    projectX(docCenterX(pulled ? item : { ...item, pull: 0 }, width, xSpec(tierOf(width), 2), vmaxOf(width)), width, posterFactor(item));

  describe("pullFor", () => {
    it("is nothing within the margin of a film made together and all the way in a screen away, with no corner at either end", () => {
      expect(PULL.from).toBeLessThan(PULL.to);
      expect(pullFor(-100)).toBe(0);
      expect(pullFor(0)).toBe(0);
      expect(pullFor(PULL.from)).toBe(0);
      expect(pullFor(PULL.to)).toBe(1);
      expect(pullFor(PULL.to + 5000)).toBe(1);
      expect(pullFor(Number.POSITIVE_INFINITY)).toBe(1);
      expect(pullFor((PULL.from + PULL.to) / 2)).toBeCloseTo(0.5, 10);
      // Flat where it starts and where it ends: a smoothstep.
      expect(pullFor(PULL.from + 1)).toBeLessThan(0.0001);
      expect(1 - pullFor(PULL.to - 1)).toBeLessThan(0.0001);
    });

    it("never goes down as the clear air grows, and never steeper than a smoothstep's 1.5 over the range", () => {
      let last = 0;
      for (let clear = 0; clear <= PULL.to + 100; clear += 5) {
        const pull = pullFor(clear);
        expect(pull).toBeGreaterThanOrEqual(last - 1e-12);
        expect(pull - last).toBeLessThanOrEqual((1.5 / (PULL.to - PULL.from)) * 5 + 1e-9);
        last = pull;
      }
    });

    it("starts after one film made together at its largest, its label and a margin, and is complete by about a screen", () => {
      // Centre to centre, with a solo poster: half a collaboration poster, its label, half the poster, and the margin.
      expect(DEPTH.collabMax.h / 2 + PULL.label + DEPTH.solo.h / 2 + PULL.from).toBeCloseTo(344.5, 6);
      expect(PULL.to).toBeGreaterThanOrEqual(800);
      expect(PULL.to).toBeLessThanOrEqual(1000);
    });
  });

  describe("xSpec's far offsets", () => {
    it("are nothing for one person, and mirror each other on a page of two: the first left of the middle, the second right", () => {
      for (const tier of ["phone", "tablet", "desktop"] as const) {
        expect(xSpec(tier, 1).far).toEqual([0]);
        const { far } = xSpec(tier, 2);
        expect(far).toHaveLength(2);
        expect(far[0]).toBe(far[1]);
        expect(far[0]).toBeGreaterThan(0);
      }
    });

    it("keep the people in the order of their bands, side by side: three with the third between the others, four with the third and fourth inside", () => {
      for (const tier of ["phone", "tablet", "desktop"] as const) {
        const three = xSpec(tier, 3).far;
        expect(three[2]).toBe(0);
        expect(three[0]).toBe(three[1]);
        expect(three[0]).toBeGreaterThan(0);
        const four = xSpec(tier, 4).far;
        expect(four[0]).toBe(four[1]);
        expect(four[2]).toBe(four[3]);
        expect(four[2]).toBeGreaterThan(0);
        expect(four[0]).toBeGreaterThan(four[2]);
      }
    });

    it("leave PULL.gap of air between two neighbouring clusters (three columns a step apart, a poster wide, and the jitter): the first layer back is the widest", () => {
      for (const tier of ["phone", "tablet", "desktop"] as const) {
        const spec = xSpec(tier, 2);
        const half = spec.stepSolo + (DEPTH.solo.w * layerFactor(1, undefined, 2)) / 2 + spec.jitterSpan / 2;
        expect(2 * spec.far[0] - 2 * half).toBeGreaterThanOrEqual(PULL.gap - 1);
        expect(2 * spec.far[0] - 2 * half).toBeLessThanOrEqual(PULL.gap + 1);
      }
    });

    it("are declared as CSS, one per person, from the same numbers", () => {
      const css = depthSceneCss(3);
      for (const tier of ["phone", "tablet", "desktop"] as const) {
        const spec = xSpec(tier, 3);
        spec.far.forEach((far, slot) => expect(css).toContain(`--far-${slot}:${far}px`));
      }
      expect(depthSceneCss(2)).not.toContain("--far-2:");
    });

    it("are applied by the one rule that places a poster: the pull draws the band in as far as --far, never out", () => {
      const css = depthSceneCss(2);
      expect(css).toContain("var(--pull) * (clamp(-1 * var(--far),");
      expect(css.match(/\[data-poster\]\{left:/g)).toHaveLength(1);
    });
  });

  describe("depthLayout's pull", () => {
    it("is nothing for the films made together, and for every film of a page of one person", () => {
      for (const poster of stretch().films.filter((f) => f.layer === 0)) expect(poster.pull).toBe(0);
      const alone = layout([lane(100, 1950, 2.4, 40)]);
      expect(alone.films.every((f) => f.pull === 0)).toBe(true);
    });

    it("leaves a poster by a film made together where its band put it: nothing within the margin, down the axis, of the film and its label", () => {
      const l = layout([
        [[1, "2000-01-01", 50_000], [2, "2000-02-01", 500], [3, "2000-10-01", 500], [4, "2001-06-01", 500]],
        [[1, "2000-01-01", 50_000], [5, "1999-10-01", 500], [6, "1999-04-01", 500]],
      ]);
      const collab = byId(l, 1);
      for (const id of [2, 3, 4, 5, 6]) {
        const poster = byId(l, id);
        // Clear air between the boxes down the axis: the film's box is as tall as it can be, with its label under it.
        const clear = Math.max(
          collab.y - DEPTH.collabMax.h / 2 - (poster.y + poster.h / 2),
          poster.y - poster.h / 2 - (collab.y + DEPTH.collabMax.h / 2 + PULL.label),
          0,
        );
        expect(poster.pull).toBeCloseTo(pullFor(clear), 3);
        if (clear <= PULL.from) {
          expect(poster.pull).toBe(0);
          for (const width of widths) {
            const spec = xSpec(tierOf(width), 2);
            expect(docCenterX(poster, width, spec, vmaxOf(width))).toBe(docCenterX({ ...poster, pull: 0 }, width, spec, vmaxOf(width)));
          }
        }
      }
      expect(byId(l, 2).pull).toBe(0);
    });

    it("pulls a poster a screen or more from every film made together all the way in, and the ones between by part", () => {
      const l = stretch();
      const collab = byId(l, 9000);
      const far = backgrounds(l).filter((f) => Math.abs(f.y - collab.y) > DEPTH.collabMax.h / 2 + PULL.label + PULL.to + 60);
      expect(far.length).toBeGreaterThan(20);
      for (const poster of far) expect(poster.pull).toBe(1);
      const partial = backgrounds(l).filter((f) => f.pull > 0 && f.pull < 1);
      expect(partial.length).toBeGreaterThan(4);
      // The nearer a poster is to the film made together, the less pulled: along each side of it, never down as it gets further.
      for (const side of [-1, 1]) {
        const ordered = backgrounds(l)
          .filter((f) => Math.sign(f.y - collab.y) === side)
          .sort((a, b) => side * (a.y - b.y));
        for (let i = 1; i < ordered.length; i++) expect(ordered[i].pull).toBeGreaterThanOrEqual(ordered[i - 1].pull - 1e-9);
      }
    });

    it("pulls everything all the way in when nothing is made together", () => {
      const l = apart();
      expect(l.hasShared).toBe(false);
      expect(backgrounds(l).length).toBe(l.films.length);
      expect(backgrounds(l).every((f) => f.pull === 1)).toBe(true);
    });

    it("is the same layout every time", () => {
      expect(stretch().films.map((f) => f.pull)).toEqual(stretch().films.map((f) => f.pull));
    });

    it("changes smoothly down the axis: two posters a little apart differ by no more than a smoothstep's slope allows", () => {
      const posters = backgrounds(stretch()).sort((a, b) => a.y - b.y);
      for (let i = 1; i < posters.length; i++) {
        const dy = posters[i].y - posters[i - 1].y;
        expect(Math.abs(posters[i].pull - posters[i - 1].pull)).toBeLessThanOrEqual((1.5 / (PULL.to - PULL.from)) * dy + 0.0011);
      }
    });
  });

  describe("docCenterX with a pull", () => {
    const poster = (band: number, pull: number, col = 0, jitter = 0): Parameters<typeof docCenterX>[0] => ({ layer: band + 1, band, col, jitter, w: DEPTH.solo.w, depth: layerDepth(band + 1, 2), pull });

    it("is the band's place with no pull, and the cluster's far place, side by side in the middle, with all of it", () => {
      const width = 1440;
      const spec = xSpec("desktop", 2);
      const stage = width - spec.rail;
      const at = (band: number, pull: number) => projectX(docCenterX(poster(band, pull), width, spec, vmaxOf(width)), width, posterFactor(poster(band, pull)));
      expect(at(0, 0)).toBeCloseTo(stage * 0.24, 6);
      expect(at(1, 0)).toBeCloseTo(stage * 0.76, 6);
      expect(at(0, 1)).toBeCloseTo(stage / 2 - spec.far[0], 6);
      expect(at(1, 1)).toBeCloseTo(stage / 2 + spec.far[1], 6);
      // Half way, half way.
      expect(at(0, 0.5)).toBeCloseTo((at(0, 0) + at(0, 1)) / 2, 6);
      // A clear gap between the two clusters' columns at the middle, whatever the layer's depth (the pull is on screen, like the bands).
      const left = projectX(docCenterX(poster(0, 1, 1, 0.5), width, spec, vmaxOf(width)), width, posterFactor(poster(0, 1)));
      const right = projectX(docCenterX(poster(1, 1, 2, -0.5), width, spec, vmaxOf(width)), width, posterFactor(poster(1, 1)));
      expect(right - left).toBeGreaterThan(DEPTH.solo.w);
    });

    it("moves along the same line on any layer or push: the pull is on screen, not in the layer's own plane", () => {
      const width = 1440;
      const spec = xSpec("desktop", 2);
      const stage = width - spec.rail;
      for (const push of [0, DEPTH.spread]) {
        const item = { ...poster(0, 1), depth: layerDepth(1, 2) + push };
        expect(projectX(docCenterX(item, width, spec, vmaxOf(width)), width, posterFactor(item))).toBeCloseTo(stage / 2 - spec.far[0], 6);
      }
    });

    it("only ever draws a band in, never out: a band already nearer the middle than its far place does not move (a phone's, a tablet's narrow end)", () => {
      for (const width of [320, 360, 390, 414, 639, 640]) {
        for (const people of [2, 3, 4]) {
          const spec = xSpec(tierOf(width), people);
          for (let band = 0; band < people; band++) {
            const item = poster(band, 1, 0, 0.3);
            const pulled = docCenterX({ ...item, layer: band + 1, depth: layerDepth(band + 1, people) }, width, spec, vmaxOf(width));
            const rest = docCenterX({ ...item, layer: band + 1, depth: layerDepth(band + 1, people), pull: 0 }, width, spec, vmaxOf(width));
            const middle = width / 2;
            // Never further from the middle than where it was.
            expect(Math.abs(pulled - middle)).toBeLessThanOrEqual(Math.abs(rest - middle) + 1e-9);
          }
        }
      }
      // A phone's two bands are already tighter than their far places: nothing moves.
      const phone = xSpec("phone", 2);
      const item = poster(0, 1);
      expect(docCenterX(item, 390, phone, 844)).toBe(docCenterX({ ...item, pull: 0 }, 390, phone, 844));
    });

    it("is continuous in the clear air: sweeping a poster away from a film made together moves it smoothly, never by more than the slope allows", () => {
      for (const width of [820, 1024, 1440, 1920]) {
        const spec = xSpec(tierOf(width), 2);
        // The whole way the pull moves it (in the layer's own space), and so the most a px of clear air can move it.
        const whole = Math.abs(docCenterX(poster(0, 1), width, spec, vmaxOf(width)) - docCenterX(poster(0, 0), width, spec, vmaxOf(width)));
        expect(whole).toBeGreaterThan(width >= 1024 ? 40 : 10);
        let last = docCenterX(poster(0, pullFor(0)), width, spec, vmaxOf(width));
        for (let clear = 1; clear <= PULL.to + 50; clear++) {
          const x = docCenterX(poster(0, pullFor(clear)), width, spec, vmaxOf(width));
          expect(Math.abs(x - last)).toBeLessThanOrEqual((1.5 / (PULL.to - PULL.from)) * whole + 1e-6);
          last = x;
        }
      }
    });
  });

  describe("on the page", () => {
    /** Whether two posters (by their layer's `onScreen`) overlap across, when they are level down the axis (a poster's height) at some scroll. */
    const crossOverlap = (a: DepthFilm, b: DepthFilm, width: number, pulled: boolean) => {
      const spec = xSpec(tierOf(width), 2);
      const half = (item: DepthFilm) => (item.w * spec.soloScale * posterFactor(item)) / 2;
      return half(a) + half(b) - Math.abs(screenX(a, width, pulled) - screenX(b, width, pulled));
    };
    /** Pairs of background posters that are close enough down the axis to overlap on screen at some scroll position. */
    const levelPairs = (l: ReturnType<typeof layout>, sameLayer: boolean) => {
      const posters = backgrounds(l);
      const pairs: [DepthFilm, DepthFilm][] = [];
      for (let i = 0; i < posters.length; i++) {
        for (let j = i + 1; j < posters.length; j++) {
          if ((posters[i].layer === posters[j].layer) !== sameLayer) continue;
          if (Math.abs(posters[i].y - posters[j].y) < (posters[i].h + posters[j].h) / 2) pairs.push([posters[i], posters[j]]);
        }
      }
      return pairs;
    };

    it("makes no two posters of one person overlap that did not already, on a phone, a tablet and a desktop", () => {
      for (const l of [stretch(), apart()]) {
        const pairs = levelPairs(l, true);
        expect(pairs.length).toBeGreaterThan(20);
        for (const width of widths) {
          for (const [a, b] of pairs) {
            // (The posters of one layer are the same person's; the ones that touch each other are the ones that were too close down the axis for one column.)
            const before = crossOverlap(a, b, width, false);
            const after = crossOverlap(a, b, width, true);
            if (before <= 0) expect(after, `${width}: ${a.film.id} ${b.film.id}`).toBeLessThanOrEqual(0.001);
          }
        }
      }
    });

    it("makes no poster of one person overlap one of the next person that did not already, and leaves a gap between the two clusters where nothing is made together", () => {
      for (const l of [stretch(), apart()]) {
        const pairs = levelPairs(l, false);
        for (const width of widths) {
          for (const [a, b] of pairs) {
            if (crossOverlap(a, b, width, false) <= 0) expect(crossOverlap(a, b, width, true), `${width}: ${a.film.id} ${b.film.id}`).toBeLessThanOrEqual(0.001);
          }
        }
      }
      // All the way in, on a tablet and a desktop: the first person's films are all left of the second's, by the air the clusters are given.
      for (const width of [820, 1024, 1440]) {
        const posters = backgrounds(apart());
        const first = posters.filter((f) => f.layer === 1).map((f) => screenX(f, width) + (f.w * posterFactor(f)) / 2);
        const second = posters.filter((f) => f.layer === 2).map((f) => screenX(f, width) - (f.w * posterFactor(f)) / 2);
        expect(Math.max(...first)).toBeLessThan(Math.min(...second));
      }
    });

    it("fills the middle: with nothing made together the people's films meet at the middle of the stage, a gap between them, on a tablet and a desktop", () => {
      for (const width of [1024, 1440]) {
        const spec = xSpec(tierOf(width), 2);
        const stage = width - spec.rail;
        const xs = (layer: number) => backgrounds(apart()).filter((f) => f.layer === layer).map((f) => screenX(f, width));
        // Their middles are on the far places (give or take the spread of the jitter), nearer the centre than the bands they were asked to be on.
        const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
        expect(Math.abs(mean(xs(1)) - stage / 2)).toBeLessThanOrEqual(spec.far[0] + 12);
        expect(Math.abs(mean(xs(2)) - stage / 2)).toBeLessThanOrEqual(spec.far[1] + 12);
        expect(Math.abs(mean(xs(1)) - stage / 2)).toBeLessThan(Math.abs(stage * 0.24 - stage / 2));
        expect(Math.abs(mean(xs(2)) - stage / 2)).toBeLessThan(Math.abs(stage * 0.76 - stage / 2));
        // And their order is kept: the first person's films are left of the second's.
        expect(mean(xs(1))).toBeLessThan(stage / 2);
        expect(mean(xs(2))).toBeGreaterThan(stage / 2);
      }
    });

    it("leaves a phone as it was: the bands are already close, and nothing moves", () => {
      for (const width of [360, 390, 414]) {
        const l = stretch();
        for (const poster of backgrounds(l)) {
          const spec = xSpec("phone", 2);
          expect(docCenterX(poster, width, spec, vmaxOf(width))).toBe(docCenterX({ ...poster, pull: 0 }, width, spec, vmaxOf(width)));
        }
      }
    });
  });
});

describe("how big a phone's posters can be", () => {
  const spec = xSpec("phone", 2);
  const factor = layerFactor(0);
  /** How wide a film made together is drawn on a phone, at `times` its size. */
  const drawn = (times = 1) => collabWidth(0, false) * spec.collabScale * factor * times;
  /**
   * The air (px, negative: overlap) between the centre column of the films made together and the nearer outer one, on a phone `width` wide: the outer column is a step
   * from the centre, but never beyond the stage's edge (the poster is kept clear of the rail and the gutter).
   */
  const airBetween = (width: number, times = 1) => {
    const stage = width - spec.rail;
    const outer = Math.min(spec.stepCollab, stage / 2 - spec.gutter - drawn(times) / 2);
    return outer - drawn(times);
  };

  it("holds three columns of the films made together side by side at 390 and wider, as drawn", () => {
    expect(drawn()).toBeCloseTo(114.8, 1);
    for (const width of [390, 414, 430]) expect(airBetween(width), `${width}`).toBeGreaterThanOrEqual(0);
  });

  it("is a little short on the narrowest phones (they overlap by a few px where three films crowd), as it was", () => {
    for (const width of [360, 375]) {
      expect(airBetween(width), `${width}`).toBeLessThan(0);
      expect(airBetween(width), `${width}`).toBeGreaterThan(-12);
    }
  });

  it("cannot hold them 1.3 times as big: the centre column and a side column would be on each other by 40px or more", () => {
    expect(drawn(1.3)).toBeCloseTo(149.3, 1);
    expect(airBetween(390, 1.3)).toBeLessThan(-40);
    // ... and no column step makes them fit: three of them are wider than the stage.
    expect(3 * drawn(1.3)).toBeGreaterThan(390 - spec.rail - 2 * spec.gutter);
  });

  it("cannot hold the other people's films 1.2 times as big, two people to a screen, three columns each", () => {
    const stage = 390 - spec.rail - 2 * spec.gutter;
    const wide = DEPTH.solo.w * layerFactor(1, undefined, 2) * 1.2;
    // Each cluster is three columns a poster and its jitter apart (a step of at least `wide + jitter`); two clusters need more than the stage has.
    const cluster = 2 * (wide + spec.jitterSpan) + wide;
    expect(2 * cluster).toBeGreaterThan(stage + 100);
    // As they are now, two clusters are over the stage by about as much as a poster's width.
    const now = 2 * (2 * spec.stepSolo + DEPTH.solo.w * layerFactor(1, undefined, 2));
    expect(now - stage).toBeLessThan(DEPTH.solo.w);
  });
});
