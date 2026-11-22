/**
 * What the landing hero's timeline and poster cluster show at each width, as plain numbers, so it can be tested. The geometry itself (the panels, the
 * line, the cluster's size) is CSS sized from the stage's box (hero-stage.tsx and the variables hero-stage.css sets); only what depends on the pairing's
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
 * On a phone (below `sm`) each figure is pushed out toward the edge of the screen it stands by, so that its outer part hangs off it and is cut by it (the half's frame clips it), and the
 * face sits beside the poster cluster, not behind it. `FIGURE_OVERHANG` is how much of the figure's width goes off the screen; `HEAD_CROP_MAX` how much of the head's width the
 * screen's edge may take, whatever the overhang, so that a face never loses more than a quarter of itself, however wide the head is in its photo or however near the outer
 * edge it stands (a tight crop of a face is the whole photo's width).
 */
export const FIGURE_OVERHANG = 1 / 3;
export const HEAD_CROP_MAX = 0.25;

/**
 * The share of a figure's width that goes off the screen's edge on a phone: `FIGURE_OVERHANG`, less where the head would be cut by more than `HEAD_CROP_MAX` of its own
 * width. `head` is where the head is across the figure's photo (shares of its width, `headSpan` in portrait-treatment.ts) and `slot` the side the figure stands on (0, the left,
 * has its outer edge at the photo's left; 1, the right). The head's outer edge is `outer` in from the photo's edge, and that much of the figure can go off before the head is
 * touched; the rule lets a quarter of the head's width go with it.
 */
export function figureOverhang(head: { centre: number; width: number }, slot: Slot): number {
  const outer = slot === 0 ? head.centre - head.width / 2 : 1 - (head.centre + head.width / 2);
  return Math.max(0, Math.min(FIGURE_OVERHANG, outer + HEAD_CROP_MAX * head.width));
}

/** How far in from the photo's outer edge the head's outer edge is, as a share of the photo's width: `figureOverhang`'s `outer`. */
export function headOuter(head: { centre: number; width: number }, slot: Slot): number {
  return slot === 0 ? head.centre - head.width / 2 : 1 - (head.centre + head.width / 2);
}

/**
 * On a tablet (`sm` up to below `lg`) a figure is cropped by the screen's edge as a phone's is (pushed out, anchored by its feet, the body and shoulders cut), but **the whole
 * head stays on the screen**: the figure is pushed out until its head's outer edge (`headSpan`: hair and ears included) is `margin` px in from the screen's edge, and no
 * further, so a head near its photo's outer edge is pushed out less (or, with the head at the very edge of its photo, in by a few px) and a head far from it more. The head is whole, so
 * it takes room, and the figure is no larger than the head's room allows (the least of these, each by formula, `tabletFigure`):
 * - what it was: `max(0.7 x stage, min(0.9 x stage, 165cqw))` (a figure about 1.1 times its core's width, up to 0.9 of the stage, and never under 0.7 of it);
 * - `seamClear` px of room between the head's inner edge and the seam, so the two heads do not touch;
 * - the copy: the headline is over the seam, as wide as its widest line (`copyHalfEm` em of the h1's font-size each side of the seam, "Watch filmmakers") down to its bottom (`copyTop` of the stage
 *   to the h1's two lines, the gap and the p's three lines); the head is either beside it (the head's inner edge `copyClear` px short of that line's end) or under it (the crown `copyClear` px under
 *   the copy's bottom): whichever allows the larger figure, so a head is never over the copy's text.
 * The eyes' rule is the lowest of them (`eyeLine`): a figure the copy's room makes smaller than the poster cluster needs has its eyes beside the cluster's first poster, not above it, see the README.
 */
export const TABLET_FIGURE = {
  margin: 16,
  seamClear: 8,
  copyClear: 6,
  copyHalfEm: 4.1,
  copyTop: 0.17,
  copyLinesEm: 2.1,
  /** px under the h1's lines to the copy's bottom: the gap (16px) and the p's three lines (3 x 26px). */
  copyBelow: 94,
} as const;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * A tablet figure's size and place, in px, for a stage `width` px wide and `scene` px high (the halves' height, `--scene-h`): `height` of its box, `edge` (where its outer edge is, from the
 * screen's edge, negative past it), the head's `outer` and `inner` edges from the screen's edge, and the head's `crown` and `chin` from the stage's top. The CSS is `TABLET_FIGURE_HEIGHT_CSS` and
 * `TABLET_FIGURE_OUT_CSS`; this is the same rule in numbers, as `bandWidth` is for the band, so that the pool's every head can be tested. The stage's own numbers it needs are rules of the
 * stage (hero-stage.css): the gutter `clamp(12px, 5vw, 88px)`, the drop `clamp(0px, 0.18 x scene - 90px, 50px)` (the figures' half of it) and the h1's `clamp(34px, min(4.6vw, 0.105 x scene), 68px)`.
 */
export function tabletFigure(width: number, scene: number, head: { top: number; centre: number; width: number }, slot: Slot) {
  const t = TABLET_FIGURE;
  const half = (width - 12) / 2;
  const core = half - clamp(0.05 * width, 12, 88);
  const h1 = clamp(Math.min(0.046 * width, 0.105 * scene), 34, 68);
  const bottom = 1.03 * scene + clamp(0.18 * scene - 90, 0, 50) / 2;
  const was = Math.max(0.7 * scene, Math.min(0.9 * scene, 1.65 * core));
  const seam = (1.5 * (half - t.margin - t.seamClear)) / head.width;
  const beside = (1.5 * (width / 2 - t.copyHalfEm * h1 - t.copyClear - t.margin)) / head.width;
  const under = (bottom - (t.copyTop * scene + t.copyLinesEm * h1 + t.copyBelow) - t.copyClear) / (1 - head.top);
  const height = Math.min(was, seam, Math.max(beside, under));
  const w = (height * 2) / 3;
  return {
    height,
    edge: t.margin - headOuter(head, slot) * w,
    outer: t.margin,
    inner: t.margin + head.width * w,
    crown: bottom - height + head.top * height,
    chin: bottom - height + (head.top + 0.3 * (1 - head.top)) * height,
  };
}

/** The tablet figure's `--fig-h-t` (its box's height), by CSS: `tabletFigure`'s `height`, from `--head-w` and `--head-top` (the head's width across, and its top down, as shares of its photo; set per figure). */
export const TABLET_FIGURE_HEIGHT_CSS = (() => {
  const t = TABLET_FIGURE;
  const half = "(100cqw + var(--core-pad))";
  const seamCap = `1.5 * (${half} - ${t.margin + t.seamClear}px) / var(--head-w)`;
  const beside = `1.5 * (${half} + var(--seam) / 2 - ${t.copyHalfEm} * var(--h1-fs) - ${t.margin + t.copyClear}px) / var(--head-w)`;
  const under = `(1.03 * var(--scene-h) + var(--fig-drop) - (${t.copyTop} * var(--scene-h) + ${t.copyLinesEm} * var(--h1-fs) + ${t.copyBelow}px) - ${t.copyClear}px) / (1 - var(--head-top))`;
  return `min(max(0.7 * var(--scene-h), min(0.9 * var(--scene-h), 165cqw)), ${seamCap}, max(${beside}, ${under}))`;
})();

/** The tablet figure's `--fig-out-t`: where its box's outer edge is from its core's outer edge (`edge`, less the core's `--core-pad` from the screen's edge), from `--head-out` (`headOuter`, set per figure). */
export const TABLET_FIGURE_OUT_CSS = `calc(${TABLET_FIGURE.margin}px - var(--head-out) * var(--fig-h-t) * 2 / 3 - var(--core-pad))`;

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
 * The dots' axis is the band less the year caps' room at each end (`--axis-pad`, 54px on a phone and 64px from `sm` up, set on the stage in hero-stage.css and nowhere
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
