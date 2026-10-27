import { slugify } from "@/lib/slug";
import type { SharedFilm } from "@/lib/types";

function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Letterboxd's importer reads tmdbID, Title and Year. */
export function sharedFilmsToCsv(films: SharedFilm[]): string {
  const rows = [
    ["tmdbID", "Title", "Year"],
    ...films.map((f) => [String(f.id), f.title, String(f.year)]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvFilename(names: string[]): string {
  const stem = names.map(slugify).filter(Boolean).join("-");
  return stem ? `${stem}-shared-films.csv` : "shared-films.csv";
}
