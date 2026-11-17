/**
 * The "tear", the fallback for a person with no cut (or whose cut was made from another photo). A jagged
 * torn-paper strip across the face, frame edge to frame edge, after Gene Wilder's failed cut (3460 in portrait-cuts.json). Drawn through
 * `CutPortraitImage` like a cut, so the edge position, colour and width rule are the same; both side edges sit on the frame (x = 0 and 1), so
 * `cutEdgePath` leaves them open and only the torn top and bottom are stroked.
 */

import type { CutPoint } from "@/lib/portrait-cuts";

/** A person in `portrait-testset.json` (`npm run portraits:testset`): no cut, shown with a tear in /dev/portraits/grid. */
export interface PortraitTestArtist {
  id: number;
  name: string;
  profilePath: string;
  /** Poster paths of their most-voted films, for the montage background (as `PortraitCut.posters`). */
  posters: string[];
}

export const TEAR_COUNT = 16;

/** The viewBox a tear is drawn in: TMDB's usual 2:3 profile photo (w500 is 500 × 750). */
export const TEAR_SIZE: [w: number, h: number] = [500, 750];

/** Mulberry32: a tiny seeded PRNG, so the templates are the same on every load, server and client. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/**
 * One torn edge from x = 0 to x = 1: 15-30 segments of irregular length; y is the band's line (`base`, tilted by `slope` per unit of x) plus a
 * slow wobble, a small jag at every vertex and now and then a deeper bite. `out` is the side away from the band (-1 above it, +1 below), so the
 * bites take paper away from the strip rather than add slivers to it.
 */
function tornEdge(random: () => number, base: number, slope: number, out: -1 | 1): CutPoint[] {
  const segments = 15 + Math.floor(random() * 16);
  const weights = Array.from({ length: segments }, () => 0.35 + random() * 1.3);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const phase = [random() * Math.PI * 2, random() * Math.PI * 2];
  const wobble = [0.006 + random() * 0.01, 0.003 + random() * 0.006];
  const points: CutPoint[] = [];
  let x = 0;
  for (let i = 0; i <= segments; i++) {
    if (i > 0) x += weights[i - 1] / total;
    const at = i === segments ? 1 : x;
    const slow = wobble[0] * Math.sin(at * Math.PI * 2 * 1.3 + phase[0]) + wobble[1] * Math.sin(at * Math.PI * 2 * 3.7 + phase[1]);
    const jag = (random() - 0.5) * 0.022;
    const bite = random() < 0.14 ? -out * (0.012 + random() * 0.02) : 0;
    points.push([round4(at), round4(base + slope * (at - 0.5) + slow + jag + bite)]);
  }
  return points;
}

/** Tear `index`: a band about 22-62% of the height (eyes to mouth), tilted up to ±6°, of varying thickness, its torn edges seeded by `index`. */
function makeTear(index: number): CutPoint[] {
  const random = prng(0x7ea5 + index * 7919);
  const [w, h] = TEAR_SIZE;
  const tilt = ((random() * 2 - 1) * 6 * Math.PI) / 180;
  // A slope in normalized units: the frame is taller than wide, so a visual angle moves y by tan × w / h per unit of x.
  const slope = Math.tan(tilt) * (w / h);
  const centre = 0.405 + random() * 0.035;
  const thickness = 0.3 + random() * 0.09;
  // Each edge leans a little on its own (±1°), so the strip is not of even thickness.
  const lean = () => Math.tan(((random() * 2 - 1) * Math.PI) / 180) * (w / h);
  const top = tornEdge(random, centre - thickness / 2, slope + lean(), -1);
  const bottom = tornEdge(random, centre + thickness / 2, slope + lean(), 1);
  // Clockwise: the top edge left to right, then the bottom one right to left; the joins run along x = 1 and x = 0.
  return [...top, ...bottom.reverse()];
}

/** The 16 tear templates, normalized polygons (as `PortraitCut.variants`), generated once from fixed seeds. */
export const PORTRAIT_TEARS: readonly (readonly CutPoint[])[] = Array.from({ length: TEAR_COUNT }, (_, i) => makeTear(i));

/** The person's tear: by `personId % 16`, so the same face always tears the same way. */
export function tearFor(personId: number): readonly CutPoint[] {
  return PORTRAIT_TEARS[((Math.trunc(personId) % TEAR_COUNT) + TEAR_COUNT) % TEAR_COUNT];
}
