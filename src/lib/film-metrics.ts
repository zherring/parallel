/**
 * Display rules for the numbers on a film's hover card: what to show, what to hide and how to
 * word it. Pure and locale-independent (numbers are formatted by hand, never with the runtime's
 * locale), so the card reads the same everywhere and the rules are testable.
 *
 * The rules lean on what the metrics spike measured: TMDB's audience score is unreliable under a
 * few dozen votes, and its revenue figure is theatrical only, so streaming films show a token
 * gross and revenue divided by budget is a rough "gross multiple" at best, never a profit.
 */

import type { AwardsSummary } from "@/lib/awards";
import type { FilmMetrics, MovieMetrics } from "@/lib/types";

/** Below this many votes the score is noise (a 9.5 from two votes): the rating row is hidden. */
export const MIN_VOTES = 10;
/** From MIN_VOTES up to this many votes the rating is shown but flagged "few ratings". */
export const FEW_VOTES_BELOW = 100;
export const STAR_COUNT = 5;
export const RATING_SOURCE = "TMDB";

/** A smaller gross is a token release (a streaming film's few screens, a festival run), not a box office. */
export const MIN_REVENUE = 1_000_000;
/** A smaller budget is a placeholder or an error; dividing by it gives a meaningless multiple. */
export const MIN_BUDGET_FOR_MULTIPLE = 100_000;
/** Revenue under this share of the budget is too likely to be a partial figure to divide. */
export const MIN_REVENUE_SHARE_OF_BUDGET = 0.05;
/** Before this year TMDB's budget and gross are first-run guesses in different dollars: no multiple. */
export const MULTIPLE_FROM_YEAR = 1970;

const SEPARATOR = " · ";
const MAX_FESTIVAL_PRIZES = 2;

/* ------------------------------------------------------------------ number formatting */

type Unit = readonly [suffix: string, size: number];

/** One decimal below 10 ("1.2"), none from 10 up ("25"); no trailing ".0". */
function roundCompact(value: number): number {
  return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
}

const plain = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function compact(value: number, units: readonly Unit[]): string {
  const n = Math.max(0, Math.round(value));
  if (n < 1000) return String(n);

  let index = units.length - 1;
  while (index > 0 && n < units[index][1]) index--;
  let rounded = roundCompact(n / units[index][1]);
  // 999,600 rounds to "1000k": say "1M" instead.
  if (rounded >= 1000 && index < units.length - 1) {
    index++;
    rounded = roundCompact(n / units[index][1]);
  }
  return `${plain(rounded)}${units[index][0]}`;
}

const COUNT_UNITS: readonly Unit[] = [
  ["k", 1e3],
  ["M", 1e6],
  ["B", 1e9],
];
const MONEY_UNITS: readonly Unit[] = [
  ["K", 1e3],
  ["M", 1e6],
  ["B", 1e9],
];

/** A vote count in a few characters: "842", "1.2k", "25k", "1.2M". */
export function compactCount(count: number): string {
  return compact(count, COUNT_UNITS);
}

/** US dollars in a few characters: "$850K", "$11.4M", "$101M", "$1.2B". */
export function formatMoney(dollars: number): string {
  return `$${compact(dollars, MONEY_UNITS)}`;
}

/** Revenue over budget with a multiplication sign: "1.6×", "22.7×", "286×", "1,234×". */
export function formatMultiple(multiple: number): string {
  const tenths = Math.round(multiple * 10) / 10;
  if (tenths < 100) return `${tenths.toFixed(1)}×`;
  return `${Math.round(multiple).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}×`;
}

/** "yyyy-mm-dd" of a date in UTC, the format of TMDB's release dates. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const ISO_DATE = /^(\d{4})-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ rating */

export interface RatingDisplay {
  /** TMDB's 0-10 score as 0-5 stars in half-star steps; the three always add up to 5. */
  stars: { full: number; half: number; empty: number };
  /** One decimal: "7.8". */
  score: string;
  /** Compact vote count: "25k". */
  votes: string;
  /** What the row says about the votes: "25k votes", or just "few ratings" for 10 to 99 of them. */
  votesLabel: string;
  /** 10 to 99 votes: the score is shown but the card should say the sample is small. */
  fewRatings: boolean;
  source: typeof RATING_SOURCE;
  /** The row as plain text: "7.8 · 25k votes · TMDB", or "9.1 · few ratings · TMDB". */
  text: string;
}

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * The rating row, or null to hide it: no score, or fewer than MIN_VOTES votes behind it. The
 * 0-10 score halves into 0-5 stars rounded to the nearest half star (7.8 -> 3.9 -> 4 stars,
 * 7.2 -> 3.6 -> 3.5 stars).
 */
export function ratingDisplay(
  voteAverage: number | null | undefined,
  voteCount: number | null | undefined,
): RatingDisplay | null {
  if (!finite(voteAverage) || voteAverage <= 0 || !finite(voteCount) || voteCount < MIN_VOTES) return null;

  const score = Math.min(10, voteAverage);
  const halves = Math.round(score); // the 0-10 score is already the count of half stars
  const full = Math.floor(halves / 2);
  const half = halves % 2;
  const scoreText = (Math.round(score * 10) / 10).toFixed(1);
  const votes = compactCount(voteCount);
  const fewRatings = voteCount < FEW_VOTES_BELOW;
  const votesLabel = fewRatings ? "few ratings" : `${votes} votes`;

  return {
    stars: { full, half, empty: STAR_COUNT - full - half },
    score: scoreText,
    votes,
    votesLabel,
    fewRatings,
    source: RATING_SOURCE,
    text: [scoreText, votesLabel, RATING_SOURCE].join(SEPARATOR),
  };
}

/* ------------------------------------------------------------------ revenue */

export interface RevenueDisplay {
  /** "$101M". */
  amount: string;
  /** Always "worldwide": TMDB's figure is a worldwide theatrical gross. */
  label: "worldwide";
  /** "1.6×", only when budget and revenue are trustworthy enough to divide; never a profit. */
  multiple: string | null;
  /** The row as plain text: "$101M worldwide · 1.6× budget". */
  text: string;
}

/**
 * The box office row, or null to hide it: no revenue, an unreleased film, or a gross under
 * MIN_REVENUE (a streaming film's token run, e.g. Mank or The Irishman, would read as a flop).
 * Adds the gross multiple (revenue / budget) only with a believable budget (at least
 * MIN_BUDGET_FOR_MULTIPLE), a revenue of at least MIN_REVENUE_SHARE_OF_BUDGET of it, and a
 * film from MULTIPLE_FROM_YEAR on. A genuine flop (38% of its budget) still shows 0.4×.
 * `today` decides whether the film is out: a Date (compared in UTC) or "yyyy-mm-dd".
 */
export function revenueDisplay(
  { revenue, budget, releaseDate }: Pick<MovieMetrics, "revenue" | "budget" | "releaseDate">,
  today: Date | string,
): RevenueDisplay | null {
  if (!finite(revenue) || revenue < MIN_REVENUE) return null;

  const dateMatch = releaseDate ? ISO_DATE.exec(releaseDate) : null;
  const todayText = typeof today === "string" ? today : Number.isNaN(today.getTime()) ? null : isoDate(today);
  if (dateMatch && todayText !== null && releaseDate! > todayText) return null;

  const modern = dateMatch !== null && Number(dateMatch[1]) >= MULTIPLE_FROM_YEAR;
  const showMultiple =
    modern &&
    finite(budget) &&
    budget >= MIN_BUDGET_FOR_MULTIPLE &&
    revenue >= budget * MIN_REVENUE_SHARE_OF_BUDGET;
  const multiple = showMultiple ? formatMultiple(revenue / budget) : null;

  const amount = formatMoney(revenue);
  const text = `${amount} worldwide${multiple ? `${SEPARATOR}${multiple} budget` : ""}`;
  return { amount, label: "worldwide", multiple, text };
}

/* ------------------------------------------------------------------ awards */

export interface AwardsDisplay {
  /** The row in pieces that can wrap between them: ["4 Oscars", "6 nominations", "Palme d'Or, Cannes"]. */
  parts: string[];
  /** The row as plain text: "4 Oscars · 6 nominations · Palme d'Or, Cannes". */
  text: string;
}

const count = (n: number, singular: string, plural: string): string => `${n} ${n === 1 ? singular : plural}`;
const wholeNumber = (value: number | null | undefined): number =>
  finite(value) && value > 0 ? Math.floor(value) : 0;

/**
 * The awards row, or null to hide it: nothing won, nothing nominated, no festival prize.
 * Oscars come first ("4 Oscars · 6 nominations", "1 Oscar · 3 nominations", "Nominated for 2
 * Oscars"; the nomination count includes the wins, so it is left out when every nomination
 * won), then up to two festival prizes ("Palme d'Or, Cannes") and "+N more" for the rest.
 */
export function awardsDisplay(awards: AwardsSummary | null | undefined): AwardsDisplay | null {
  if (!awards) return null;

  const wins = wholeNumber(awards.oscarWins);
  const nominations = Math.max(wins, wholeNumber(awards.oscarNominations));
  const parts: string[] = [];

  if (wins > 0) {
    parts.push(count(wins, "Oscar", "Oscars"));
    if (nominations > wins) parts.push(count(nominations, "nomination", "nominations"));
  } else if (nominations > 0) {
    parts.push(`Nominated for ${count(nominations, "Oscar", "Oscars")}`);
  }

  const prizes = [
    ...new Set(
      (awards.festivalPrizes ?? [])
        .map(({ prize, festival }) => [prize?.trim(), festival?.trim()].filter(Boolean).join(", "))
        .filter(Boolean),
    ),
  ];
  parts.push(...prizes.slice(0, MAX_FESTIVAL_PRIZES));
  if (prizes.length > MAX_FESTIVAL_PRIZES) parts.push(`+${prizes.length - MAX_FESTIVAL_PRIZES} more`);

  return parts.length > 0 ? { parts, text: parts.join(SEPARATOR) } : null;
}

/* ------------------------------------------------------------------ the card */

export interface FilmMetricsDisplay {
  revenue: RevenueDisplay | null;
  rating: RatingDisplay | null;
  awards: AwardsDisplay | null;
}

/** All three rows of the card, in the card's order; each is null when it has nothing to show. */
export function filmMetricsDisplay(metrics: FilmMetrics, today: Date | string): FilmMetricsDisplay {
  return {
    revenue: revenueDisplay(metrics, today),
    rating: ratingDisplay(metrics.voteAverage, metrics.voteCount),
    awards: awardsDisplay(metrics.awards),
  };
}
