/**
 * What the landing hero's timeline and poster cluster show at each width, as plain numbers, so it can be tested. The geometry itself (the panels, the
 * line, the cluster's size) is CSS sized from the stage's box (hero-stage.tsx and the variables its section sets); only what depends on the pairing's
 * data is here: how many posters fit and so what "+N more" says, how each poster sits in the cluster, and where each film's dot is on the axis.
 */

import { moreFilms, type HeroPairing, type HeroYears } from "@/lib/hero-scenes";
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

/** A film's dot on the timeline strip: where across the axis (0 to 1), and how far it is nudged from there (px) when its person has several films that year. */
export interface Dot {
  x: number;
  nudge: number;
}

/** The distance between the dots of one person's films in the same year, in px: closer than a dot is wide, so they overlap into one small cluster. */
export const DOT_NUDGE = 3.5;

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

/** The dots of a sorted list of years: one per film, those of the same year nudged apart symmetrically about their year. */
export function dotsOf(years: readonly number[], axis: { first: number; last: number }): Dot[] {
  const dots: Dot[] = [];
  for (let start = 0; start < years.length; ) {
    let end = start;
    while (end < years.length && years[end] === years[start]) end++;
    const count = end - start;
    for (let i = 0; i < count; i++) {
      dots.push({ x: axisFraction(years[start], axis), nudge: Math.round((i - (count - 1) / 2) * DOT_NUDGE * 10) / 10 });
    }
    start = end;
  }
  return dots;
}

/** The timeline strip of a pairing: the axis and the dots of each person's own films (the lanes) and of the films they made together (on the line). Null without any film. */
export interface Strip {
  axis: { first: number; last: number };
  own: readonly [readonly Dot[], readonly Dot[]];
  together: readonly Dot[];
}

export function stripOf(pairing: HeroPairing): Strip | null {
  const years = decodedYears(pairing.years);
  const axis = yearAxis(years);
  if (!axis) return null;
  return { axis, own: [dotsOf(years.own[0], axis), dotsOf(years.own[1], axis)], together: dotsOf(years.together, axis) };
}
