/**
 * Sorting rules for the "films together" table: which columns sort, which way a first click goes,
 * what each column sorts by and where films without data end up. Pure and locale-independent
 * where order matters (dates compare as text, titles with a fixed "en" collator), so the table
 * sorts the same in every browser and the rules are testable.
 *
 * What a column sorts by is what its cell shows: a rating under the vote floor, a token or
 * unreleased gross and an empty awards row are all "no data", which sorts last in either
 * direction (a missing number is never "the lowest").
 */

import {
  awardsDisplay,
  festivalPrizeLabels,
  ratingDisplay,
  revenueDisplay,
  wholeNumber,
} from "@/lib/film-metrics";
import type { FilmMetrics, SharedFilm } from "@/lib/types";

export type SortKey = "film" | "year" | "rating" | "box-office" | "awards";
export type SortDir = "asc" | "desc";

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export const SORT_KEYS: readonly SortKey[] = ["film", "year", "rating", "box-office", "awards"];
/** The columns that need data from the metrics request. */
export const METRIC_SORT_KEYS: readonly SortKey[] = ["rating", "box-office", "awards"];

/** Chronological, as the list has always been. */
export const DEFAULT_SORT: SortState = { key: "year", dir: "asc" };

/** Column header text. */
export const SORT_LABELS: Record<SortKey, string> = {
  film: "Film",
  year: "Year",
  rating: "Rating",
  "box-office": "Box office",
  awards: "Awards",
};

/** What a sort is "by", for sentences: "Sorted by box office, highest first". */
const SORT_NOUNS: Record<SortKey, string> = {
  film: "film title",
  year: "year",
  rating: "rating",
  "box-office": "box office",
  awards: "awards",
};

const DIRECTION_WORDS: Record<SortKey, Record<SortDir, string>> = {
  film: { asc: "A to Z", desc: "Z to A" },
  year: { asc: "oldest first", desc: "newest first" },
  rating: { asc: "lowest first", desc: "highest first" },
  "box-office": { asc: "lowest first", desc: "highest first" },
  awards: { asc: "fewest first", desc: "most first" },
};

export const isMetricSortKey = (key: SortKey): boolean => METRIC_SORT_KEYS.includes(key);

/**
 * Where a first click on a column goes: titles and years start at the beginning (A to Z, oldest
 * first); the metrics start with the best, which is what "most successful" asks for.
 */
export function defaultDirection(key: SortKey): SortDir {
  return isMetricSortKey(key) ? "desc" : "asc";
}

export const flipDirection = (dir: SortDir): SortDir => (dir === "asc" ? "desc" : "asc");

/** The sort after a click on `key`'s header: the same column flips, another column starts at its default. */
export function nextSort(current: SortState, key: SortKey): SortState {
  return current.key === key
    ? { key, dir: flipDirection(current.dir) }
    : { key, dir: defaultDirection(key) };
}

/** The value of `aria-sort` for `key`'s header. */
export function ariaSort(current: SortState, key: SortKey): "ascending" | "descending" | "none" {
  if (current.key !== key) return "none";
  return current.dir === "asc" ? "ascending" : "descending";
}

/** "highest first", "A to Z": the direction in words that fit the column. */
export function directionWords(sort: SortState): string {
  return DIRECTION_WORDS[sort.key][sort.dir];
}

/** The live-region message for a sort: "Sorted by box office, highest first". */
export function sortAnnouncement(sort: SortState): string {
  return `Sorted by ${SORT_NOUNS[sort.key]}, ${directionWords(sort)}`;
}

/* ------------------------------------------------------------------ the URL */

export const SORT_PARAM = "sort";
export const DIR_PARAM = "dir";

/**
 * The sort named by `?sort=box-office&dir=desc`, or null when `sort` is missing or unknown. A
 * missing or unknown `dir` means the column's default direction.
 */
export function parseSort(sort: string | null | undefined, dir: string | null | undefined): SortState | null {
  const key = SORT_KEYS.find((candidate) => candidate === sort);
  if (!key) return null;
  return { key, dir: dir === "asc" || dir === "desc" ? dir : defaultDirection(key) };
}

/** The query values for a sort, or null for the default order (which needs no parameters). */
export function sortParams(sort: SortState): { sort: SortKey; dir: SortDir } | null {
  return sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir ? null : { sort: sort.key, dir: sort.dir };
}

/* ------------------------------------------------------------------ what each column sorts by */

/** Oscar wins, then Oscar nominations (never fewer than the wins), then festival prizes. */
export type AwardsKey = readonly [oscarWins: number, oscarNominations: number, festivalPrizes: number];

export interface MetricKeys {
  /** TMDB's score to one decimal, as shown; null under the vote floor. */
  rating: number | null;
  /** Worldwide gross in dollars; null when the cell shows no box office. */
  boxOffice: number | null;
  /** null when the cell shows no awards. */
  awards: AwardsKey | null;
}

const NO_KEYS: MetricKeys = { rating: null, boxOffice: null, awards: null };

/**
 * The sort keys of a film's metrics, derived by the same display rules as the cells so that a
 * cell showing a dash is exactly a film that sorts as having nothing. `today` decides whether
 * a film is out yet (see `revenueDisplay`).
 */
export function metricKeys(metrics: FilmMetrics | null | undefined, today: Date | string): MetricKeys {
  if (!metrics) return NO_KEYS;

  const rating = ratingDisplay(metrics.voteAverage, metrics.voteCount);
  const hasBoxOffice = revenueDisplay(metrics, today) !== null && metrics.revenue !== null;
  const awards = metrics.awards && awardsDisplay(metrics.awards) ? metrics.awards : null;

  const wins = awards ? wholeNumber(awards.oscarWins) : 0;
  return {
    rating: rating ? Number(rating.score) : null,
    boxOffice: hasBoxOffice ? metrics.revenue : null,
    awards: awards
      ? [wins, Math.max(wins, wholeNumber(awards.oscarNominations)), festivalPrizeLabels(awards).length]
      : null,
  };
}

/* ------------------------------------------------------------------ sorting */

/** What is known about each film's metrics: a film missing from the map, or null, has none. */
export type MetricsById = ReadonlyMap<number, FilmMetrics | null>;

const titles = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Release date, then id: the order of the unsorted list, and the tie-breaker of every other sort. */
function chronological(a: SharedFilm, b: SharedFilm): number {
  if (a.releaseDate !== b.releaseDate) return a.releaseDate < b.releaseDate ? -1 : 1;
  return a.id - b.id;
}

const directed = (dir: SortDir, result: number): number => (dir === "asc" ? result : -result);

/** Compares two optional keys: no data is last whichever way the sort goes. */
function compareOptional<T>(a: T | null, b: T | null, compare: (a: T, b: T) => number, dir: SortDir): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return directed(dir, compare(a, b));
}

const compareNumbers = (a: number, b: number): number => a - b;

function compareAwards(a: AwardsKey, b: AwardsKey): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * The films in the order of `sort`, as a new array. Ties (and the films with no data) fall back
 * to chronological order, always oldest first, so equal films keep a predictable order whichever
 * way the column goes.
 */
export function sortFilms(
  films: readonly SharedFilm[],
  sort: SortState,
  metrics: MetricsById,
  today: Date | string,
): SharedFilm[] {
  const { key, dir } = sort;

  if (key === "year") return [...films].sort((a, b) => directed(dir, chronological(a, b)));
  if (key === "film") {
    return [...films].sort((a, b) => directed(dir, titles.compare(a.title, b.title)) || chronological(a, b));
  }

  const keys = new Map(films.map((film) => [film.id, metricKeys(metrics.get(film.id), today)] as const));
  const of = (film: SharedFilm): MetricKeys => keys.get(film.id) ?? NO_KEYS;

  const compare =
    key === "rating"
      ? (a: SharedFilm, b: SharedFilm) => compareOptional(of(a).rating, of(b).rating, compareNumbers, dir)
      : key === "box-office"
        ? (a: SharedFilm, b: SharedFilm) => compareOptional(of(a).boxOffice, of(b).boxOffice, compareNumbers, dir)
        : (a: SharedFilm, b: SharedFilm) => compareOptional(of(a).awards, of(b).awards, compareAwards, dir);

  return [...films].sort((a, b) => compare(a, b) || chronological(a, b));
}
