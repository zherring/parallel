/**
 * Pure geometry for the Depth view: the combined films laid down a vertical axis (oldest at the top), each on one
 * of several layers that the browser's perspective turns into parallax. Layer 0 holds the films several people made
 * (large, brought forward of the screen plane so it also moves a little faster than the scroll, on the centre spine);
 * layer k holds the films of the person in palette slot k - 1, further back the higher k is. Every layer is laid on the same document axis, `y = yForDate(releaseDate)`, so a poster lines up
 * with the year rail where the layer's depth factor is 1 or at the viewport's centre, and drifts elsewhere.
 *
 * It reuses the flat timeline's pure helpers (`makeScale`, `xForDate`, `packFilms`, `trackWidth`) with x read as y and
 * the sub-row as a column: a poster's column is the sub-row `packFilms` gave it, laid out left and right of the layer's
 * centre line (`columnOffset`). Nothing here touches the DOM or reads the clock, and the layout is one for every
 * viewport, so the server and the browser render the same markup. What differs between a phone and a desktop is only
 * the horizontal spacing (`xSpec`: bands, column step), which CSS custom properties per breakpoint carry (`depthSceneCss`)
 * and which the focus field mirrors in numbers (`docCenterX`); the only other thing that needs the viewport is the
 * initial scroll (`anchorScrollTop`).
 *
 * A poster's x is worked out in the space the visitor sees, then pushed back through the layer's perspective: the band
 * where a person's films are centred is a fraction of the visible stage (the width less the year rail), and a layer
 * `f` times smaller on screen has its offset from the centre divided by `f`, so a far layer's band lands where it was
 * asked to instead of collapsing towards the middle. The posters are never allowed under the rail or past the left edge.
 */

import type { CombinedFilm } from "@/lib/combined-track";
import {
  axisRange,
  makeScale,
  packFilms,
  trackWidth,
  xForDate,
  yearFraction,
  type Scale,
} from "@/lib/timeline-layout";
import type { Film } from "@/lib/types";

export const DEPTH = {
  /** CSS `perspective`, px. */
  perspective: 1000,
  /**
   * Distance behind the screen plane (px) of each layer: 0 is the films several people made, k the person in slot k - 1.
   * The first is negative: the films several people made float 100px in front of the screen plane (`translateZ(+100px)`),
   * drawn a ninth larger than they are laid out and moving a ninth faster than the scroll.
   */
  z: [-100, 320, 640, 900, 1100],
  pxPerYear: 128,
  /** Empty space before the first and after the last year, so the edge posters are not cut off. */
  pad: 200,
  /** Laid out at this size; the layer's factor (1.11) draws it about 151 x 227 px on a desktop (see `TIERS`' `collabScale` for smaller screens). */
  collab: { w: 136, h: 204 },
  solo: { w: 80, h: 120 },
  /**
   * A page of one person has nothing made together to put in front, so their own films take the front: this big (the
   * films several people made are 136 x 204) and at `singleZ`, with no blur (see `blurFor`). Scaled down on a smaller screen.
   */
  single: { w: 120, h: 180 },
  /** Depth (px behind the screen plane) of the layer of a page of one person: at the screen plane, so every poster is at full size and level with the rail. */
  singleZ: 0,
  /** Vertical gap (px) between posters of a column. */
  rowGap: 14,
} as const;

/** Viewport widths (px) from which the `tablet` and `desktop` spacings apply: Tailwind's `sm` and `lg`. */
export const TIER_MIN_WIDTH = { tablet: 640, desktop: 1024 } as const;

export type DepthTier = "phone" | "tablet" | "desktop";

/**
 * The spacing of the scene's x axis for a viewport (see `xSpec`). Lengths are px on the visitor's screen, which is what is
 * being designed: a layer further back is `f` times smaller there, so its posters are placed `length / f` apart in the
 * layer's own space and every layer's columns are as far apart on screen as the first one's.
 */
export interface XSpec {
  /** Width (px) the year rail covers at the right edge: the stage is the rest. */
  rail: number;
  /** Least air (px, on screen) between a poster and the left edge or the rail. */
  gutter: number;
  /** Distance (px on screen) between two columns of the posters of films several people made. */
  stepCollab: number;
  /** How much the posters of films several people made are scaled down about their centres (1 on a desktop): a phone's stage is narrower. */
  collabScale: number;
  /** The same for the posters of a page of one person (`DEPTH.single`); 1 on a page of several, whose own films keep their size. */
  soloScale: number;
  /** People on the page (1 to 4): a page of one has its films at the front (`layerDepth`). */
  people: number;
  /** Distance (px on screen) between two columns of a person's own films. */
  stepSolo: number;
  /** Width (px on screen) the jitter of a solo poster is spread over. */
  jitterSpan: number;
  /** Where each person's films are centred, as a fraction of the stage (what is visible, left of the rail), by palette slot. */
  bands: readonly number[];
}

/**
 * The spacing by viewport. A solo layer has three columns (`SOLO_COLUMNS`) that posters scatter over, `step` apart, and
 * the step must clear a poster's width plus the jitter (`jitterSpan`) on the first layer back, the one that is least
 * shrunk, so no two posters of a layer overlap. A larger step spreads a person's columns across more of the screen, which
 * is what lets a desktop use its width while a phone keeps three columns inside 362px.
 */
const TIERS: Record<DepthTier, Omit<XSpec, "bands" | "soloScale" | "people"> & { stepSoloOne: number; singleScale: number; spread: number }> = {
  phone: { rail: 28, gutter: 4, stepCollab: 128, collabScale: 0.76, stepSolo: 70, stepSoloOne: 108, singleScale: 0.8, jitterSpan: 8, spread: 0.8 },
  tablet: { rail: 60, gutter: 8, stepCollab: 146, collabScale: 0.9, stepSolo: 100, stepSoloOne: 190, singleScale: 0.9, jitterSpan: 20, spread: 0.9 },
  desktop: { rail: 60, gutter: 8, stepCollab: 166, collabScale: 1, stepSolo: 120, stepSoloOne: 300, singleScale: 1, jitterSpan: 36, spread: 1 },
};

/** Columns a person's own films scatter over (the centre line and one to each side); a crowd of films takes more. */
export const SOLO_COLUMNS = 3;

/** Band centres (fraction of the stage on a desktop) by number of people, indexed by palette slot. */
const BANDS: readonly (readonly number[])[] = [
  [0.5],
  [0.5],
  [0.24, 0.76],
  [0.2, 0.8, 0.5],
  [0.15, 0.85, 0.35, 0.65],
];

export interface DepthFilm {
  film: Film;
  /** Released and made by two or more visible people: layer 0, the green treatment. */
  shared: boolean;
  /** Palette slots of the people who made it, in URL order. */
  slots: number[];
  /** 0 for the films several people made, else the film's first person's slot + 1. */
  layer: number;
  /** Centre of the poster on the document's vertical axis (px from the top of the track). */
  y: number;
  /** The palette slot whose band the poster is centred on (see `xSpec`), or null for the films several people made: they sit on the centre line. */
  band: number | null;
  /** Column in the poster's layer (0 is the centre line; `columnIndex` says how many steps from the band it is): the sub-row `packFilms` gave a collaboration, the column a solo film scattered into. */
  col: number;
  /** A small deterministic offset, -0.5 to 0.5 of the viewport's `jitterSpan`: posters of the same column do not line up like a grid. 0 for the films several people made. */
  jitter: number;
  w: number;
  h: number;
}

export interface DepthLayout {
  /** Every film, layer by layer (the tab order), each layer top to bottom. */
  films: DepthFilm[];
  scale: Scale;
  /** Height (px) of the scroll area: it follows every film, never layer 0 alone, so a page with nothing shared still scrolls. */
  trackHeight: number;
  /** Document y the view opens on (see `anchorScrollTop`), or null to open at the top. */
  anchorY: number | null;
  /** Layers to draw: one for the shared films and one per person. */
  layerCount: number;
  hasShared: boolean;
}

export interface DepthOptions {
  pxPerYear?: number;
}

/**
 * Scale of a layer on screen, `p / (p + z)`: 1 at the screen plane, above 1 in front of it, smaller the further back.
 * `peopleCount` is the people on the page (a page of one has its films at the front, see `layerDepth`).
 */
export function layerFactor(layer: number, perspective: number = DEPTH.perspective, peopleCount: number = 2): number {
  return perspective / (perspective + layerDepth(layer, peopleCount));
}

/**
 * Distance behind the screen plane (px) of a layer (negative in front of it); layers past the table share the last
 * one's. On a page of one person there are no films made together, and the person's own layer is not 320px back but at
 * `DEPTH.singleZ`, the front.
 */
export function layerDepth(layer: number, peopleCount: number = 2): number {
  if (peopleCount === 1 && layer >= 1) return DEPTH.singleZ;
  return DEPTH.z[Math.min(Math.max(0, Math.trunc(layer)), DEPTH.z.length - 1)];
}

/** How many steps from its layer's centre line a column is: 0, +1, -1, +2, -2, ... for columns 0, 1, 2, 3, 4, ... */
export function columnIndex(col: number): number {
  if (col <= 0) return 0;
  const distance = Math.ceil(col / 2);
  return col % 2 === 1 ? distance : -distance;
}

/** Offset of a column from its layer's centre line, `step` apart: 0, +step, -step, +2 step, -2 step, ... */
export function columnOffset(col: number, step: number): number {
  return columnIndex(col) * step;
}

/**
 * A deterministic number in [0, 1) from an integer (a film id): the same on the server and in the browser, so the
 * jitter it drives never causes a hydration mismatch.
 */
export function hashUnit(id: number): number {
  let h = (Math.trunc(id) | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Blur (px) of a layer's posters while they are out of focus: none in front, a soft one on the first person's layer and
 * a stronger one further back. With nothing shared the first person's layer is the front-most one, so it stays sharp
 * (which is every page of one person: nothing can be shared, so its posters are sharp images with no soft copy under them).
 */
export function blurFor(layer: number, hasShared: boolean): number {
  if (layer <= 0) return 0;
  if (layer === 1) return hasShared ? 1 : 0;
  return 1.5;
}

/**
 * The blur (px) of a layer's soft posters on a phone: a light one on the first person's layer, the one nearest the
 * screen, and none further back (a blur is what costs on a phone, and the small image of those layers, blown up, is
 * soft enough already). Only where `blurFor` blurs the layer at all.
 */
export function phoneBlurFor(layer: number, hasShared: boolean): number {
  return layer === 1 && blurFor(layer, hasShared) > 0 ? 0.75 : 0;
}

/** Whether a layer's posters are drawn soft until the focus field sharpens them (see `blurFor`): the others are always sharp. */
export function isBlurred(layer: number, hasShared: boolean): boolean {
  return blurFor(layer, hasShared) > 0;
}

/** Which spacing a viewport `width` px wide gets. */
export function tierOf(width: number): DepthTier {
  return width >= TIER_MIN_WIDTH.desktop ? "desktop" : width >= TIER_MIN_WIDTH.tablet ? "tablet" : "phone";
}

/**
 * Where a person's films are centred, as a fraction of the stage (the width less the rail): the middle for a page of one
 * person, else the slot's band, drawn in towards the middle on a smaller viewport.
 */
export function bandFor(slot: number, peopleCount: number, tier: DepthTier = "desktop"): number {
  const row = BANDS[Math.min(Math.max(1, Math.trunc(peopleCount)), BANDS.length - 1)];
  const q = row[Math.min(Math.max(0, Math.trunc(slot)), row.length - 1)];
  return Math.round((0.5 + (q - 0.5) * TIERS[tier].spread) * 10_000) / 10_000;
}

/** The spacing of the x axis for a viewport and a page of `peopleCount` people. */
export function xSpec(tier: DepthTier, peopleCount: number): XSpec {
  const { rail, gutter, stepCollab, collabScale, stepSolo, stepSoloOne, singleScale, jitterSpan } = TIERS[tier];
  const people = Math.min(Math.max(1, Math.trunc(peopleCount)), BANDS.length - 1);
  return {
    rail,
    gutter,
    stepCollab,
    collabScale,
    soloScale: people === 1 ? singleScale : 1,
    people,
    // A page of one person has the whole width to itself: its columns are spread further apart.
    stepSolo: people === 1 ? stepSoloOne : stepSolo,
    jitterSpan,
    bands: Array.from({ length: people }, (_, slot) => bandFor(slot, people, tier)),
  };
}

/**
 * Where a poster's centre is in its layer's own space (px from the left edge of the scroll area) on a viewport `width`
 * px wide: the number the CSS rule in `depthSceneCss` works out, for the focus field to project without reading the DOM.
 * What is chosen is where the poster is on screen: the stage fraction of its band, plus its column's steps and its jitter,
 * all in screen px; the layer's perspective (`f`) maps the layer's x to the screen's as `(x - width / 2) f + width / 2`,
 * so the offset from the centre is divided by `f`. The posters are kept inside the stage: the bounds are that mapping
 * undone for the least and greatest x a poster clear of the edge and the rail can be at.
 */
export function docCenterX(film: Pick<DepthFilm, "layer" | "band" | "col" | "jitter" | "w">, width: number, spec: XSpec): number {
  const f = layerFactor(film.layer, DEPTH.perspective, spec.people);
  // What is kept inside the stage is the poster as drawn: the films several people made (and a page of one person's) are scaled down on a small screen.
  const w = film.w * (film.layer === 0 ? spec.collabScale : spec.soloScale);
  const q = film.band === null ? 0.5 : (spec.bands[Math.min(film.band, spec.bands.length - 1)] ?? 0.5);
  const step = film.layer === 0 ? spec.stepCollab : spec.stepSolo;
  const x = width / 2 + ((width - spec.rail) * q - width / 2 + columnIndex(film.col) * step + film.jitter * spec.jitterSpan) / f;
  const least = width / 2 + (spec.gutter - width / 2) / f + w / 2;
  const greatest = width / 2 + (width / 2 - spec.rail - spec.gutter) / f - w / 2;
  return Math.max(least, Math.min(x, greatest));
}

/** The custom properties of one viewport's spacing, set on the scene. */
function specDeclarations(spec: XSpec): string {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return [
    `--rail:${spec.rail}px`,
    `--gutter:${spec.gutter}px`,
    `--step-collab:${spec.stepCollab}px`,
    `--collab-scale:${round(spec.collabScale)}`,
    `--solo-scale:${round(spec.soloScale)}`,
    `--step-solo:${spec.stepSolo}px`,
    `--jit-span:${spec.jitterSpan}px`,
    ...spec.bands.map((band, slot) => `--band-${slot}:${round(band)}`),
  ].join(";");
}

/**
 * The scene's horizontal spacing as CSS: the custom properties of each viewport (`xSpec`) on `[data-depth-scene]`, and the
 * one rule that turns them and a poster's own (`--q` band, `--col` steps from it, `--jit`, `--step`, `--w`, `--ps` (its scale, `--collab-scale` for the films several people made), `--lead`, with
 * its layer's `--f`) into `left`, the same sum as `docCenterX`. It is generated from the same numbers the JS uses, so the
 * two cannot drift apart, and it is the same markup for every viewport: the browser picks the spacing.
 */
export function depthSceneCss(peopleCount: number): string {
  const rule = (tier: DepthTier) => `[data-depth-scene]{${specDeclarations(xSpec(tier, peopleCount))}}`;
  const x = "calc(50% + ((100% - var(--rail)) * var(--q) - 50% + var(--col) * var(--step) + var(--jit) * var(--jit-span)) / var(--f))";
  const least = "calc(50% + (var(--gutter) - 50%) / var(--f) + var(--w) * var(--ps) / 2)";
  const greatest = "calc(50% + (50% - var(--rail) - var(--gutter)) / var(--f) - var(--w) * var(--ps) / 2)";
  return [
    rule("phone"),
    `@media (min-width:${TIER_MIN_WIDTH.tablet}px){${rule("tablet")}}`,
    `@media (min-width:${TIER_MIN_WIDTH.desktop}px){${rule("desktop")}}`,
    `[data-depth-scene] [data-poster]{left:calc(clamp(${least},${x},${greatest}) - var(--lead))}`,
  ].join("");
}

/**
 * Gives a person's films a column each so that no two in a column are closer than `room` down the axis, and so that
 * they are spread over the columns instead of piled in the middle one: a film takes the column its id prefers (a hash,
 * so the server and the browser agree), or the next free one, and only a crowd of films closer together than the columns
 * can hold opens more. Each column is as free as the last film in it says.
 */
function scatterColumns(films: readonly Film[], scale: Scale, room: number): Map<number, { y: number; col: number }> {
  const placed = films
    .map((film) => ({ film, y: xForDate(scale, film.releaseDate) }))
    .sort((a, b) => a.y - b.y || a.film.id - b.film.id);
  const lastY: number[] = Array.from({ length: SOLO_COLUMNS }, () => Number.NEGATIVE_INFINITY);
  const result = new Map<number, { y: number; col: number }>();
  for (const { film, y } of placed) {
    const preferred = Math.floor(hashUnit(film.id * 13 + 5) * SOLO_COLUMNS);
    let col = -1;
    for (let tried = 0; col === -1; tried++) {
      // The preferred column, then the other columns in turn, then new ones.
      const candidate = tried < SOLO_COLUMNS ? (preferred + tried) % SOLO_COLUMNS : tried;
      if (candidate >= lastY.length) lastY.push(Number.NEGATIVE_INFINITY);
      if (y - lastY[candidate] >= room - 1e-9) col = candidate;
    }
    lastY[col] = y;
    result.set(film.id, { y, col });
  }
  return result;
}

/** The layer an entry is drawn on: 0 when several (released) made it, else its first person's slot + 1. */
function layerOf(entry: CombinedFilm): number {
  return entry.shared ? 0 : (entry.slots[0] ?? 0) + 1;
}

/**
 * Lays the combined films (see `combineLanes`) out down the axis. `peopleCount` is the number of people on the page
 * (it decides where the view opens, and how many layers there are) and `today` (`yyyy-mm-dd`) only anchors the axis
 * when there are no films.
 */
export function depthLayout(
  entries: readonly CombinedFilm[],
  peopleCount: number,
  today: string,
  options: DepthOptions = {},
): DepthLayout {
  const pxPerYear = options.pxPerYear ?? DEPTH.pxPerYear;
  // A film whose date cannot be read has no place on the axis.
  const placeable = entries.filter((entry) => Number.isFinite(yearFraction(entry.film.releaseDate)));
  const range = axisRange(
    placeable.map((entry) => entry.film.year),
    Number(today.slice(0, 4)),
  );
  const scale = makeScale(range, pxPerYear, DEPTH.pad);
  const trackHeight = trackWidth(scale);

  const byLayer = new Map<number, CombinedFilm[]>();
  for (const entry of placeable) {
    const layer = layerOf(entry);
    const group = byLayer.get(layer);
    if (group) group.push(entry);
    else byLayer.set(layer, [entry]);
  }

  const films: DepthFilm[] = [];
  for (const layer of [...byLayer.keys()].sort((a, b) => a - b)) {
    const group = byLayer.get(layer) ?? [];
    const size = layer === 0 ? DEPTH.collab : peopleCount === 1 ? DEPTH.single : DEPTH.solo;
    const spine = layer === 0;
    // Down the axis (a poster is `h` tall, so `packFilms` reads x as y), each film has a column: the films several people
    // made take the lowest free one, so they stay on the centre line unless they crowd; a person's own films scatter.
    const columns = spine
      ? new Map(
          packFilms(
            group.map((entry) => entry.film),
            { pxPerYear, axisStartYear: scale.axisStartYear, pad: scale.pad, cardWidth: size.h, gap: DEPTH.rowGap },
          ).map(({ film, x: y, row }) => [film.id, { y, col: row }]),
        )
      : scatterColumns(
          group.map((entry) => entry.film),
          scale,
          size.h + DEPTH.rowGap,
        );
    for (const entry of group) {
      const film = entry.film;
      const { y, col } = columns.get(film.id) as { y: number; col: number };
      // The vertical jitter stays within half the gap on each side, so two posters that were `rowGap` apart still do not touch.
      const dy = spine ? 0 : (hashUnit(film.id * 7 + 1) - 0.5) * DEPTH.rowGap;
      films.push({
        film,
        shared: entry.shared,
        slots: entry.slots,
        layer,
        y: y + dy,
        band: spine ? null : (entry.slots[0] ?? 0),
        col,
        // Spread over less than the room between two columns on every viewport (`TIERS`).
        jitter: spine ? 0 : hashUnit(film.id) - 0.5,
        w: size.w,
        h: size.h,
      });
    }
  }
  films.sort((a, b) => a.layer - b.layer || a.y - b.y || a.film.id - b.film.id);

  return {
    films,
    scale,
    trackHeight,
    anchorY: anchorYOf(placeable, peopleCount, scale),
    layerCount: Math.max(1, peopleCount) + 1,
    hasShared: placeable.some((entry) => entry.shared),
  };
}

/**
 * Where the view should open: the first film several people made; failing that (two or more people), the point
 * where the latest-starting person begins, so every person has something in view (the vertical twin of
 * `initialAnchorX`); with one person, nothing (open at the beginning).
 */
function anchorYOf(entries: readonly CombinedFilm[], peopleCount: number, scale: Scale): number | null {
  if (peopleCount < 2) return null;
  const yOf = (entry: CombinedFilm) => xForDate(scale, entry.film.releaseDate);
  const sharedYs = entries.filter((entry) => entry.shared).map(yOf);
  if (sharedYs.length > 0) return Math.min(...sharedYs);
  // The year each person's first film is released at; the anchor is the latest of them.
  const firstOf = new Map<number, number>();
  for (const entry of entries) {
    const y = yOf(entry);
    for (const slot of entry.slots) firstOf.set(slot, Math.min(firstOf.get(slot) ?? y, y));
  }
  return firstOf.size > 0 ? Math.max(...firstOf.values()) : null;
}

/** The scrollTop that puts `anchorY` in the middle of a viewport `viewportH` tall; 0 without an anchor. */
export function anchorScrollTop(anchorY: number | null, viewportH: number, trackHeight: number): number {
  if (anchorY === null) return 0;
  const max = Math.max(0, trackHeight - viewportH);
  return Math.min(max, Math.max(0, Math.round(anchorY - viewportH / 2)));
}
