import { ROLE_ORDER, isMinorCast, isMinorCrewRole, roleForJob } from "@/lib/roles";
import type {
  Credit,
  Film,
  FilmDetails,
  FilmPerson,
  PersonSummary,
  RoleKey,
} from "@/lib/types";
import type { RawMovieCredits, RawMovieDetails, RawPerson } from "@/lib/tmdb-types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_CAST = 30;
const MAX_CREW = 40;
// Jobs outside the key roles that are still worth showing on a film panel.
const NOTABLE_OTHER_JOBS = new Set([
  "executive producer",
  "casting",
  "sound designer",
  "visual effects supervisor",
]);

const roleRank = (role: RoleKey) => ROLE_ORDER.indexOf(role);

export function normalizePerson(raw: RawPerson): PersonSummary {
  return {
    id: raw.id,
    name: raw.name,
    profilePath: raw.profile_path,
    knownFor: raw.known_for_department || null,
    birthday: raw.birthday || null,
    deathday: raw.deathday || null,
  };
}

export function normalizeMovieCredits(raw: RawMovieCredits): Film[] {
  const films = new Map<number, Film>();

  const add = (
    entry: { id: number; title: string; release_date?: string; poster_path: string | null },
    credit: Credit,
  ) => {
    const releaseDate = entry.release_date;
    if (!releaseDate || !ISO_DATE.test(releaseDate)) return;

    let film = films.get(entry.id);
    if (!film) {
      film = {
        id: entry.id,
        title: entry.title,
        releaseDate,
        year: Number(releaseDate.slice(0, 4)),
        posterPath: entry.poster_path,
        credits: [],
        minor: true,
      };
      films.set(entry.id, film);
    }
    // TMDB sometimes lists the same job twice under different credit ids.
    const duplicate = film.credits.some(
      (c) => c.job === credit.job && c.character === credit.character,
    );
    if (!duplicate) film.credits.push(credit);
  };

  for (const c of raw.cast) {
    add(c, {
      role: "actor",
      job: "Actor",
      ...(c.character ? { character: c.character } : {}),
      ...(c.order !== undefined ? { order: c.order } : {}),
      minor: isMinorCast(c.order, c.character),
    });
  }
  for (const c of raw.crew) {
    const role = roleForJob(c.job);
    add(c, { role, job: c.job, minor: isMinorCrewRole(role) });
  }

  return [...films.values()]
    .map((film) => ({
      ...film,
      credits: [...film.credits].sort((a, b) => roleRank(a.role) - roleRank(b.role)),
      minor: film.credits.every((c) => c.minor),
    }))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.id - b.id);
}

export function normalizeFilmDetails(raw: RawMovieDetails): FilmDetails {
  const releaseDate = raw.release_date && ISO_DATE.test(raw.release_date) ? raw.release_date : null;

  const cast: FilmPerson[] = (raw.credits?.cast ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      profilePath: c.profile_path,
      job: "Actor",
      role: "actor" as const,
      ...(c.character ? { character: c.character } : {}),
      ...(c.order !== undefined ? { order: c.order } : {}),
    }))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
    .slice(0, MAX_CAST);

  const seen = new Set<string>();
  const crew: FilmPerson[] = [];
  for (const c of raw.credits?.crew ?? []) {
    const role = roleForJob(c.job);
    if (role === "other" && !NOTABLE_OTHER_JOBS.has(c.job.trim().toLowerCase())) continue;
    const key = `${c.id}|${c.job}`;
    if (seen.has(key)) continue;
    seen.add(key);
    crew.push({ id: c.id, name: c.name, profilePath: c.profile_path, job: c.job, role });
  }
  // Array.prototype.sort is stable, so TMDB's own order holds within a role.
  crew.sort((a, b) => roleRank(a.role) - roleRank(b.role));

  return {
    id: raw.id,
    title: raw.title,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    releaseDate,
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    runtime: raw.runtime || null,
    tagline: raw.tagline || null,
    overview: raw.overview || null,
    genres: (raw.genres ?? []).map((g) => g.name),
    cast,
    crew: crew.slice(0, MAX_CREW),
  };
}
