/**
 * The dust motes drifting behind the Depth view: pure numbers, drawn by `src/components/depth/dust-motes.tsx`. A mote has
 * a place in a field `w` by `h`, a slow drift, a sideways wobble and a twinkle; scrolling moves it up the screen a
 * fraction (its `depth`) of the way the scene moves, so the nearer, larger, softer ones slide faster than the fine
 * specks, which is the parallax. Nothing here reads the clock or the DOM: the caller steps it with the time since the
 * last frame and the scene's scrollTop, and a seeded generator makes the same field for the same seed.
 */

export interface Field {
  w: number;
  h: number;
}

export interface Mote {
  /** Home position (px) in the field, before the drift and the wobble. */
  x: number;
  y: number;
  /** 0 to 1: how far the mote moves with the scroll (1 is as far as the scroll). */
  depth: number;
  /** Radius (px) of the dot. A bokeh mote is a large, faint, out-of-focus disc. */
  r: number;
  bokeh: boolean;
  /** Opacity (0 to 1) it twinkles up to. */
  alpha: number;
  /** Drift (px per second). */
  vx: number;
  vy: number;
  /** Wobble sideways: amplitude (px), speed (rad per second), phase (rad). */
  wobble: number;
  wobbleSpeed: number;
  phase: number;
  /** Twinkle speed (rad per second) and phase (rad). */
  twinkleSpeed: number;
  twinklePhase: number;
  /** Seconds this mote has lived: it drives the wobble and the twinkle. */
  age: number;
  /** Where to draw it and how opaque: set by `stepMotes`. */
  sx: number;
  sy: number;
  a: number;
}

/** How far outside the field (px) a mote may be before it wraps to the other side: room for its whole glow. */
export const MARGIN = 40;
/** Share of the motes that are bokeh. */
const BOKEH_SHARE = 0.1;
/** How far, at most, a mote's depth moves it with the scroll (a fine speck moves a fraction of this). */
const PARALLAX = 0.45;

/** A small seeded generator: the same sequence for the same seed, in [0, 1). */
function lcg(seed: number): () => number {
  let state = (Math.trunc(seed) >>> 0) % 4294967296;
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/** The motes for a field: the same ones for the same `count`, `seed` and field. */
export function createMotes(count: number, seed: number, field: Field): Mote[] {
  const random = lcg(seed);
  const between = (low: number, high: number) => low + (high - low) * random();
  return Array.from({ length: Math.max(0, Math.trunc(count)) }, () => {
    const bokeh = random() < BOKEH_SHARE;
    // Fine specks are far and slow; the big soft ones are nearer, faster, and fainter.
    const depth = bokeh ? between(0.55, 1) : between(0.08, 0.6);
    const mote: Mote = {
      x: between(0, field.w),
      y: between(0, field.h),
      depth,
      r: bokeh ? between(6, 13) : between(0.7, 2),
      bokeh,
      alpha: bokeh ? between(0.05, 0.13) : between(0.18, 0.5),
      vx: between(-5, 5),
      // Rising, like warm air: mostly up, a little slower for the far ones.
      vy: -between(2, 9) * (0.5 + depth * 0.5),
      wobble: between(2, 9),
      wobbleSpeed: between(0.15, 0.6),
      phase: between(0, Math.PI * 2),
      twinkleSpeed: between(0.4, 1.4),
      twinklePhase: between(0, Math.PI * 2),
      age: 0,
      sx: 0,
      sy: 0,
      a: 0,
    };
    placeMote(mote, 0, 0, field);
    return mote;
  });
}

const wrap = (value: number, size: number) => ((value % size) + size) % size;

/** Works out where `mote` is drawn: its drifted home, wobbled, moved up by the scroll, wrapped into the field. */
function placeMote(mote: Mote, age: number, scrollTop: number, field: Field): void {
  const span = { w: field.w + MARGIN * 2, h: field.h + MARGIN * 2 };
  const x = mote.x + Math.sin(mote.phase + age * mote.wobbleSpeed) * mote.wobble;
  const y = mote.y - scrollTop * mote.depth * PARALLAX;
  mote.sx = wrap(x + MARGIN, span.w) - MARGIN;
  mote.sy = wrap(y + MARGIN, span.h) - MARGIN;
  // A twinkle between 55% and 100% of its opacity.
  mote.a = mote.alpha * (0.775 + 0.225 * Math.sin(mote.twinklePhase + age * mote.twinkleSpeed));
}

/**
 * Moves the motes on by `dt` seconds with the scene at `scrollTop`: each drifts, wobbles, twinkles and slides with the
 * scroll by its depth, and wraps round the edges of the field (and its margin), so the field never empties. With `dt`
 * of 0 it only places them, for a still picture. Mutates the motes: `sx`, `sy` and `a` are what to draw.
 */
export function stepMotes(motes: Mote[], dt: number, scrollTop: number, field: Field): void {
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
  const span = { w: field.w + MARGIN * 2, h: field.h + MARGIN * 2 };
  for (const mote of motes) {
    mote.age += step;
    mote.x = wrap(mote.x + mote.vx * step + MARGIN, span.w) - MARGIN;
    mote.y = wrap(mote.y + mote.vy * step + MARGIN, span.h) - MARGIN;
    placeMote(mote, mote.age, scrollTop, field);
  }
}

/** How many motes a field of this size holds: 60 on a phone to 110 on a large screen. */
export function moteCount(field: Field): number {
  return Math.min(110, Math.max(60, Math.round((field.w * field.h) / 14_000)));
}
