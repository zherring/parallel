/**
 * The label of a film made together in the Depth view reads `Title, Year`. A title that already ends with its release year
 * ("Street Scenes 1970", released in 1970) would read "Street Scenes 1970, 1970": the year is taken off the title, and the label
 * is "Street Scenes, 1970", the same shape as every other. Pure.
 */

export interface FilmLabel {
  /** The title as the label shows it: without its own trailing release year. */
  title: string;
  /** The year to write after it, or null when the title is nothing but the year ("1984") and so already says it. */
  year: number | null;
}

/** The ways a title may set its year apart: a space, a comma, a colon, a dash, or brackets. */
const SEPARATORS = String.raw`[\s,:;–—-]*`;

/**
 * The label's title and year for a film: `title` and `year` as they are, except that a title ending with `year` (alone, after
 * a separator, or in brackets: "Street Scenes 1970", "Street Scenes (1970)", "Street Scenes - 1970") loses it, and a title that is
 * only the year ("1984") is kept and has no year after it. The year must be the whole last number: "Event 21970" and "Hits of the
 * 1970s" end with no 1970.
 */
export function filmLabel(title: string, year: number): FilmLabel {
  const full = title.trim();
  const written = String(year);
  const match = new RegExp(`^(.*?)${SEPARATORS}[(\\[]?(?<![\\d])${written}[)\\]]?$`).exec(full);
  if (!match) return { title: full, year };
  const rest = match[1].trim();
  return rest ? { title: rest, year } : { title: full, year: null };
}
