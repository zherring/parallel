import { isReleased, todayIso } from "@/lib/released";
import type { Credit, Film, PersonTimeline, SharedFilm } from "@/lib/types";

export interface SharedOptions {
  includeMinor: boolean;
  /**
   * `yyyy-mm-dd` (UTC) that decides which films are out: only released films (see `isReleased`)
   * count as shared. Defaults to today; the page passes the one date it computed so the server
   * and the browser agree, and tests inject it.
   */
  today?: string;
}

export interface PairShared {
  a: number;
  b: number;
  films: SharedFilm[];
}

function countedFilms(timeline: PersonTimeline, includeMinor: boolean, today: string) {
  const counted = new Map<number, { film: Film; credits: Credit[] }>();
  for (const film of timeline.films) {
    // An announced film is on the lane as an upcoming poster, but it is not a film made together yet.
    if (!isReleased(film.releaseDate, today)) continue;
    const credits = includeMinor ? film.credits : film.credits.filter((c) => !c.minor);
    if (credits.length > 0) counted.set(film.id, { film, credits });
  }
  return counted;
}

/** The films every person has, among the released ones, oldest first. */
export function sharedFilms(timelines: PersonTimeline[], opts: SharedOptions): SharedFilm[] {
  if (timelines.length < 2) return [];

  const today = opts.today ?? todayIso();
  const perPerson = timelines.map((t) => countedFilms(t, opts.includeMinor, today));
  const [first, ...rest] = perPerson;
  const shared: SharedFilm[] = [];

  for (const [id, { film }] of first) {
    if (!rest.every((films) => films.has(id))) continue;
    shared.push({
      id,
      title: film.title,
      year: film.year,
      releaseDate: film.releaseDate,
      posterPath: film.posterPath,
      byPerson: Object.fromEntries(
        timelines.map((t, i) => [t.person.id, perPerson[i].get(id)!.credits]),
      ),
    });
  }

  return shared.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.id - b.id);
}

/** Every pair's shared films, for 3 or more people (with 2, sharedFilms already is the pair). */
export function sharedFilmsPairwise(timelines: PersonTimeline[], opts: SharedOptions): PairShared[] {
  if (timelines.length < 3) return [];

  // One date for every pair, so a pair can never disagree with the rest of the page.
  const resolved = { ...opts, today: opts.today ?? todayIso() };
  const pairs: PairShared[] = [];
  for (let i = 0; i < timelines.length; i++) {
    for (let j = i + 1; j < timelines.length; j++) {
      pairs.push({
        a: timelines[i].person.id,
        b: timelines[j].person.id,
        films: sharedFilms([timelines[i], timelines[j]], resolved),
      });
    }
  }
  return pairs;
}
