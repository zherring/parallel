/**
 * Pure math for the timeline minimap: a thin bar that stands for the whole time axis and
 * acts as a scrollbar for the timeline's horizontal scroller.
 *
 * Everything is in "track" coordinates: x = 0 is the left edge of the axis track, which sits
 * to the right of the sticky lane header. The visible part of the track is the scroller's
 * clientWidth minus that header (`viewport`), and the whole track is the scroller's
 * scrollWidth minus the header (`track`). With that, scrollLeft runs from 0 to
 * `track - viewport` and the viewport window on the bar is `scrollLeft / track` wide
 * `viewport / track` (fractions of the bar), so a film at track x sits at `x / track` on the
 * bar, directly above where it is in the timeline.
 *
 * Nothing here touches the DOM.
 */

import { xForDate, trackWidth, type Scale } from "@/lib/timeline-layout";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The furthest the scroller can scroll sideways (never negative). */
export function maxScrollLeft(track: number, viewport: number): number {
  return Math.max(0, track - viewport);
}

export function clampScrollLeft(scrollLeft: number, track: number, viewport: number): number {
  if (!Number.isFinite(scrollLeft)) return 0;
  return clamp(scrollLeft, 0, maxScrollLeft(track, viewport));
}

export interface ScrollGeometry {
  scrollLeft: number;
  /** Visible width of the track area (scroller width minus the lane header). */
  viewport: number;
  /** Full width of the track area (scroll width minus the lane header). */
  track: number;
}

export interface WindowRect {
  /** Left edge, as a fraction of the bar (0 to 1 - width). */
  left: number;
  /** Width, as a fraction of the bar (0 to 1). */
  width: number;
}

/** Where the viewport window sits on the bar. Everything visible gives the whole bar. */
export function windowRect({ scrollLeft, viewport, track }: ScrollGeometry): WindowRect {
  if (!(track > 0) || viewport >= track) return { left: 0, width: 1 };
  const width = Math.max(0, viewport) / track;
  const left = clampScrollLeft(scrollLeft, track, viewport) / track;
  return { left, width };
}

/** 0 to 100: how far along the scroller is (for aria-valuenow). 0 when there is nothing to scroll. */
export function scrollPercent({ scrollLeft, viewport, track }: ScrollGeometry): number {
  const max = maxScrollLeft(track, viewport);
  return max > 0 ? Math.round((clampScrollLeft(scrollLeft, track, viewport) / max) * 100) : 0;
}

/** Inverse of `windowRect(...).left`: the scrollLeft that puts the window's left edge at `left` (fraction of the bar). */
export function scrollLeftForWindowLeft(left: number, track: number, viewport: number): number {
  return clampScrollLeft(left * track, track, viewport);
}

export interface DragInput {
  /** scrollLeft when the drag began. */
  startScrollLeft: number;
  /** Pointer movement since the drag began, in px along the bar. */
  deltaPx: number;
  /** Rendered width of the bar in px. */
  barWidth: number;
  track: number;
  viewport: number;
}

/** Dragging the window by `deltaPx` moves it by exactly that much on the bar, so the scroller moves by deltaPx * track / barWidth. */
export function dragScrollLeft({ startScrollLeft, deltaPx, barWidth, track, viewport }: DragInput): number {
  if (!(barWidth > 0)) return clampScrollLeft(startScrollLeft, track, viewport);
  return clampScrollLeft(startScrollLeft + (deltaPx / barWidth) * track, track, viewport);
}

/** Clicking the bar at `barX` px from its left edge centres the window there. */
export function scrollLeftForBarClick(barX: number, barWidth: number, track: number, viewport: number): number {
  if (!(barWidth > 0)) return 0;
  return clampScrollLeft((clamp(barX, 0, barWidth) / barWidth) * track - viewport / 2, track, viewport);
}

/** The scrollLeft that puts `trackX` (a film's x) at the centre of the visible track area. */
export function scrollLeftToCenterTrackX(trackX: number, track: number, viewport: number): number {
  return clampScrollLeft(trackX - viewport / 2, track, viewport);
}

export type MinimapKey = "ArrowLeft" | "ArrowRight" | "PageUp" | "PageDown" | "Home" | "End";

/** Arrow keys move 10% of the window, Page keys a whole window, Home and End jump to the ends. Null for any other key. */
export function keyboardScrollLeft(key: string, scrollLeft: number, track: number, viewport: number): number | null {
  const step = viewport * 0.1;
  switch (key) {
    case "ArrowLeft":
      return clampScrollLeft(scrollLeft - step, track, viewport);
    case "ArrowRight":
      return clampScrollLeft(scrollLeft + step, track, viewport);
    case "PageUp":
      return clampScrollLeft(scrollLeft - viewport, track, viewport);
    case "PageDown":
      return clampScrollLeft(scrollLeft + viewport, track, viewport);
    case "Home":
      return 0;
    case "End":
      return maxScrollLeft(track, viewport);
    default:
      return null;
  }
}

/** Where a film sits on the bar (0 to 1) given its release date: its track x over the track width. */
export function dateFraction(scale: Scale, isoDate: string): number {
  const track = trackWidth(scale);
  return track > 0 ? clamp(xForDate(scale, isoDate) / track, 0, 1) : 0;
}

/** First and last whole year inside the window, for a screen-reader description like "1946 to 1962". */
export function visibleYears({ scrollLeft, viewport }: Pick<ScrollGeometry, "scrollLeft" | "viewport">, scale: Scale): {
  from: number;
  to: number;
} {
  const yearAt = (trackX: number) =>
    clamp(Math.round(scale.axisStartYear + (trackX - scale.pad) / scale.pxPerYear), scale.axisStartYear, scale.axisEndYear);
  return { from: yearAt(scrollLeft), to: yearAt(scrollLeft + viewport) };
}

// ---- Axis ticks ----------------------------------------------------------------

export interface MinimapTick {
  year: number;
  /** Position on the bar, 0 to 1. */
  fraction: number;
  /** A line is drawn for decades only; the first and last year just carry a label. */
  decade: boolean;
  /** Printed under the tick, or null. */
  label: string | null;
  /** Where the label's centre goes, in px from the bar's left edge, kept inside the bar. */
  labelX: number;
}

export interface TickOptions {
  barWidth: number;
  /** Closest two labels may be (centre to centre), in px. */
  minLabelGap?: number;
  /** Half the width of a printed label, in px; labels at the ends are nudged to stay inside the bar. */
  labelHalfWidth?: number;
  /** Closest two decade lines may be before the unlabelled ones are dropped, in px. */
  minLineGap?: number;
}

const DECADE_STEPS = [1, 2, 5, 10, 20, 50];

/**
 * Decade lines, plus labels for the first and last year of the axis and as many decades in
 * between as fit without touching each other or the end labels.
 */
export function minimapTicks(scale: Scale, options: TickOptions): MinimapTick[] {
  const { barWidth, minLabelGap = 40, labelHalfWidth = 13, minLineGap = 6 } = options;
  const track = trackWidth(scale);
  if (!(barWidth > 0) || !(track > 0)) return [];

  const fractionOf = (year: number) => (scale.pad + (year - scale.axisStartYear) * scale.pxPerYear) / track;
  const pxOf = (year: number) => clamp(fractionOf(year) * barWidth, labelHalfWidth, Math.max(labelHalfWidth, barWidth - labelHalfWidth));

  const decades: number[] = [];
  for (let year = Math.ceil(scale.axisStartYear / 10) * 10; year <= scale.axisEndYear; year += 10) decades.push(year);

  const decadePx = (10 * scale.pxPerYear * barWidth) / track;
  const lineYears = decadePx >= minLineGap ? decades : [];

  // Every nth decade, so that labelled decades are at least minLabelGap apart.
  const step = DECADE_STEPS.find((n) => n * decadePx >= minLabelGap) ?? DECADE_STEPS[DECADE_STEPS.length - 1];
  const labelled = new Map<number, number>([
    [scale.axisStartYear, pxOf(scale.axisStartYear)],
    [scale.axisEndYear, pxOf(scale.axisEndYear)],
  ]);
  for (const year of decades) {
    if ((year / 10) % step !== 0 || labelled.has(year)) continue;
    const x = pxOf(year);
    if ([...labelled.values()].every((other) => Math.abs(other - x) >= minLabelGap)) labelled.set(year, x);
  }

  const years = new Set([...lineYears, ...labelled.keys()]);
  return [...years]
    .sort((a, b) => a - b)
    .map((year) => ({
      year,
      fraction: clamp(fractionOf(year), 0, 1),
      decade: year % 10 === 0 && lineYears.includes(year),
      label: labelled.has(year) ? String(year) : null,
      labelX: labelled.get(year) ?? pxOf(year),
    }));
}
