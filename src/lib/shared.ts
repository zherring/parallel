import type { Credit, Film, PersonTimeline, SharedFilm } from "@/lib/types";

export interface SharedOptions {
  includeMinor: boolean;
}

export interface PairShared {
  a: number;
  b: number;
  films: SharedFilm[];
}

function countedFilms(timeline: PersonTimeline, includeMinor: boolean) {
  const counted = new Map<number, { film: Film; credits: Credit[] }>();
  for (const film of timeline.films) {
    const credits = includeMinor ? film.credits : film.credits.filter((c) => !c.minor);
    if (credits.length > 0) counted.set(film.id, { film, credits });
  }
  return counted;
}

export function sharedFilms(timelines: PersonTimeline[], opts: SharedOptions): SharedFilm[] {
  if (timelines.length < 2) return [];

  const perPerson = timelines.map((t) => countedFilms(t, opts.includeMinor));
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

  const pairs: PairShared[] = [];
  for (let i = 0; i < timelines.length; i++) {
    for (let j = i + 1; j < timelines.length; j++) {
      pairs.push({
        a: timelines[i].person.id,
        b: timelines[j].person.id,
        films: sharedFilms([timelines[i], timelines[j]], opts),
      });
    }
  }
  return pairs;
}
