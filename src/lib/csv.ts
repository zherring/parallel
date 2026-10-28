import { ratingDisplay, revenueDisplay, festivalPrizeLabels, wholeNumber } from "@/lib/film-metrics";
import type { CreditLine, TableFilm } from "@/lib/film-rows";
import { slugify } from "@/lib/slug";
import type { FilmMetrics } from "@/lib/types";

/**
 * A film in the export: the table's own columns. Only the id, title and year are required; the
 * release date and the credits are written when the row has them.
 */
export type CsvFilm = Pick<TableFilm, "id" | "title" | "year"> & {
  releaseDate?: string;
  credits?: readonly CreditLine[];
};

export interface CsvOptions {
  /** Rating, box office and awards of the films, as loaded for the table; a film without them gets empty cells. */
  metrics?: ReadonlyMap<number, FilmMetrics | null>;
  /** "yyyy-mm-dd", the page's date: it decides whether a film is out, as in the table. */
  today?: string;
}

export const CSV_HEADER = [
  "Title",
  "Year",
  "Release date",
  "Credits",
  "Rating (TMDB 0-10)",
  "Votes (TMDB)",
  "Box office (USD worldwide)",
  "Budget (USD)",
  "Gross multiple",
  "Oscar wins",
  "Oscar nominations",
  "Festival prizes",
  "TMDB ID",
  "TMDB URL",
] as const;

function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const text = (value: number): string => String(Math.round(value));

/** "Harrison Ford: Actor; George Lucas: Director, Writer", or just "Director, Writer" for one person's own list. */
function creditsCell(credits: readonly CreditLine[] | undefined): string {
  return (credits ?? [])
    .filter((line) => line.roles)
    .map((line) => (line.name ? `${line.name}: ${line.roles}` : line.roles))
    .join("; ");
}

/**
 * The metric cells of a film, with the same rules as the table (a rating needs at least 10 votes,
 * a box office is hidden for tiny and unreleased releases, the multiple needs a believable
 * budget) but as plain numbers a spreadsheet can sort: rating, votes, box office, budget,
 * gross multiple, Oscar wins, Oscar nominations (wins included) and festival prizes.
 */
function metricCells(metrics: FilmMetrics | null | undefined, today: string): string[] {
  if (!metrics) return Array(8).fill("");

  const rating = ratingDisplay(metrics.voteAverage, metrics.voteCount);
  const revenue = revenueDisplay(metrics, today);
  const awards = metrics.awards;
  const wins = awards ? wholeNumber(awards.oscarWins) : 0;
  const nominations = awards ? Math.max(wins, wholeNumber(awards.oscarNominations)) : 0;
  const multiple =
    revenue?.multiple && metrics.revenue && metrics.budget
      ? (Math.round((metrics.revenue / metrics.budget) * 10) / 10).toFixed(1)
      : "";

  return [
    rating ? rating.score : "",
    rating ? text(metrics.voteCount) : "",
    revenue && metrics.revenue ? text(metrics.revenue) : "",
    revenue && metrics.budget ? text(metrics.budget) : "",
    multiple,
    wins > 0 ? String(wins) : "",
    nominations > 0 ? String(nominations) : "",
    awards ? festivalPrizeLabels(awards).join("; ") : "",
  ];
}

/** The films as CSV, in the order given (the order of the table), one CRLF-terminated row per film. */
export function filmsToCsv(films: readonly CsvFilm[], { metrics, today = "" }: CsvOptions = {}): string {
  const rows = [
    [...CSV_HEADER],
    ...films.map((film) => [
      film.title,
      String(film.year),
      film.releaseDate ?? "",
      creditsCell(film.credits),
      ...metricCells(metrics?.get(film.id), today),
      String(film.id),
      `https://www.themoviedb.org/movie/${film.id}`,
    ]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

/**
 * The download's name: `<name>-films.csv` for one person's filmography, `<a>-<b>-shared-films.csv`
 * for the films several people made together.
 */
export function csvFilename(names: string[]): string {
  const stem = names.map(slugify).filter(Boolean).join("-");
  const solo = names.length === 1;
  if (!stem) return solo ? "films.csv" : "shared-films.csv";
  return solo ? `${stem}-films.csv` : `${stem}-shared-films.csv`;
}
