import { describe, expect, it } from "vitest";
import { combineLanes } from "@/lib/combined-track";
import {
  DEPTH,
  OBSCURITY_CUES,
  SOLO_COLUMNS,
  TIER_MIN_WIDTH,
  anchorScrollTop,
  bandFor,
  blurFor,
  columnIndex,
  columnOffset,
  depthLayout,
  depthPush,
  depthSceneCss,
  docCenterX,
  hashUnit,
  layerDepth,
  layerFactor,
  obscurityOf,
  phoneBlurFor,
  posterFactor,
  restOpacityFor,
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
    for (const push of [0, 80, 160, 320]) {
      expect(onScreen(film(1, 0, 0, 0, 2, push), width, spec)).toBeCloseTo(stage * 0.24, 6);
      expect(onScreen(film(2, 1, 0, 0, 2, push), width, spec)).toBeCloseTo(stage * 0.76, 6);
      expect(onScreen(film(1, 0, 1, 0.25, 2, push), width, spec) - onScreen(film(1, 0, 0, 0, 2, push), width, spec)).toBeCloseTo(spec.stepSolo + 0.25 * spec.jitterSpan, 6);
    }
    // In its own plane the further back it is pushed the further from the middle it is (that is the compensation), though not on screen.
    const near = docCenterX(film(1, 0), width, spec);
    const far = docCenterX(film(1, 0, 0, 0, 2, 320), width, spec);
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

  it("fades a background poster from 0.8 at rest for the best-known to about 0.45 for the most obscure", () => {
    expect(restOpacityFor(0)).toBe(0.8);
    expect(restOpacityFor(1)).toBeCloseTo(0.45, 10);
    expect(restOpacityFor(0.5)).toBeCloseTo(0.625, 10);
    const opacities = range.map(restOpacityFor);
    for (let i = 1; i < opacities.length; i++) expect(opacities[i]).toBeLessThan(opacities[i - 1]);
  });

  it("blurs the soft image from about 1px for the best-known to 3px for the most obscure", () => {
    expect(blurFor(0)).toBe(1);
    expect(blurFor(1)).toBe(3);
    expect(blurFor(0.5)).toBe(2);
    const blurs = range.map(blurFor);
    for (let i = 1; i < blurs.length; i++) expect(blurs[i]).toBeGreaterThan(blurs[i - 1]);
  });

  it("blurs gently on a phone: 0.5px to 1.5px, never more than the desktop's", () => {
    expect(phoneBlurFor(0)).toBe(0.5);
    expect(phoneBlurFor(1)).toBe(1.5);
    for (const o of range) expect(phoneBlurFor(o)).toBeLessThan(blurFor(o));
    const blurs = range.map(phoneBlurFor);
    for (let i = 1; i < blurs.length; i++) expect(blurs[i]).toBeGreaterThan(blurs[i - 1]);
  });

  it("clamps an obscurity outside 0 to 1, and one that is not a number is the best-known", () => {
    expect([depthPush(-1), depthPush(2)]).toEqual([0, DEPTH.spread]);
    expect([restOpacityFor(-1), restOpacityFor(2)]).toEqual([OBSCURITY_CUES.opacity.best, OBSCURITY_CUES.opacity.worst]);
    expect([blurFor(-1), blurFor(2)]).toEqual([OBSCURITY_CUES.blur.best, OBSCURITY_CUES.blur.worst]);
    expect([depthPush(Number.NaN), restOpacityFor(Number.NaN), blurFor(Number.NaN)]).toEqual([0, 0.8, 1]);
  });
});

describe("posterFactor", () => {
  it("is the perspective over the perspective plus the poster's own depth", () => {
    expect(posterFactor({ depth: 0 })).toBe(1);
    expect(posterFactor({ depth: -100 })).toBeCloseTo(1000 / 900, 10);
    expect(posterFactor({ depth: 320 })).toBeCloseTo(layerFactor(1), 10);
    expect(posterFactor({ depth: 320 + 320 })).toBeCloseTo(1000 / 1640, 10);
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
    // Two of the first person's posters, one famous and one with no votes, are 320px apart in depth and so differ in factor.
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
