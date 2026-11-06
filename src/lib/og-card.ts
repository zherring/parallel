import { cardFilms, careerFilms, type CardFilm } from "@/lib/card-films";
import { inPeriod, periodLabel, type Period } from "@/lib/period";
import { initials } from "@/lib/person-labels";
import { headingNames } from "@/lib/short-name";
import { yearFraction } from "@/lib/timeline-layout";
import type { PersonTimeline } from "@/lib/types";

/** Posters on a card: this many when the card has that many films, the first and the last always among them. */
export const OG_POSTER_TARGET = 6;
/** The most posters a card is laid out for. */
export const OG_POSTER_MAX = 8;

/**
 * Which films the lane under the cards shows, and so what its time range is. The green nodes are always
 * the films with a poster; this decides the grey dots around them.
 *
 *  - "all-films": a grey dot for every other film any of the people made (released, not a short or a cameo;
 *    one dot for a film two of them are in), and the lane's range is from the first of those films to the last.
 *  - "card-films": only the films the card is about (the ones they made together, or the careers when they
 *    share none), as the lane was before; the range is from the first of those to the last.
 *
 * Flip this one constant to change it.
 */
export type LaneScope = "all-films" | "card-films";
export const OG_LANE_SCOPE: LaneScope = "all-films";

/** The most small grey dots on the lane; a longer career is thinned to this many, evenly. Every green node is always kept. */
export const OG_MAX_DIM_DOTS = 90;
/** A grey dot fainter than this (it is near the card's edge, see `laneFade`) is not drawn at all. */
export const OG_MIN_DOT_OPACITY = 0.05;

/** A run of text in the caption; `accent` ones are set in the accent color (the numbers). */
export interface OgSegment {
  text: string;
  accent: boolean;
}

export interface OgCaption {
  segments: OgSegment[];
}

export interface OgPerson {
  /** Full name, for alt text. */
  name: string;
  /** The name as it is laid over the bottom of the headshot, one string per line (see `fitOverlayNames`). */
  overlay: string[];
  initials: string;
  profilePath: string | null;
}

/** One poster on the card, in the row above the lane. */
export interface OgPoster {
  id: number;
  title: string;
  year: number;
  /** Null when TMDB has no poster; the card then draws the title's initial instead. */
  posterPath: string | null;
}

/** One film on the lane: a green node when it is one of the posters (`featured`), a small dim dot when not. */
export interface OgDot {
  id: number;
  /** ISO yyyy-mm-dd; where on the lane it goes. */
  releaseDate: string;
  featured: boolean;
}

/**
 * How time becomes x on the lane: the middle of the active years (from the first green node to the last) is at the
 * middle of the active zone, and a year is `pxPerYear` wide. Times are fractional years (see `yearFraction`).
 */
export interface LaneScale {
  /** The time at the middle of the active zone. */
  mid: number;
  pxPerYear: number;
}

/** A film on the lane, placed: where it is (`x`, in px from the card's left edge) and how opaque (the lane fades out toward the card's edges; green nodes never fade). */
export interface PlacedDot extends OgDot {
  x: number;
  opacity: number;
}

export interface OgCard {
  /** One person: a career card; two or more: a collaboration card. */
  kind: "solo" | "pair";
  people: OgPerson[];
  /** Size of the names over the headshots, the same on every card of the row. */
  overlayFontSize: number;
  /** The posters above the lane, oldest first: the first film, the best known in between, the last film. */
  posters: OgPoster[];
  /** The films on the lane, oldest first, placed: the posters' films are the featured ones; grey dots off the card or too faint are dropped, and a long career is thinned. */
  dots: PlacedDot[];
  /** How time becomes x on the lane. Null without films. */
  lane: LaneScale | null;
  /** The years of the first and the last film of the card's film set: the labels under the first and last green node. Null without films. */
  years: { first: number; last: number } | null;
  /** Under the lane: "11 films over 20 years". */
  caption: OgCaption | null;
  /** "1978–1993" when the card shows only that period, else null. */
  period: string | null;
  /**
   * The years-active chip, centred under the lane above the caption: the period's label ("1966–1981") on a period
   * card, else the years of the first and last green node ("2005–2012", or "1991" for one year). Null without films.
   */
  chip: string | null;
}

/** `text` cut to at most `max` characters, ending in an ellipsis when it was cut. */
export function truncateName(text: string, max: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return chars.join("");
  return `${chars.slice(0, Math.max(1, max - 1)).join("").trimEnd()}…`;
}

/** Release order; films released on the same day, best known first, then by id: the same order on every run. */
const chronological = (a: CardFilm, b: CardFilm) =>
  a.releaseDate.localeCompare(b.releaseDate) || b.voteCount - a.voteCount || a.id - b.id;

/**
 * The films that get a poster, oldest first: always the first film and the last one (of two
 * released on the same day, the better known), then the best known of the rest until there are
 * `max`. Films with a poster come before those without when filling; a card with a `max` of 1
 * shows the first film only.
 */
export function pickTimelineFilms(films: readonly CardFilm[], max: number = OG_POSTER_TARGET): OgPoster[] {
  const slots = Math.floor(max);
  if (films.length === 0 || slots < 1) return [];

  const sorted = [...films].sort(chronological);
  const first = sorted[0];
  const lastDate = sorted[sorted.length - 1].releaseDate;
  const last = sorted.find((film) => film.releaseDate === lastDate)!;

  const chosen = new Set<CardFilm>([first]);
  if (slots >= 2) chosen.add(last);

  const rest = sorted.filter((film) => !chosen.has(film));
  const better = (a: CardFilm, b: CardFilm) => b.voteCount - a.voteCount || chronological(a, b);
  const ranked = [...rest.filter((film) => film.posterPath).sort(better), ...rest.filter((film) => !film.posterPath).sort(better)];
  for (const film of ranked) {
    if (chosen.size >= slots) break;
    chosen.add(film);
  }

  return sorted
    .filter((film) => chosen.has(film))
    .map(({ id, title, year, posterPath }) => ({ id, title, year, posterPath }));
}

/** `items` thinned to at most `max`, evenly through the list (the first and last stay); all of them when there are no more than `max`. */
export function sampleEvenly<T>(items: readonly T[], max: number): T[] {
  if (max <= 0) return [];
  if (items.length <= max) return [...items];
  if (max === 1) return [items[0]];
  return Array.from({ length: max }, (_, i) => items[Math.round((i * (items.length - 1)) / (max - 1))]);
}

/**
 * Every film of the lane as a point on it, oldest first, one per film; the ones in `posters` are featured
 * (they get a green node, the rest a grey dot). Placing them, and thinning a long career, is `placeDots`.
 */
export function axisDots(films: readonly CardFilm[], posters: readonly OgPoster[]): OgDot[] {
  const featured = new Set(posters.map((poster) => poster.id));
  const seen = new Set<number>();
  return [...films]
    .sort(chronological)
    .filter((film) => !seen.has(film.id) && seen.add(film.id))
    .map(({ id, releaseDate }): OgDot => ({ id, releaseDate, featured: featured.has(id) }));
}

/**
 * The films the lane is drawn from, before any period: for "all-films" every film of the people's careers
 * (and the card's films, which the careers hold already, so a card never loses a green node), for
 * "card-films" the card's films alone. One entry per film.
 */
export function laneFilms(scope: LaneScope, card: readonly CardFilm[], careers: readonly CardFilm[]): CardFilm[] {
  const all = scope === "all-films" ? [...careers, ...card] : [...card];
  const byId = new Map<number, CardFilm>();
  for (const film of all) if (!byId.has(film.id)) byId.set(film.id, film);
  return [...byId.values()];
}

const filmsWord = (count: number) => (count === 1 ? "film" : "films");
const yearsWord = (count: number) => (count === 1 ? "year" : "years");

/**
 * "11 films over 20 years" for films of different years, "3 films in 1994" for one year, "1 film
 * in 1994" for one film: never "1 films" or "0 years". Both numbers (the count and the years, or the
 * year) are accented. Null without films.
 */
export function filmsCaption(films: readonly Pick<CardFilm, "year">[]): OgCaption | null {
  if (films.length === 0) return null;
  const first = Math.min(...films.map((film) => film.year));
  const last = Math.max(...films.map((film) => film.year));
  const years = last - first;
  const count = String(films.length);
  const segments: OgSegment[] =
    years === 0
      ? [
          { text: count, accent: true },
          { text: ` ${filmsWord(films.length)} in `, accent: false },
          { text: String(first), accent: true },
        ]
      : [
          { text: count, accent: true },
          { text: ` ${filmsWord(films.length)} over `, accent: false },
          { text: String(years), accent: true },
          { text: ` ${yearsWord(years)}`, accent: false },
        ];
  return { segments };
}

/** A caption of plain words, in the muted color: "Careers side by side". */
export function plainCaption(text: string): OgCaption {
  return { segments: [{ text, accent: false }] };
}

/** The caption as one line of text. */
export function captionText(caption: OgCaption): string {
  return caption.segments.map((segment) => segment.text).join("");
}

/** "2005–2012" for the years of the first and last film, "1991" for one year; null without films. Same wording as a period's label. */
export function activeYearsLabel(years: { first: number; last: number } | null): string | null {
  return years ? periodLabel({ from: years.first, to: years.last }) : null;
}

/** The year of the first film and of the last one; null without films. */
export function yearRange(films: readonly Pick<CardFilm, "year">[]): { first: number; last: number } | null {
  if (films.length === 0) return null;
  return { first: Math.min(...films.map((film) => film.year)), last: Math.max(...films.map((film) => film.year)) };
}

// ---- Text -----------------------------------------------------------------------

/** How wide each character of Inter SemiBold is, in ems (its advance widths, rounded); a letter not listed is `DEFAULT_EM`. */
const EM: Record<string, number> = {};
const widths = (chars: string, em: number) => {
  for (const char of chars) EM[char] = em;
};
widths(" ", 0.28);
widths("il.,:;'!|j", 0.27);
widths("I", 0.3);
widths("ft-()/", 0.38);
widths("r", 0.39);
widths("z", 0.5);
widths("sJ", 0.53);
widths("vy", 0.54);
widths("x", 0.55);
widths("k", 0.56);
widths("acL", 0.57);
widths("e", 0.58);
widths("F", 0.59);
widths("hnu", 0.6);
widths("o", 0.61);
widths("bdgpq0123456789ESZ", 0.62);
widths("PTY", 0.64);
widths("RX", 0.66);
widths("BK", 0.67);
widths("V", 0.68);
widths("A", 0.7);
widths("C&", 0.72);
widths("DU", 0.74);
widths("GH", 0.75);
widths("N", 0.76);
widths("OQ", 0.78);
widths("w", 0.81);
widths("M", 0.88);
widths("m", 0.91);
widths("W@", 1);
widths("…", 0.95);
const DEFAULT_EM = 0.6;
/** Text is set a little wider than this says (the table is rounded, and kerning varies); so a name is cut a little early rather than late. */
const WIDTH_SAFETY = 1.03;

/** About how wide `text` is, in px, set in Inter SemiBold at `fontSize` px (accents count as their letter). */
export function textWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const char of text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) em += EM[char] ?? DEFAULT_EM;
  return em * fontSize * WIDTH_SAFETY;
}

/** Whether a line fits: what the text functions below ask of a line. */
export type Fits = (line: string) => boolean;

/** `text` cut to the most characters that fit with an ellipsis after them; the text itself if it fits. */
export function truncateToFit(text: string, fits: Fits): string {
  const chars = Array.from(text.trim());
  if (fits(chars.join(""))) return chars.join("");
  for (let n = chars.length - 1; n >= 1; n--) {
    const cut = `${chars.slice(0, n).join("").trimEnd()}…`;
    if (fits(cut)) return cut;
  }
  return "…";
}

/** `text` broken into lines that fit, at the spaces; null when a single word does not fit a line. */
export function wrapWords(text: string, fits: Fits): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!fits(word)) return null;
    if (line && !fits(`${line} ${word}`)) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * `text` as at most `maxLines` lines that fit: broken at the spaces, a word that does not fit a line cut with an
 * ellipsis, and the last line cut with an ellipsis where the text runs on past it.
 */
export function clampLines(text: string, fits: Fits, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    if (lines.length === maxLines - 1) {
      lines.push(truncateToFit(words.slice(i).join(" "), fits));
      break;
    }
    const whole = fits(words[i]);
    let line = whole ? words[i] : truncateToFit(words[i], fits);
    i++;
    while (whole && i < words.length && fits(`${line} ${words[i]}`)) {
      line += ` ${words[i]}`;
      i++;
    }
    lines.push(line);
  }
  return lines;
}

// ---- Headshots --------------------------------------------------------------------

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Where the row of headshot cards goes (they are centred in it): to the left of the active zone, with a gap to the first poster. */
export const OG_FAN_ZONE = { left: 36, right: 506 } as const;
export const OG_FAN_WIDTH = OG_FAN_ZONE.right - OG_FAN_ZONE.left;

/**
 * The active zone: the part of the card the active years (from the first film's green node to the last) are centred
 * in. The poster row and the lane's nodes both use it, so they centre on the same x, and the lane is fully opaque
 * across it (see `laneFade`).
 */
export const OG_ACTIVE_ZONE = { left: 520, right: 1090 } as const;
export const OG_ACTIVE_CENTER = (OG_ACTIVE_ZONE.left + OG_ACTIVE_ZONE.right) / 2;

/** The headshot card of one or two people. Three or four get `HEADSHOT_SCALE` of it. */
export const HEADSHOT = { width: 225, height: 300 } as const;
/** How big the headshot cards are, by the number of people, as a share of `HEADSHOT`: three and four people get a smaller card so the row still fits. Change a number to change a size. */
export const HEADSHOT_SCALE: Readonly<Record<number, number>> = { 1: 1, 2: 1, 3: 0.7, 4: 0.7 };
/**
 * How far apart the left edges of the cards are, as a share of a card's width, by the number of people: tighter with
 * more of them (the 150 and 124 of a 180px card, as before). Four people pack as tightly as the fan zone needs, whatever
 * share that is.
 */
const HEADSHOT_STEP_RATIO: Readonly<Record<number, number>> = { 1: 0, 2: 150 / 180, 3: 124 / 180, 4: Number.POSITIVE_INFINITY };
/**
 * How far a card hangs below the lane's line, as a share of its height: the cards rest on the lane, with its line
 * crossing them about 5/6 of the way down.
 */
export const HEADSHOT_OVERHANG_RATIO = 1 / 6;

/** How far a headshot card of this height hangs below the lane's line. */
export function headshotOverhang(cardHeight: number): number {
  return Math.round(cardHeight * HEADSHOT_OVERHANG_RATIO);
}

export interface HeadshotCard {
  /** Left edge, from the left edge of the fan. */
  left: number;
  /** How much of the card's left side the card on top of it covers; 0 for the first card, which is on top of the rest. */
  covered: number;
  /** How much of the card shows: all of it for the first card, the part to the right of the card on top for the others. */
  visible: number;
}

export interface HeadshotFan {
  width: number;
  height: number;
  /** How far the cards hang below the lane's line. */
  overhang: number;
  /** Where each person's card goes, in the order of the people. The first is on top. */
  cards: HeadshotCard[];
  /** Width of the row the cards fill together. */
  totalWidth: number;
}

/**
 * How the headshot cards of one to four people sit: straight, rounded, all the same size, side by side
 * and overlapping, the first (leftmost) card on top. The more people there are the smaller the cards
 * (`HEADSHOT_SCALE`) and the closer they pack, so the fan stays inside its zone, clear of the posters.
 */
export function headshotFan(count: number): HeadshotFan {
  const n = Math.min(4, Math.max(1, Math.floor(count)));
  const scale = HEADSHOT_SCALE[n];
  const width = Math.round(HEADSHOT.width * scale);
  const height = Math.round(HEADSHOT.height * scale);
  const step = n === 1 ? 0 : Math.min(Math.round(width * HEADSHOT_STEP_RATIO[n]), Math.floor((OG_FAN_WIDTH - width) / (n - 1)));
  const cards = Array.from({ length: n }, (_, i): HeadshotCard => {
    const covered = i === 0 ? 0 : Math.max(0, width - step);
    return { left: i * step, covered, visible: width - covered };
  });
  return { width, height, overhang: headshotOverhang(height), cards, totalWidth: width + (n - 1) * step };
}

/** The room for text in a part of a card that shows `visible` px: the left padding and the right padding come off. */
export const OVERLAY_PAD = { left: 10, right: 6 } as const;
/** The names over the headshots: as large as 20px, as small as 14px (the size at which "Cronenweth" fits the part of a card that shows with four people). */
export const OVERLAY_FONT = { max: 20, min: 14 } as const;
export const OVERLAY_MAX_LINES = 3;

export interface OverlayNames {
  /** Per person, the lines of the name. */
  lines: string[][];
  fontSize: number;
}

/**
 * The names over the bottoms of the headshot cards. `candidates[i]` is what can be written for person `i`, best
 * first (the full name, then the family name for a crowded row), and `visible[i]` how much of that person's card
 * shows (see `HeadshotCard`). One size for the whole row: the largest from `OVERLAY_FONT.max` down to
 * `OVERLAY_FONT.min` at which every person has a candidate that fits its part of the card in at most three
 * lines, without cutting a word. Failing that, at the smallest size, each person gets their first candidate
 * that fits, or else their last one cut with an ellipsis.
 */
export function fitOverlayNames(candidates: readonly (readonly string[])[], visible: readonly number[]): OverlayNames {
  const room = (i: number) => Math.max(1, visible[i] - OVERLAY_PAD.left - OVERLAY_PAD.right);
  const fitsIn = (i: number, fontSize: number): Fits => (line) => textWidth(line, fontSize) <= room(i);
  const wrapped = (i: number, fontSize: number): string[] | null => {
    for (const text of candidates[i]) {
      const lines = wrapWords(text, fitsIn(i, fontSize));
      if (lines && lines.length <= OVERLAY_MAX_LINES) return lines;
    }
    return null;
  };

  for (let fontSize = OVERLAY_FONT.max; fontSize >= OVERLAY_FONT.min; fontSize--) {
    const lines = candidates.map((_, i) => wrapped(i, fontSize));
    if (lines.every((l): l is string[] => l !== null)) return { lines, fontSize };
  }
  const fontSize = OVERLAY_FONT.min;
  return {
    fontSize,
    lines: candidates.map((texts, i) => wrapped(i, fontSize) ?? clampLines(texts[texts.length - 1] ?? "", fitsIn(i, fontSize), OVERLAY_MAX_LINES)),
  };
}

// ---- Posters and lane ---------------------------------------------------------------

/** The poster row: 2:3 posters side by side across the active zone, each partly covering the one before it. */
export const OG_POSTER = { width: 120, height: 180 } as const;
/** How far apart the left edges of neighbouring posters may be, as a share of a poster's width: a short row stays a stack. */
const MAX_POSTER_STEP = 0.82;
/** How far apart two films released on the same day are drawn on the lane. */
export const DOT_SPREAD = 9;
/** The gap between the bottom of the posters and the lane. */
export const POSTER_GAP = 40;

/** Left edges of `count` (0 to OG_POSTER_MAX) posters in the active zone: as wide as it, or less when there are few, and centred on it. */
export function posterRow(count: number): number[] {
  const k = Math.min(OG_POSTER_MAX, Math.max(0, Math.floor(count)));
  if (k === 0) return [];
  const zone = OG_ACTIVE_ZONE.right - OG_ACTIVE_ZONE.left;
  const { width } = OG_POSTER;
  const step = k > 1 ? Math.min((zone - width) / (k - 1), width * MAX_POSTER_STEP) : 0;
  const left = OG_ACTIVE_ZONE.left + (zone - ((k - 1) * step + width)) / 2;
  return Array.from({ length: k }, (_, i) => Math.round(left + i * step));
}

export const YEAR_LABEL_HALF = 30;
/** Room kept on each side of the active years inside the active zone, so a year label under the first or last node stays inside it. */
export const OG_ACTIVE_INSET = YEAR_LABEL_HALF;
/** A year is never wider than this on the lane, so a short stretch of years does not stretch across the zone. */
export const OG_MAX_PX_PER_YEAR = 50;

/**
 * How the lane maps time to x, from the times (fractional years) of the green nodes: the active years, from the first
 * to the last, are centred in the active zone, each year `OG_MAX_PX_PER_YEAR` wide or less when the years would not fit
 * the zone (less `OG_ACTIVE_INSET` each side). One time, or all at one moment, is the middle of the zone. Null without green nodes.
 */
export function laneScale(greenTimes: readonly number[]): LaneScale | null {
  if (greenTimes.length === 0) return null;
  const first = Math.min(...greenTimes);
  const last = Math.max(...greenTimes);
  const span = last - first;
  const room = OG_ACTIVE_ZONE.right - OG_ACTIVE_ZONE.left - 2 * OG_ACTIVE_INSET;
  return { mid: (first + last) / 2, pxPerYear: span > 0 ? Math.min(OG_MAX_PX_PER_YEAR, room / span) : OG_MAX_PX_PER_YEAR };
}

/**
 * How opaque the lane is at `x` (px from the card's left edge): fully across the active zone, and fading out in a
 * straight line to nothing at the card's left and right edges. Grey dots use it too; green nodes never fade.
 */
export function laneFade(x: number, width: number = OG_WIDTH): number {
  if (x >= OG_ACTIVE_ZONE.left && x <= OG_ACTIVE_ZONE.right) return 1;
  if (x < OG_ACTIVE_ZONE.left) return Math.max(0, x / OG_ACTIVE_ZONE.left);
  return Math.max(0, (width - x) / (width - OG_ACTIVE_ZONE.right));
}

/**
 * The x of each film on the lane, in order: its date's place in `lane`. Films released on the same day would
 * sit on top of each other, so a group of them is spread `spread` px apart around where they belong. With no
 * scale the films sit in the middle of the active zone.
 */
export function dotPositions(dots: readonly Pick<OgDot, "releaseDate">[], lane: LaneScale | null, spread: number = DOT_SPREAD): number[] {
  if (dots.length === 0) return [];
  const times = dots.map((dot) => yearFraction(dot.releaseDate));
  const xs = times.map((time) => (lane ? OG_ACTIVE_CENTER + (time - lane.mid) * lane.pxPerYear : OG_ACTIVE_CENTER));

  // Runs of films released on one day fan out, centred on where they belong.
  const out = [...xs];
  let start = 0;
  while (start < times.length) {
    let end = start;
    while (end + 1 < times.length && times[end + 1] === times[start]) end++;
    const size = end - start + 1;
    for (let i = 0; i < size; i++) out[start + i] = xs[start] + (i - (size - 1) / 2) * spread;
    start = end + 1;
  }
  return out;
}

/**
 * The lane's films, placed: each with its x and its opacity (see `laneFade`; green nodes are always fully opaque
 * and always kept). Grey dots that fall off the card, or are fainter than `OG_MIN_DOT_OPACITY`, are dropped; more than
 * `maxDim` of those left are thinned to an even sample, so a long career stays a lane of dots and not a bar.
 */
export function placeDots(dots: readonly OgDot[], lane: LaneScale | null, maxDim: number = OG_MAX_DIM_DOTS): PlacedDot[] {
  const xs = dotPositions(dots, lane);
  const placed = dots.map((dot, i): PlacedDot => ({ ...dot, x: xs[i], opacity: dot.featured ? 1 : laneFade(xs[i]) }));
  const shown = placed.filter((dot) => dot.featured || (dot.x >= 0 && dot.x <= OG_WIDTH && dot.opacity >= OG_MIN_DOT_OPACITY));
  const kept = new Set(sampleEvenly(shown.filter((dot) => !dot.featured), maxDim).map((dot) => dot.id));
  return shown.filter((dot) => dot.featured || kept.has(dot.id));
}

/**
 * Where the year labels under the first and the last green node go (their centres): under the nodes, nudged
 * so that a label stays inside the active zone (so clear of the headshots) and the two do not touch. One label,
 * under the middle of the two nodes, when both years are the same.
 */
export function yearLabelXs(firstX: number, lastX: number, years: { first: number; last: number }): number[] {
  const min = OG_ACTIVE_ZONE.left + YEAR_LABEL_HALF;
  const max = OG_ACTIVE_ZONE.right - YEAR_LABEL_HALF;
  const clamp = (x: number) => Math.min(max, Math.max(min, x));
  if (years.first === years.last) return [clamp((firstX + lastX) / 2)];

  let a = clamp(firstX);
  let b = clamp(lastX);
  const gap = 2 * YEAR_LABEL_HALF + 12;
  if (b - a < gap) {
    const middle = (a + b) / 2;
    a = middle - gap / 2;
    b = middle + gap / 2;
    // Pushed against an edge, the pair slides inwards.
    if (a < min) [a, b] = [min, min + gap];
    if (b > max) [a, b] = [max - gap, max];
  }
  return [a, b];
}

// ---- Vertical layout: the whole composition, centred on the card ---------------------

/** Size of the green node on the lane, and of a dim dot (the app's node radii, 6 and 3, drawn 1.6 times as big). */
export const NODE_SIZE = 20;
export const DIM_DOT_SIZE = 8;
/** The year labels under the lane: 22px type, set a little under it. `height` is how far their ink reaches (the digits end a few px above the line box), which is what the eye measures the whitespace from. */
const YEARS = { gap: 16, height: 20 } as const;
/** The years-active chip: a pill, centred under the year labels; its gap above is from the year labels. */
export const CHIP = { gap: 14, height: 40 } as const;
/** The caption's gap below the chip (or, on a card without one, below the year labels), and its height. */
const CAPTION = { gap: 18, height: 36 } as const;
/** The first thing under the lane (the chip) starts at least this far under the bottom of the headshot cards, which hang below the lane and can reach under it. */
const CAPTION_CLEARANCE = 16;
/** The middle of the card: the chip and the caption are centred on it. */
export const OG_CENTER_X = OG_WIDTH / 2;
/** The room kept clear under the caption. */
export const MIN_BOTTOM_CLEARANCE = 40;
/** On a card with no lane the caption goes this far under the cards, and is this tall. */
const BARE = { gap: 34, captionHeight: 44 } as const;
/** Highest the composition may reach: under the wordmark. */
export const COMPOSITION_TOP = 110;
export const COMPOSITION_BOTTOM = OG_HEIGHT - 36;

export interface Composition {
  /** Top of the composition: its highest element (the headshots, or the posters). */
  top: number;
  /** y of the lane's line; null on a card with no lane. */
  laneY: number | null;
  /** Top and bottom of the headshot cards: they hang `overhang` below the lane's line. */
  headshotTop: number;
  headshotBottom: number;
  postersTop: number;
  postersBottom: number;
  /** Top of the years under the lane's green nodes; null on a card with no lane. */
  yearsTop: number | null;
  /** Bottom of the year labels: the lowest part of the timeline in the middle column; null on a card with no lane. */
  yearsBottom: number | null;
  /** Top of the years-active chip, between the year labels and the caption; null on a card with no lane (or without a chip). */
  chipTop: number | null;
  captionTop: number;
  /** Bottom of the caption: the bottom of the composition. */
  bottom: number;
}

/**
 * Where everything goes from top to bottom. Under the timeline sits one block, the years-active chip, a gap and the
 * caption (just the caption on a card without a chip); its place is what everything hangs on:
 *
 *  1. The whitespace above the block, from the bottom of the year labels (the lowest part of the timeline in the middle
 *     column) to the top of the chip, equals the whitespace below it, from the bottom of the caption to the card's bottom
 *     edge, to the pixel. That fixes where the block is for a given lane `y`, and the block never starts closer than
 *     the floor: `CHIP.gap` under the year labels, and `CAPTION_CLEARANCE` under the headshot cards, which hang below the lane.
 *  2. The rest of the stack (headshots and posters above the lane, the year labels under it) is rigid around the lane.
 *     Where the lane goes is then the position that centres the whole stack, from the top of the cards to the bottom of the
 *     caption, on the card, as nearly as rule 1 allows.
 *  3. But the stack never starts above `minTop` (`COMPOSITION_TOP`, under the wordmark, which never moves): where that
 *     binds, as it does for every real card, the stack sits a little low, and rule 1 still holds.
 */
export function composition(
  headshotHeight: number,
  withLane: boolean = true,
  withChip: boolean = true,
  minTop: number = COMPOSITION_TOP,
): Composition {
  const overhang = headshotOverhang(headshotHeight);
  if (!withLane) {
    const total = headshotHeight + BARE.gap + BARE.captionHeight;
    const top = Math.round(Math.max(COMPOSITION_TOP, Math.min(COMPOSITION_BOTTOM - total, (OG_HEIGHT - total) / 2)));
    return {
      top,
      laneY: null,
      headshotTop: top,
      headshotBottom: top + headshotHeight,
      postersTop: top,
      postersBottom: top,
      yearsTop: null,
      yearsBottom: null,
      chipTop: null,
      captionTop: top + headshotHeight + BARE.gap,
      bottom: top + total,
    };
  }

  // Under the lane: the year labels end `labelsBottom` below it, and the block (chip, gap, caption) is `blockHeight` tall.
  const labelsBottom = YEARS.gap + YEARS.height;
  const blockHeight = (withChip ? CHIP.height + CAPTION.gap : 0) + CAPTION.height;
  const floor = Math.max(labelsBottom + CHIP.gap, overhang + CAPTION_CLEARANCE);
  // The highest thing above the lane is the taller of the headshots (less what hangs below it) and the posters.
  const above = Math.max(headshotHeight - overhang, POSTER_GAP + OG_POSTER.height);

  // The lane that centres the stack when the block sits as rule 1 puts it: top + bottom = card height, where
  // top = lane - above, bottom = lane + blockOffset + blockHeight and blockOffset = (card - lane - blockHeight + labelsBottom) / 2.
  const centredLane = (OG_HEIGHT + 2 * above - blockHeight - labelsBottom) / 3;
  const top = Math.max(minTop, Math.round(centredLane - above));
  const laneY = top + above;
  // Equal whitespace above and below the block (within a pixel, they are whole), but never closer than the floor.
  const blockOffset = Math.max(floor, Math.round((OG_HEIGHT - laneY - blockHeight + labelsBottom) / 2));
  const blockTop = laneY + blockOffset;
  return {
    top,
    laneY,
    headshotTop: laneY + overhang - headshotHeight,
    headshotBottom: laneY + overhang,
    postersTop: laneY - POSTER_GAP - OG_POSTER.height,
    postersBottom: laneY - POSTER_GAP,
    yearsTop: laneY + YEARS.gap,
    yearsBottom: laneY + labelsBottom,
    chipTop: withChip ? blockTop : null,
    captionTop: blockTop + (withChip ? CHIP.height + CAPTION.gap : 0),
    bottom: blockTop + blockHeight,
  };
}

/**
 * Decides what the preview card for a /p/ page shows; the route only draws it. `today` is
 * yyyy-mm-dd: films that have not been released yet are not part of the card (see `cardFilms`).
 * With a `period`, only the films of those years are: the first and last film, the best known in
 * between, the years, the lane and the caption are all picked from that slice. `scope` says
 * which films the lane shows (see `LaneScope`).
 */
export function buildOgCard(
  timelines: PersonTimeline[],
  today: string,
  period: Period | null = null,
  scope: LaneScope = OG_LANE_SCOPE,
): OgCard {
  const people = timelines.map((t) => ({ id: t.person.id, name: t.person.name }));
  const fan = headshotFan(people.length);
  // Full names for one or two people; for three or four the family name when the full one does not fit its part of the card.
  const full = people.map((person) => person.name);
  const family = headingNames(people, true);
  const overlay = fitOverlayNames(
    people.map((_, i) => (people.length >= 3 ? [full[i], family[i]] : [full[i]])),
    fan.cards.map((card) => card.visible),
  );
  const ogPeople: OgPerson[] = timelines.map(({ person }, i) => ({
    name: person.name,
    overlay: overlay.lines[i],
    initials: initials(person.name),
    profilePath: person.profilePath,
  }));

  const { films: all, source } = cardFilms(timelines, today);
  const films = all.filter((film) => inPeriod(film.year, period));
  const label = period ? periodLabel(period) : null;

  let caption: OgCaption | null;
  if (films.length === 0) {
    caption = plainCaption(label ? `No films in ${label}` : timelines.length > 1 ? "Careers side by side" : "Filmography");
  } else if (timelines.length > 1 && source === "career") {
    caption = plainCaption("Careers side by side");
  } else {
    caption = filmsCaption(films);
  }

  const posters = pickTimelineFilms(films);
  const scoped = laneFilms(scope, all, careerFilms(timelines, today));
  const onLane = scoped.filter((film) => inPeriod(film.year, period));
  const dots = axisDots([...onLane, ...films], posters);
  const lane = laneScale(dots.filter((dot) => dot.featured).map((dot) => yearFraction(dot.releaseDate)));
  return {
    kind: timelines.length === 1 ? "solo" : "pair",
    people: ogPeople,
    overlayFontSize: overlay.fontSize,
    posters,
    dots: placeDots(dots, lane),
    lane,
    years: yearRange(films),
    caption,
    period: label,
    chip: films.length === 0 ? null : (label ?? activeYearsLabel(yearRange(films))),
  };
}
