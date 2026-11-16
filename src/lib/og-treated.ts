import { cardFilms } from "@/lib/card-films";
import { joinNames } from "@/lib/format";
import {
  OG_HEIGHT,
  OG_WIDTH,
  pickTimelineFilms,
  sampleEvenly,
  truncateToFit,
  textWidth,
  type OgCard,
  type OgCaption,
  type OgPoster,
} from "@/lib/og-card";
import { inPeriod, type Period } from "@/lib/period";
import { strokeForWidth } from "@/lib/portrait-cuts";
import { montagePosters } from "@/lib/portrait-treatment";
import { isReleased } from "@/lib/released";
import { yearFraction } from "@/lib/timeline-layout";
import type { PersonTimeline } from "@/lib/types";

/**
 * Spike (zherring/spike-portraits): the layout of the treated share cards (the pair's and the quote's), when the portrait flag is on, and what the
 * pair's is made of. Pure, with nothing of the server in it, so the PNG (`og-render.tsx`, `og-quote-render.tsx`) and the embeds' first frame
 * (`pair-poster.tsx`, `quote-embed.tsx`) place the same parts from the same numbers, in the card's own 1200 x 630 pixels.
 *
 * One grid for both cards. The portraits (two, or up to four on a group's page: `treatedTile`) are one column down the left edge, full height, bleeding off the top, the left and the bottom. The rest of
 * the card is a column of `TREATED_WIDTH` px, `TREATED_GUTTER` from the portraits and `TREATED_MARGIN` from the other three edges; the quote and its attribution
 * start on its left edge, `TREATED_LEFT`, and the pair's names and count are centred on it. The wordmark sits in its bottom right corner, on the bottom margin.
 */

/** The portraits' column. */
export const TREATED_COLUMN = 320;
/** The space between portraits (the card's canvas shows through). */
export const TREATED_TILE_GAP = 4;
/** The room from the card's top, right and bottom edges, and between the portraits' column and the rest. */
export const TREATED_MARGIN = 48;
export const TREATED_GUTTER = 48;
/** The rest of the card: its left edge, its right edge and its width. */
export const TREATED_LEFT = TREATED_COLUMN + TREATED_GUTTER;
export const TREATED_RIGHT = OG_WIDTH - TREATED_MARGIN;
export const TREATED_WIDTH = TREATED_RIGHT - TREATED_LEFT;
/** One portrait: the column's width, and the card's height less the gaps, shared out. */
export function treatedTile(count: number): { width: number; height: number } {
  const n = Math.max(1, count);
  return { width: TREATED_COLUMN, height: (OG_HEIGHT - (n - 1) * TREATED_TILE_GAP) / n };
}
/** Where each portrait's top is (the column is `OG_HEIGHT` tall, the portraits share it). */
export function treatedTileTops(count: number): number[] {
  const { height } = treatedTile(count);
  return Array.from({ length: Math.max(1, count) }, (_, i) => i * (height + TREATED_TILE_GAP));
}

/**
 * The portraits of a treated quote card, top to bottom: the page's people in the order of its URL (`slot`, the position in the slug), as the pair's own
 * card has them, whoever is speaking: the portraits stay where they are from one quote to the next. Only the colour follows the speaker: theirs is in colour,
 * the others greyed (`grey`). With no speaker among them (`speakerSlot` null: a critic's quote, or one by a person who is neither) all are in colour.
 */
export function treatedQuotePortraits<T extends { slot: number }>(people: readonly T[], speakerSlot: number | null): (T & { grey: boolean })[] {
  return [...people].sort((a, b) => a.slot - b.slot).map((person) => ({ ...person, grey: speakerSlot !== null && person.slot !== speakerSlot }));
}

/**
 * The width of the cut's edge on a portrait of the column's width, as the PNG draws it (`strokeForWidth`), as a share of the portrait's own width: a CSS length
 * in container units, for a portrait the embeds draw at the frame's scale (it is measured against the portrait's own box, so it scales with it).
 */
export const TREATED_STROKE_CSS = `${Math.round((strokeForWidth(TREATED_COLUMN) / TREATED_COLUMN) * 1e5) / 1e3}cqw`;

/**
 * How far above its box's bottom a line of Inter at line height 1 has its baseline, as a fraction of its size: a line put this much past a margin
 * (a negative margin, or a box this much lower) has its baseline on the margin, which is where the eye measures a line of text from.
 */
export const INTER_BASELINE_DROP = 0.137;

/** The wordmark's size, and the box that puts its baseline on the bottom margin. */
export const TREATED_WORDMARK = 30;

// ---- The pair's card -------------------------------------------------------------------

/** The row of posters of the films they made together: as many as fit `TREATED_WIDTH` side by side at this size, a gap apart; the film picking is the card's own (`pickTimelineFilms`). */
export const TREATED_POSTER = { count: 4, width: 178, height: 267 } as const;
const POSTER_GAP = (TREATED_WIDTH - TREATED_POSTER.count * TREATED_POSTER.width) / (TREATED_POSTER.count - 1);

/** Left edges of `count` posters (0 to `TREATED_POSTER.count`), from the column's left edge, a fixed step apart. */
export function treatedPosterLefts(count: number): number[] {
  const k = Math.min(TREATED_POSTER.count, Math.max(0, Math.floor(count)));
  return Array.from({ length: k }, (_, i) => Math.round(TREATED_LEFT + i * (TREATED_POSTER.width + POSTER_GAP)));
}

/** The names under the axis (small) and the count under them (twice the names' size), the type of both; both are centred on the column. */
export const TREATED_NAMES_SIZE = 24;
export const TREATED_CAPTION_SIZE = 48;
/** A shared film's dot on the axis (white, ringed in the canvas) and a solo film's (a neutral grey, the same for both people: about 3:1 on the canvas). */
export const TREATED_NODE = { size: 18, ring: 3 } as const;
export const TREATED_SOLO_DOT = 8;
export const TREATED_SOLO_COLOR = "#5b6470";
/** The axis's line, and how much of its length at each end it takes to fade out. */
export const TREATED_AXIS_WIDTH = 2;
export const TREATED_AXIS_FADE = 0.14;
/** A year is never wider than this on the axis, so a short stretch of years does not stretch across it. */
export const TREATED_MAX_PX_PER_YEAR = 56;
/** How far apart two films released on the same day are drawn, and the most solo dots on the axis (a long career is thinned to this many, evenly). */
const DOT_SPREAD = 9;
const MAX_SOLO_DOTS = 56;
/** A solo dot fainter than this (it is near the axis's end) is not drawn at all. */
const MIN_DOT_OPACITY = 0.05;

export interface TreatedPairLayout {
  postersTop: number;
  postersBottom: number;
  /** y of the axis's line. */
  axisY: number;
  /** Top of the names' line and of the count's, as the card places their boxes (line height 1). */
  namesTop: number;
  captionTop: number;
  /** The wordmark's box, its baseline on the bottom margin. */
  wordmarkTop: number;
}

/** The size of a line of Inter set at line height 1: its box. */
const lineBox = (size: number) => size;
/** The baseline's lift: how far past the bottom margin a box of `size` goes so that its baseline sits on it. */
const baselineLift = (size: number) => Math.round(size * INTER_BASELINE_DROP);

/** The gaps of the right column, top to bottom: the posters to the axis, the axis to the names' box, the names' box to the count's. */
const POSTERS_TO_AXIS = 44;
const AXIS_TO_NAMES = 40;
const NAMES_TO_CAPTION = 8;

/**
 * Where everything of the pair's card goes, top to bottom: the posters, the axis a gap under them, and the names and the count a gap under the axis. The
 * column is one block, centred in the card's height (the count's baseline, not its box's bottom, is the block's bottom, as the eye measures it, so the
 * space over the posters and under the count is the same); the wordmark is the card's corner, its baseline on the bottom margin.
 */
export function treatedPairLayout(): TreatedPairLayout {
  const block =
    TREATED_POSTER.height + POSTERS_TO_AXIS + AXIS_TO_NAMES + lineBox(TREATED_NAMES_SIZE) + NAMES_TO_CAPTION + lineBox(TREATED_CAPTION_SIZE) - baselineLift(TREATED_CAPTION_SIZE);
  const postersTop = Math.round((OG_HEIGHT - block) / 2);
  const postersBottom = postersTop + TREATED_POSTER.height;
  const axisY = postersBottom + POSTERS_TO_AXIS;
  const namesTop = axisY + AXIS_TO_NAMES;
  return {
    postersTop,
    postersBottom,
    axisY,
    namesTop,
    captionTop: namesTop + lineBox(TREATED_NAMES_SIZE) + NAMES_TO_CAPTION,
    wordmarkTop: OG_HEIGHT - TREATED_MARGIN + baselineLift(TREATED_WORDMARK) - lineBox(TREATED_WORDMARK),
  };
}

/** A film on the axis: white when they made it together (`kind` "shared"), else a neutral grey (`kind` the slot, the URL order, of the person who made it). */
export interface TreatedAxisDot {
  id: number;
  x: number;
  kind: "shared" | number;
  opacity: number;
}

export interface TreatedPair {
  /** The posters of the shared films (the card's own pick, `pickTimelineFilms`, at this card's count), oldest first. */
  posters: OgPoster[];
  /** The axis's dots: the solo films first, the shared ones last, so those are on top. */
  dots: TreatedAxisDot[];
  /** "13 films over 50 years", as the card's caption is (`filmsCaption`), or plain words; its accented segments are the numbers. */
  caption: OgCaption | null;
  /** The two names, as written under the axis, cut to fit one line. */
  names: string;
  /** Per person, in the URL's order: the posters of their best-known films (`montagePosters`), the montage behind their portrait's tear when they have no cut. */
  montages: string[][];
}

/** How opaque the axis is at `x`: full through its middle, fading in a straight line to nothing at both ends. */
export function treatedAxisFade(x: number): number {
  const fade = TREATED_AXIS_FADE * TREATED_WIDTH;
  if (x <= TREATED_LEFT || x >= TREATED_RIGHT) return 0;
  if (x < TREATED_LEFT + fade) return (x - TREATED_LEFT) / fade;
  if (x > TREATED_RIGHT - fade) return (TREATED_RIGHT - x) / fade;
  return 1;
}

/** The axis's line as a gradient: transparent at both ends, solid through the middle (`rgb` is "r, g, b"). */
export function treatedAxisGradient(rgb: string, alpha: number): string {
  const edge = TREATED_AXIS_FADE * 100;
  return `linear-gradient(to right, rgba(${rgb}, 0) 0%, rgba(${rgb}, ${alpha}) ${edge}%, rgba(${rgb}, ${alpha}) ${100 - edge}%, rgba(${rgb}, 0) 100%)`;
}

/** The names under the axis (centred): "Robert De Niro & Martin Scorsese", "A, B & C" for more, cut with an ellipsis if it would run past the column. */
function namesLine(names: readonly string[]): string {
  return truncateToFit(joinNames([...names]), (line) => textWidth(line, TREATED_NAMES_SIZE) <= TREATED_WIDTH);
}

/**
 * What the pair's treated card draws, from `card` (the plain card's, which has the people, the caption and the films' year range) and the people's own films:
 * the posters of the shared films (up to `TREATED_POSTER.count`), and the axis, where every film is a dot: shared ones white, each person's solo films
 * grey. The axis's scale is the lane's: the shared films' years, from the first to the last, are centred and take the axis's middle (what the ends'
 * fade leaves), each year `TREATED_MAX_PX_PER_YEAR` wide at most; the solo films around them show as far as the axis does, fading with it. Null for
 * fewer than two people (a person's own page keeps the plain card). Three and four people (`MAX_PEOPLE`) are the same card: the shared films are the films
 * all of them made, the dots are every one's own, the names are joined ("A, B & C").
 */
export function buildTreatedPair(card: OgCard, timelines: readonly PersonTimeline[], today: string, period: Period | null = null): TreatedPair | null {
  if (timelines.length < 2) return null;
  const { films: all, source } = cardFilms([...timelines], today);
  const films = all.filter((film) => inPeriod(film.year, period));
  const posters = pickTimelineFilms(films, TREATED_POSTER.count);
  const sharedIds = new Set(source === "shared" ? films.map((film) => film.id) : []);

  // The scale: the active years, centred, in what the ends' fade leaves of the axis.
  const times = films.map((film) => yearFraction(film.releaseDate));
  const first = times.length > 0 ? Math.min(...times) : 0;
  const last = times.length > 0 ? Math.max(...times) : 0;
  const span = last - first;
  const room = TREATED_WIDTH * (1 - 2 * TREATED_AXIS_FADE);
  const perYear = span > 0 ? Math.min(TREATED_MAX_PX_PER_YEAR, room / span) : TREATED_MAX_PX_PER_YEAR;
  const centre = (TREATED_LEFT + TREATED_RIGHT) / 2;
  const xOf = (releaseDate: string) => centre + (yearFraction(releaseDate) - (first + last) / 2) * perYear;

  /** Films released the same day would sit on one another: a run of them is spread `DOT_SPREAD` apart, centred on where they belong. */
  const spread = (dots: { id: number; releaseDate: string }[]) => {
    const sorted = [...dots].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.id - b.id);
    const xs = sorted.map((dot) => xOf(dot.releaseDate));
    let start = 0;
    while (start < sorted.length) {
      let end = start;
      while (end + 1 < sorted.length && sorted[end + 1].releaseDate === sorted[start].releaseDate) end++;
      const size = end - start + 1;
      const centreX = xs[start];
      for (let i = 0; i < size; i++) xs[start + i] = centreX + (i - (size - 1) / 2) * DOT_SPREAD;
      start = end + 1;
    }
    return sorted.map((dot, i) => ({ id: dot.id, x: xs[i] }));
  };

  const solo: TreatedAxisDot[] = timelines.flatMap(({ films: own }, slot) => {
    const seen = new Set<number>();
    const mine = own.filter((film) => {
      if (film.minor || !isReleased(film.releaseDate, today) || !inPeriod(film.year, period) || sharedIds.has(film.id) || seen.has(film.id)) return false;
      seen.add(film.id);
      return true;
    });
    return spread(mine).map(({ id, x }): TreatedAxisDot => ({ id, x, kind: slot, opacity: treatedAxisFade(x) }));
  });
  const visible = solo.filter((dot) => dot.opacity >= MIN_DOT_OPACITY);
  // Thinned evenly, by position along the axis, so the sample does not favour a person.
  const thinned = sampleEvenly([...visible].sort((a, b) => a.x - b.x), MAX_SOLO_DOTS);

  const shared: TreatedAxisDot[] = spread(films.filter((film) => sharedIds.has(film.id))).map(({ id, x }) => ({ id, x, kind: "shared", opacity: 1 }));
  return {
    posters,
    dots: [...thinned, ...shared],
    caption: card.caption,
    names: namesLine(card.people.map((person) => person.name)),
    montages: timelines.map(({ films: own }) => montagePosters(own)),
  };
}
