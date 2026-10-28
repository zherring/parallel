/**
 * The rows of the films table, whatever list it shows: the films two or more people made
 * together, or one person's filmography. The table, its sort and the CSV export only need this
 * small common shape, so one table serves both.
 */

import type { PersonRef } from "@/lib/lanes";
import { roleSummary } from "@/lib/roles";
import type { Credit, PersonTimeline, SharedFilm } from "@/lib/types";

/** What every film in a table has. */
export interface TableFilm {
  id: number;
  title: string;
  year: number;
  /** ISO yyyy-mm-dd */
  releaseDate: string;
  posterPath: string | null;
}

/** What one person did on a film, as one line of the Credits column: "Director, Writer". */
export interface CreditLine {
  personId: number;
  /** The person's name when the row has several lines to tell apart; null for a single person's own list. */
  name: string | null;
  roles: string;
}

export interface TableRow extends TableFilm {
  credits: CreditLine[];
}

const rowFilm = ({ id, title, year, releaseDate, posterPath }: TableFilm): TableFilm => ({
  id,
  title,
  year,
  releaseDate,
  posterPath,
});

/** The rows for films the `people` made together: one credit line per person, in lane order. */
export function sharedRows(shared: readonly SharedFilm[], people: readonly PersonRef[]): TableRow[] {
  return shared.map((film) => ({
    ...rowFilm(film),
    credits: people.map((person) => ({
      personId: person.id,
      name: person.name,
      roles: roleSummary(film.byPerson[person.id] ?? []),
    })),
  }));
}

/**
 * The rows for one person's filmography, in the order of their timeline (oldest first). Minor
 * credits (short films, music videos, cameos, uncredited) are left out unless `includeMinor`,
 * exactly as the lane shows them: a film whose every credit is minor is not listed, and the roles
 * of a listed film are those of its non-minor credits. Films that are not out yet are listed too:
 * this is a filmography, not a list of films made together.
 */
export function personRows(timeline: PersonTimeline, includeMinor: boolean): TableRow[] {
  const rows: TableRow[] = [];
  for (const film of timeline.films) {
    if (!includeMinor && film.minor) continue;
    const credits: Credit[] = includeMinor ? film.credits : film.credits.filter((credit) => !credit.minor);
    rows.push({
      ...rowFilm(film),
      credits: [{ personId: timeline.person.id, name: null, roles: roleSummary(credits) }],
    });
  }
  return rows;
}
