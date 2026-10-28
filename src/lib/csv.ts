import { slugify } from "@/lib/slug";
import type { TableFilm } from "@/lib/film-rows";

/** What the Letterboxd CSV needs of a film: nothing about who worked on it. */
export type CsvFilm = Pick<TableFilm, "id" | "title" | "year">;

function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Letterboxd's importer reads tmdbID, Title and Year. */
export function filmsToCsv(films: readonly CsvFilm[]): string {
  const rows = [
    ["tmdbID", "Title", "Year"],
    ...films.map((f) => [String(f.id), f.title, String(f.year)]),
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
