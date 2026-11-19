/**
 * What the landing hero's timeline and poster cluster show at each width, as plain numbers, so it can be tested. The geometry itself (the panels, the
 * line, the cluster's size) is CSS sized from the stage's box (hero-stage.tsx and the variables its section sets); only what depends on the pairing's
 * data is here: how many posters fit and so what "+N more" says, how each poster sits in the cluster, and where each film's dot and each year's label are on the axis.
 */

import { moreFilms, type HeroPairing, type HeroYears } from "@/lib/hero-scenes";
import { labelStep } from "@/lib/timeline-layout";
import { decodeYears } from "@/lib/year-list";

/**
 * The most posters each width shows. Its CSS breakpoints are Tailwind's `sm` (640px) and `lg` (1024px); hero-stage.tsx hides the posters past
 * the count with them, and sets `--cap` to the same numbers for the cluster's centring.
 */
export const POSTER_CAPS = { phone: 3, tablet: 4, desktop: 5 } as const;
export type PosterWidth = keyof typeof POSTER_CAPS;
export const POSTER_WIDTHS: readonly PosterWidth[] = ["phone", "tablet", "desktop"];

/** How many of the pairing's posters `width` shows: the first ones, so the dropped ones are the newest films. */
export function postersShown(pairing: HeroPairing, width: PosterWidth): number {
  return Math.min(pairing.posters.length, POSTER_CAPS[width]);
}

/** The "+N more" hint of a pairing at a width: the films the posters of `width` leave out, every shared film without a poster on screen; 0 when they show them all. */
export function moreCount(pairing: HeroPairing, width: PosterWidth): number {
  return moreFilms(pairing, POSTER_CAPS[width]);
}

/** How one poster of the cluster sits: a little turned, a little off the cluster's baseline and a little larger or smaller, so the row reads as a hand-dealt fan. */
export interface PosterPlace {
  /** Degrees, clockwise. */
  tilt: number;
  /** Pixels below (positive) the cluster's baseline. */
  dy: number;
  /** A multiplier of the poster's width. */
  scale: number;
}

/** Each poster turns a little more than the one before it (a fan), and the jitter keeps the row from looking ruled. */
const TILT_STEP = 2.4;
const TILT_JITTER = [-1.4, 1.1, -0.9, 1.3, -1.1];
/** How far each poster sits off the baseline (alternating up and down), in px at the full-size cluster. */
const DEAL_OFFSET = [3, -3, 2, -4, 1];
/** The depth: the middle of the row a little larger (nearer), the ends a little smaller (farther). */
const DEPTH_SCALE = [0.95, 1, 1.04, 1, 0.96];

/**
 * The place of poster `slot` in a cluster of `count` posters (chronological, left to right). A shorter cluster is centred, so its tilts are
 * the fan of its own middle; the offsets and depths are by slot, so a poster keeps its place from arrival to departure.
 */
export function posterPlace(slot: number, count: number): PosterPlace {
  return {
    tilt: Math.round(((slot - (count - 1) / 2) * TILT_STEP + (TILT_JITTER[slot] ?? 0)) * 10) / 10,
    dy: DEAL_OFFSET[slot] ?? 0,
    scale: DEPTH_SCALE[slot] ?? 1,
  };
}

/** The decoded years of the pairing's timeline, for everything that reads them. */
export interface DecodedYears {
  own: readonly [readonly number[], readonly number[]];
  together: readonly number[];
}

export function decodedYears({ own, together }: HeroYears): DecodedYears {
  return { own: [decodeYears(own[0]), decodeYears(own[1])], together: decodeYears(together) };
}

/** The axis: the earliest year of anyone's films to the latest, which are the timeline's two caps. A pairing with no films at all has none. */
export function yearAxis(years: DecodedYears): { first: number; last: number } | null {
  const all = [...years.own[0], ...years.own[1], ...years.together];
  if (all.length === 0) return null;
  return { first: Math.min(...all), last: Math.max(...all) };
}

/** Where a year is across the axis, 0 to 1 (a single-year axis puts it in the middle). */
export function axisFraction(year: number, axis: { first: number; last: number }): number {
  return axis.last === axis.first ? 0.5 : (year - axis.first) / (axis.last - axis.first);
}

/** Where across the axis (0 to 1) each year of a sorted list is: one per year, not per film, as two films of a person in a year would be one dot over the other. */
export function yearFractions(years: readonly number[], axis: { first: number; last: number }): number[] {
  return [...new Set(years)].map((year) => axisFraction(year, axis));
}

/** The timeline strip of a pairing: the axis, and where on it each person's own films are (one entry per year), and the films they made together. Null without any film. */
export interface Strip {
  axis: { first: number; last: number };
  own: readonly [readonly number[], readonly number[]];
  together: readonly number[];
}

export function stripOf(pairing: HeroPairing): Strip | null {
  const years = decodedYears(pairing.years);
  const axis = yearAxis(years);
  if (!axis) return null;
  return { axis, own: [yearFractions(years.own[0], axis), yearFractions(years.own[1], axis)], together: yearFractions(years.together, axis) };
}

/**
 * The band: everything on the timeline (the dots, the years over them and the two year caps) sits in a band centred on the seam, not across the whole stage; only the
 * 1px line itself runs on to the screen's edges. The band is half of the screen's width from `wideAt` up, and widens by a straight line in px as the screen narrows
 * (so a phone's years are not cramped into half of it) to `narrowShare` of it at `narrowAt`, never past `maxShare`. `BAND_WIDTH_CSS` is the same rule in CSS
 * (`cqw` of the stage, which is as wide as the screen), set as `--band-w` on the stage (hero-stage.tsx), so the two cannot drift apart.
 */
export const BAND = { wideAt: 1200, wideShare: 0.5, narrowAt: 390, narrowShare: 0.86, maxShare: 0.9 } as const;

const BAND_SLOPE = (BAND.wideShare * BAND.wideAt - BAND.narrowShare * BAND.narrowAt) / (BAND.wideAt - BAND.narrowAt);
const BAND_BASE = BAND.narrowShare * BAND.narrowAt - BAND_SLOPE * BAND.narrowAt;

/** The band's width in px on a screen `viewport` px wide. */
export function bandWidth(viewport: number): number {
  return Math.min(BAND.maxShare * viewport, Math.max(BAND.wideShare * viewport, BAND_SLOPE * viewport + BAND_BASE));
}

const css = (value: number) => String(Math.round(value * 10000) / 10000);
export const BAND_WIDTH_CSS = `max(${css(BAND.wideShare * 100)}cqw, min(${css(BAND.maxShare * 100)}cqw, calc(${css(BAND_SLOPE * 100)}cqw + ${css(BAND_BASE)}px)))`;

/**
 * How far in from each end of the band the dots' axis starts, px: the year cap (its outer edge is the band's) and a gap after it. A phone's cap is smaller;
 * Tailwind's `sm` (640px) is where it grows. These mirror `--axis-pad` in hero-stage.tsx.
 */
export const AXIS_PAD = { phone: 54, desktop: 64 } as const;

/** The axis's width, px, on a screen `viewport` px wide: the band less a cap's room at each end. It is what `dotScale` and `labelYears` are given. */
export function axisWidth(viewport: number): number {
  return bandWidth(viewport) - 2 * (viewport >= 640 ? AXIS_PAD.desktop : AXIS_PAD.phone);
}

/** The spacing of the years (px per year) at which a dot is as large as on a pair's page; a more crowded axis shrinks them, down to `DOT_MIN_SCALE` of that. */
export const DOT_FULL_PX_PER_YEAR = 9;
export const DOT_MIN_SCALE = 0.5;

/** The size of the dots (a multiple of the pair page's) on an axis `width` px wide: smaller as the years come closer, so a long career on a phone is a row of dots, not a band. */
export function dotScale(axis: { first: number; last: number }, width: number): number {
  if (!(width > 0) || axis.last === axis.first) return 1;
  return Math.min(1, Math.max(DOT_MIN_SCALE, width / (axis.last - axis.first) / DOT_FULL_PX_PER_YEAR));
}

/** The closest two year labels may be, centre to centre (px), and how far in from the axis's ends the first and last may be: the year caps are there. */
export const LABEL_GAP = 34;
export const LABEL_END_CLEAR = 30;

/**
 * The years labelled along an axis `width` px wide: the pair page's own steps (`labelStep`: every year, every five or every ten, by the room each gets), then
 * wider ones (20 and 50) until two labels are `LABEL_GAP` apart, none within `LABEL_END_CLEAR` of an end (the caps carry the first and last year). None until
 * the axis has been measured.
 */
export function labelYears(axis: { first: number; last: number }, width: number): number[] {
  if (!(width > 0) || axis.last === axis.first) return [];
  const pxPerYear = width / (axis.last - axis.first);
  let step: number = labelStep(pxPerYear);
  for (const wider of [20, 50]) if (step * pxPerYear < LABEL_GAP) step = wider;
  const years: number[] = [];
  for (let year = Math.ceil((axis.first + 1) / step) * step; year < axis.last; year += step) {
    const x = (year - axis.first) * pxPerYear;
    if (x >= LABEL_END_CLEAR && width - x >= LABEL_END_CLEAR) years.push(year);
  }
  return years;
}
