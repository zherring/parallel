/**
 * Spike (zherring/spike-portraits): the "rough-cut frame" of /dev/portraits/frames, as geometry the real pages can use too. A poster sits on
 * one cut-paper polygon in its person's colour, or, for a film two people made, on two (the first colour nudged up-left, the second
 * down-right) whose true intersection is drawn white on the dark bg (black on a light one). Pure functions: no DOM, no React.
 */

export type Pt = [number, number];
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type FrameBg = "dark" | "light";
/** The overlap is white on the dark bg and black on the light one. */
export const OVERLAP: Record<FrameBg, string> = { dark: "#fff", light: "#000" };

/** The owner's picks (2026-11-16): margin 10% of the poster's width, offset 3%. */
export const FRAME_MARGIN = 10;
export const FRAME_OFFSET = 3;

/** Smaller posters get a raggeder cut: 35 under ~70px wide, 25 under ~120px, else 20 (the lab's S, M and L). */
export function jitterForWidth(w: number): number {
  if (w < 70) return 35;
  if (w < 120) return 25;
  return 20;
}

/** mulberry32, seeded from a string (FNV-1a). */
export function prng(key: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rectPoints = ({ x0, y0, x1, y1 }: Box): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/**
 * A cut-paper polygon around `box`: the 4 corners jittered and 4–10 more points along the edges pushed mostly outward (no spikes).
 * `w` is the poster width, for scale.
 */
export function roughPoints(box: Box, w: number, jitter: number, rand: () => number): Pt[] {
  const j = (jitter / 100) * w * 0.12;
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const corners: Pt[] = rectPoints(box);
  const normals: Pt[] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const extras = [0, 0, 0, 0];
  const extraCount = 4 + Math.floor(rand() * 7);
  for (let i = 0; i < extraCount; i++) extras[Math.floor(rand() * 4)]++;

  const points: Pt[] = [];
  for (let e = 0; e < 4; e++) {
    const [ax, ay] = corners[e];
    const [bx, by] = corners[(e + 1) % 4];
    const [nx, ny] = normals[e];
    const at = (t: number, out: number): Pt => [ax + (bx - ax) * t + nx * out, ay + (by - ay) * t + ny * out];
    points.push([ax + between(-j, j), ay + between(-j, j)]);
    const marks: { t: number; pts: Pt[] }[] = [];
    for (let k = 0; k < extras[e]; k++) {
      const t = between(0.12, 0.88);
      marks.push({ t, pts: [at(t, between(-0.4 * j, j))] });
    }
    marks.sort((m, n) => m.t - n.t).forEach((m) => points.push(...m.pts));
  }
  return points;
}

export interface FrameOptions {
  /** The poster's size in px; the poster is the box (0,0)–(w,h). */
  w: number;
  h: number;
  /** How far each shape extends past the poster, in % of its width. */
  margin: number;
  /** How far apart the two shapes are on each axis, in % of the poster's width (ignored for one shape). */
  offset: number;
  /** How ragged the cut is, 0–100. */
  jitter: number;
  style: "clean" | "rough";
  /** One seed per shape: one for a single shape, two for a pair (A then B). */
  seeds: readonly [string] | readonly [string, string];
}

export interface Frame {
  /** One polygon per shape, in the order of the seeds (A, then B). */
  shapes: Pt[][];
  /** The box that holds every shape, with a little room, in the poster's coordinates. */
  view: Box;
}

/** Each shape is the poster box grown by the margin; with two, A is nudged up-left and B down-right by half the offset each. */
export function buildFrame({ w, h, margin, offset, jitter, style, seeds }: FrameOptions): Frame {
  const m = (margin / 100) * w;
  const o = seeds.length === 2 ? (offset / 100) * w : 0;
  const grow = (dx: number, dy: number): Box => ({ x0: -m + dx, y0: -m + dy, x1: w + m + dx, y1: h + m + dy });
  const boxes = seeds.length === 2 ? [grow(-o / 2, -o / 2), grow(o / 2, o / 2)] : [grow(0, 0)];
  const shapes = boxes.map((box, i) => (style === "clean" ? rectPoints(box) : roughPoints(box, w, jitter, prng(seeds[i]))));
  const all = shapes.flat();
  const pad = 2;
  return {
    shapes,
    view: {
      x0: Math.min(...all.map((p) => p[0])) - pad,
      y0: Math.min(...all.map((p) => p[1])) - pad,
      x1: Math.max(...all.map((p) => p[0])) + pad,
      y1: Math.max(...all.map((p) => p[1])) + pad,
    },
  };
}

export const toPath = (pts: Pt[]) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
