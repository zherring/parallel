/**
 * Pure math for the period brush: the click-drag range selector on the timeline's minimap, like
 * the range selector under a stock chart. The minimap stands for the whole time axis, so a
 * pointer position on it is a year, and a period (see `lib/period`) is a band between two year
 * boundaries: `from` starts at the left edge of its year, `to` (inclusive) ends at the right edge
 * of its year. Everything here works in whole years, the shortest period is one year, and a
 * period never leaves the years of the films it is cut from (a `YearSpan`); one that covers the
 * whole span means "no period" (`commitPeriod`).
 *
 * A drag is described by where it started and how far the pointer has moved, never by the pointer's
 * absolute position alone, so grabbing a handle or the band does not make it jump to the pointer.
 *
 * Nothing here touches the DOM.
 */

import { filmCountLabel } from "@/lib/format";
import type { WindowRect } from "@/lib/minimap";
import { inPeriod, periodLabel, resolvePeriod, type Period, type YearSpan } from "@/lib/period";
import { trackWidth, type Scale } from "@/lib/timeline-layout";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pointer travel (px) a press must make before it is a drag; less is a click. */
export const BRUSH_SLOP = 4;
/** Width (px) of the touch target of each handle, centred on its edge of the band: at least 24px, for fingers. */
export const BRUSH_HANDLE_HIT = 24;
/** The viewport indicator counts as covering the whole bar from this share of it. */
const WHOLE_BAR = 0.995;

// ---- Pixels and years ----------------------------------------------------------

/** Where the start of `year` (fractional years allowed) is on the bar, as a fraction of its width. Not clamped. */
export function fractionForYear(scale: Scale, year: number): number {
  const track = trackWidth(scale);
  return track > 0 ? (scale.pad + (year - scale.axisStartYear) * scale.pxPerYear) / track : 0;
}

/** Inverse of `fractionForYear`: the (fractional) year at a fraction of the bar's width. */
export function yearForFraction(scale: Scale, fraction: number): number {
  const track = trackWidth(scale);
  return scale.axisStartYear + (fraction * track - scale.pad) / scale.pxPerYear;
}

/**
 * The whole year under `x` px from the bar's left edge: the year it falls in, so the left edge of a
 * year is that year. The padding at either end of the axis counts as its first and last year.
 */
export function yearAtX(scale: Scale, x: number, barWidth: number): number {
  if (!(barWidth > 0)) return scale.axisStartYear;
  const year = Math.floor(yearForFraction(scale, clamp(x / barWidth, 0, 1)) + 1e-9);
  return clamp(year, scale.axisStartYear, scale.axisEndYear);
}

/** How many px one year is wide on the bar. */
export function barPxPerYear(scale: Scale, barWidth: number): number {
  const track = trackWidth(scale);
  return track > 0 ? (barWidth * scale.pxPerYear) / track : 0;
}

/** A pointer movement of `deltaPx` along the bar, in whole years (rounded to the nearest). */
export function deltaYears(scale: Scale, deltaPx: number, barWidth: number): number {
  const perYear = barPxPerYear(scale, barWidth);
  return perYear > 0 ? Math.round(deltaPx / perYear) : 0;
}

export interface Band {
  /** Left edge, as a fraction of the bar. */
  left: number;
  /** Right edge (the end of the `to` year), as a fraction of the bar. */
  right: number;
}

/** Where a period's band sits on the bar: from the start of `from` to the end of `to`. */
export function bandFractions(scale: Scale, period: Period): Band {
  return { left: fractionForYear(scale, period.from), right: fractionForYear(scale, period.to + 1) };
}

// ---- Making and changing a selection -------------------------------------------

/** The period from the year a drag started on to the year it is at: either way round, both years in it, kept inside the span. */
export function createPeriod(anchorYear: number, currentYear: number, span: YearSpan): Period {
  const from = clamp(Math.min(anchorYear, currentYear), span.first, span.last);
  const to = clamp(Math.max(anchorYear, currentYear), span.first, span.last);
  return { from, to };
}

/** `start` moved by `delta` years, with its length kept: it stops at the ends of the span instead of shrinking. */
export function movePeriod(start: Period, delta: number, span: YearSpan): Period {
  const length = start.to - start.from;
  const from = clamp(start.from + delta, span.first, Math.max(span.first, span.last - length));
  return { from, to: from + length };
}

export type BrushEdge = "start" | "end";

/** `start` with one edge moved by `delta` years; the edges never cross (one year at the least) or leave the span. */
export function resizePeriod(start: Period, edge: BrushEdge, delta: number, span: YearSpan): Period {
  return edge === "start"
    ? { from: clamp(start.from + delta, span.first, start.to), to: start.to }
    : { from: start.from, to: clamp(start.to + delta, start.from, span.last) };
}

/**
 * The period after a key on one of its handles: arrows move the edge by a year (five with Shift),
 * Home and End take it as far as it goes. Null for any other key (or one that changes nothing).
 */
export function keyboardPeriod(key: string, shift: boolean, edge: BrushEdge, period: Period, span: YearSpan): Period | null {
  const step = shift ? 5 : 1;
  let delta: number;
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      delta = -step;
      break;
    case "ArrowRight":
    case "ArrowUp":
      delta = step;
      break;
    case "Home":
      delta = -Infinity;
      break;
    case "End":
      delta = Infinity;
      break;
    default:
      return null;
  }
  const next = resizePeriod(period, edge, delta, span);
  return next.from === period.from && next.to === period.to ? null : next;
}

/** What a finished selection means for the page: a period, or null (no period) when it covers every year of the span. */
export function commitPeriod(selection: Period, span: YearSpan): Period | null {
  return resolvePeriod(selection, span);
}

/** Same period? (null is the same as null.) */
export function samePeriod(a: Period | null, b: Period | null): boolean {
  return a === b || (a !== null && b !== null && a.from === b.from && a.to === b.to);
}

// ---- Where a press lands -------------------------------------------------------

export type BrushTarget =
  /** One of the band's two handles: resize that end. */
  | "start"
  | "end"
  /** The band between its handles: move it. */
  | "move"
  /** The timeline's viewport indicator: scroll, as the minimap always did. */
  | "viewport"
  /** Anywhere else: a new selection (or, without a drag, a click that centres the viewport). */
  | "create";

export interface Extent {
  left: number;
  right: number;
}

export interface HitInput {
  /** The press, in px from the bar's left edge. */
  x: number;
  /** The band in px, or null when there is none. */
  selection: Extent | null;
  /** The viewport indicator in px; null when it covers the whole bar (nothing to scroll, so the bar is free to select on). */
  viewport: Extent | null;
  /** Touch target width of a handle; default BRUSH_HANDLE_HIT. */
  handleHit?: number;
  /** Shift held: a new selection even over the viewport indicator. Handles and the band still win. */
  forceCreate?: boolean;
}

/**
 * What a press on the bar is for. The band's handles come first (each reaches half its touch target
 * outside the band and, in a thin band, up to its middle inside), then the band itself, then the
 * viewport indicator, then everything else.
 */
export function brushTarget({ x, selection, viewport, handleHit = BRUSH_HANDLE_HIT, forceCreate = false }: HitInput): BrushTarget {
  if (selection) {
    const half = handleHit / 2;
    const inside = Math.min(half, Math.max(0, selection.right - selection.left) / 2);
    const nearStart = x >= selection.left - half && x <= selection.left + inside;
    const nearEnd = x >= selection.right - inside && x <= selection.right + half;
    if (nearStart && nearEnd) return Math.abs(x - selection.left) <= Math.abs(x - selection.right) ? "start" : "end";
    if (nearStart) return "start";
    if (nearEnd) return "end";
    if (x > selection.left && x < selection.right) return "move";
  }
  if (forceCreate) return "create";
  if (viewport && x >= viewport.left && x <= viewport.right) return "viewport";
  return "create";
}

/** The viewport indicator as pixels, or null when it covers the whole bar. */
export function viewportExtent(rect: WindowRect, barWidth: number): Extent | null {
  if (rect.width >= WHOLE_BAR) return null;
  return { left: rect.left * barWidth, right: (rect.left + rect.width) * barWidth };
}

// ---- Words ---------------------------------------------------------------------

/** How many of the films (one year each) fall in the period. */
export function filmsInPeriod(years: readonly number[], period: Period): number {
  return years.filter((year) => inPeriod(year, period)).length;
}

/** The live label of a selection: "1966–1981 · 5 films". */
export function brushLabel(period: Period, years: readonly number[]): string {
  return `${periodLabel(period)} · ${filmCountLabel(filmsInPeriod(years, period))}`;
}
