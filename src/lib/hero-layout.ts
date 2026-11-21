/**
 * What the landing hero's timeline and poster cluster show at each width, as plain numbers, so it can be tested. The geometry itself (the panels, the
 * line, the cluster's size) is CSS sized from the stage's box (hero-stage.tsx and the variables its section sets); only what depends on the pairing's
 * data is here: how many posters fit and so what "+N more" says, how each poster sits in the cluster, and where each film's dot and each year's label are on the axis.
 */

import { moreFilms, type HeroPairing, type HeroYears, type Slot } from "@/lib/hero-scenes";
import { labelStep } from "@/lib/timeline-layout";
import { decodeYears } from "@/lib/year-list";

/**
 * The most posters each width shows. Its CSS breakpoints are Tailwind's `sm` (640px) and `lg` (1024px), and the stage's markup is written from these numbers: `CAP_VAR_CLASS`
 * sets `--cap` (the cluster's centring and fan, hero-cue.css), `posterHiddenClass` hides the posters past the count, and `MoreLabel` (hero-parts.tsx) has a pill per width.
 * hero-layout.test.ts holds the two classes to the caps.
 */
export const POSTER_CAPS = { phone: 3, tablet: 4, desktop: 5 } as const;
export type PosterWidth = keyof typeof POSTER_CAPS;
export const POSTER_WIDTHS: readonly PosterWidth[] = ["phone", "tablet", "desktop"];

/** `--cap` by width, as the Tailwind classes the stage's cluster carries (written out whole, as Tailwind finds a class only where it is spelled whole). */
export const CAP_VAR_CLASS = "[--cap:3] sm:[--cap:4] lg:[--cap:5]";

/** The class that hides poster `slot` at the widths whose cap leaves it out (none, where every width shows it). */
export function posterHiddenClass(slot: number): string {
  if (slot >= POSTER_CAPS.desktop) return "hidden";
  if (slot >= POSTER_CAPS.tablet) return "max-lg:hidden";
  if (slot >= POSTER_CAPS.phone) return "max-sm:hidden";
  return "";
}

/** The "+N more" hint of a pairing at a width: the films the posters of `width` leave out, every shared film without a poster on screen; 0 when they show them all. */
export function moreCount(pairing: HeroPairing, width: PosterWidth): number {
  return moreFilms(pairing, POSTER_CAPS[width]);
}

/**
 * How one poster of the cluster sits that is its own and not the fan's: a few degrees off the even fan and a few px off the cluster's baseline, so the row reads as a
 * hand-dealt one. The fan itself (each poster turned a little more than the one before it, the middle of the row the largest) is CSS (hero-cue.css `--fan-tilt`, `--fan-depth`),
 * from each poster's offset from the middle of the posters the width shows (`--off`, `--cap`): a width that drops posters fans the ones it keeps, not the pairing's.
 */
export interface PosterPlace {
  /** Degrees, clockwise, added to the fan's tilt (`--tilt-jitter`). */
  jitter: number;
  /** Pixels below (positive) the cluster's baseline. */
  dy: number;
}

/** The jitter keeps the row from looking ruled. */
const TILT_JITTER = [-1.4, 1.1, -0.9, 1.3, -1.1];
/** How far each poster sits off the baseline (alternating up and down), in px at the full-size cluster. */
const DEAL_OFFSET = [3, -3, 2, -4, 1];

/** The place of poster `slot` (chronological, left to right). It is by slot alone, so a poster keeps its place from arrival to departure, whatever the width shows. */
export function posterPlace(slot: number): PosterPlace {
  return { jitter: TILT_JITTER[slot] ?? 0, dy: DEAL_OFFSET[slot] ?? 0 };
}

/**
 * On a phone and on a tablet (below `lg`) each figure is pushed out toward the edge of the screen it stands by, so that its outer part hangs off it and is cut by it (the half's frame clips it), and the
 * face sits beside the poster cluster, not behind it. `FIGURE_OVERHANG` is how much of the figure's width goes off the screen; `HEAD_CROP_MAX` how much of the head's width the
 * screen's edge may take, whatever the overhang, so that a face never loses more than a quarter of itself, however wide the head is in its photo or however near the outer
 * edge it stands (a tight crop of a face is the whole photo's width).
 */
export const FIGURE_OVERHANG = 1 / 3;
export const HEAD_CROP_MAX = 0.25;

/**
 * The share of a figure's width that goes off the screen's edge on a phone or a tablet: `FIGURE_OVERHANG`, less where the head would be cut by more than `HEAD_CROP_MAX` of its own
 * width. `head` is where the head is across the figure's photo (shares of its width, `headSpan` in portrait-treatment.ts) and `slot` the side the figure stands on (0, the left,
 * has its outer edge at the photo's left; 1, the right). The head's outer edge is `outer` in from the photo's edge, and that much of the figure can go off before the head is
 * touched; the rule lets a quarter of the head's width go with it.
 */
export function figureOverhang(head: { centre: number; width: number }, slot: Slot): number {
  const outer = slot === 0 ? head.centre - head.width / 2 : 1 - (head.centre + head.width / 2);
  return Math.max(0, Math.min(FIGURE_OVERHANG, outer + HEAD_CROP_MAX * head.width));
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
 * The dots' axis is the band less the year caps' room at each end (`--axis-pad`, 54px on a phone and 64px from `sm` up, set on the stage in hero-stage.tsx and nowhere
 * else): the timeline measures the axis it is given (hero-timeline.tsx), so `dotScale` and `labelYears` take its width and nothing here knows the padding.
 */

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
