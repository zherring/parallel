/**
 * Pure geometry for the Depth view: the combined films laid down a vertical axis (oldest at the top), each on one
 * of several layers that the browser's perspective turns into parallax. Layer 0 holds the films several people made
 * (large, in front, on the centre spine); layer k holds the films of the person in palette slot k - 1, further back
 * the higher k is. Every layer is laid on the same document axis, `y = yForDate(releaseDate)`, so a poster lines up
 * with the year rail where the layer's depth factor is 1 or at the viewport's centre, and drifts elsewhere.
 *
 * It reuses the flat timeline's pure helpers (`makeScale`, `xForDate`, `packFilms`, `trackWidth`) with x read as y and
 * the sub-row as a column: a poster's column is the sub-row `packFilms` gave it, laid out left and right of the layer's
 * centre line (`columnOffset`). Nothing here touches the DOM or reads the clock, and there is one geometry for every
 * viewport, so the server and the browser render the same markup: a poster's x is a fraction of the width plus a
 * pixel offset (`xFrac`, `dx`), and the only thing that needs the viewport is the initial scroll (`anchorScrollTop`).
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
  /** Distance behind the screen plane (px) of each layer: 0 is the films several people made, k the person in slot k - 1. */
  z: [0, 320, 640, 900, 1100],
  pxPerYear: 128,
  /** Empty space before the first and after the last year, so the edge posters are not cut off. */
  pad: 200,
  collab: { w: 112, h: 168 },
  solo: { w: 80, h: 120 },
  /** Vertical gap (px) between posters of a column. */
  rowGap: 14,
  /** Horizontal gap (px) between columns. */
  colGap: 12,
  /** Where each person's films are centred, as a fraction of the width, by palette slot (0.5 for a page of one person). */
  bands: [0.3, 0.7, 0.18, 0.82],
} as const;

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
  /** Centre of the poster's band, as a fraction of the width. */
  xFrac: number;
  /** Offset (px) from `xFrac`: the column's offset plus a small deterministic jitter. */
  dx: number;
  /** Column in the poster's layer (0 is the centre line): the sub-row `packFilms` gave it. */
  col: number;
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

/** Scale of a layer on screen, `p / (p + z)`: 1 at the screen plane, smaller the further back. */
export function layerFactor(layer: number, perspective: number = DEPTH.perspective): number {
  return perspective / (perspective + layerDepth(layer));
}

/** Distance behind the screen plane (px) of a layer; layers past the table share the last one's. */
export function layerDepth(layer: number): number {
  return DEPTH.z[Math.min(Math.max(0, Math.trunc(layer)), DEPTH.z.length - 1)];
}

/** Offset of a column from its layer's centre line, `step` apart: 0, +step, -step, +2 step, -2 step, ... */
export function columnOffset(col: number, step: number): number {
  if (col <= 0) return 0;
  const distance = Math.ceil(col / 2) * step;
  return col % 2 === 1 ? distance : -distance;
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
 * a stronger one further back. With nothing shared the first person's layer is the front-most one, so it stays sharp.
 */
export function blurFor(layer: number, hasShared: boolean): number {
  if (layer <= 0) return 0;
  if (layer === 1) return hasShared ? 2 : 0;
  return 3;
}

/** Where a person's films are centred (fraction of the width): the middle for a page of one person, else the slot's band. */
export function bandFor(slot: number, peopleCount: number): number {
  if (peopleCount <= 1) return 0.5;
  return DEPTH.bands[((Math.trunc(slot) % DEPTH.bands.length) + DEPTH.bands.length) % DEPTH.bands.length];
}

/** The layer an entry is drawn on: 0 when several (released) made it, else its first person's slot + 1. */
function layerOf(entry: CombinedFilm): number {
  return entry.shared ? 0 : (entry.slots[0] ?? 0) + 1;
}

/**
 * Lays the combined films (see `combineLanes`) out down the axis. `peopleCount` is the number of people on the page
 * (it decides whether their bands are apart or all in the middle) and `today` (`yyyy-mm-dd`) only anchors the axis
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
    const size = layer === 0 ? DEPTH.collab : DEPTH.solo;
    const entryOf = new Map(group.map((entry) => [entry.film.id, entry]));
    // Packed along the vertical axis: a poster is `h` tall, `packFilms` reads x as y and the sub-row as the column.
    const packed = packFilms(
      group.map((entry) => entry.film),
      { pxPerYear, axisStartYear: scale.axisStartYear, pad: scale.pad, cardWidth: size.h, gap: DEPTH.rowGap },
    );
    const step = size.w + DEPTH.colGap;
    for (const { film, x: y, row: col } of packed) {
      const entry = entryOf.get(film.id) as CombinedFilm;
      const spine = layer === 0;
      // Jitter stays within half the gap on each side, so two posters that were `rowGap` apart still do not touch.
      const dx = columnOffset(col, step) + (spine ? 0 : (hashUnit(film.id) - 0.5) * DEPTH.colGap);
      const dy = spine ? 0 : (hashUnit(film.id * 7 + 1) - 0.5) * DEPTH.rowGap;
      films.push({
        film,
        shared: entry.shared,
        slots: entry.slots,
        layer,
        y: y + dy,
        xFrac: spine ? 0.5 : bandFor(entry.slots[0] ?? 0, peopleCount),
        dx,
        col,
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
