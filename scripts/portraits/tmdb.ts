/**
 * Spike (zherring/spike-portraits): the TMDB reads shared by `npm run portraits:cut` (cut.ts) and `npm run portraits:testset` (testset.ts).
 */

export interface Credit {
  id: number;
  poster_path: string | null;
  vote_count?: number;
}
export interface Person {
  name: string;
  profile_path: string | null;
  movie_credits: { cast: Credit[]; crew: Credit[] };
}

/** The read token from .env; throws when it is missing, so a script can fail before its loop. */
export function requireTmdbToken(): string {
  const value = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!value) throw new Error("TMDB_READ_ACCESS_TOKEN is not set (put it in .env)");
  return value;
}

export async function tmdb<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${requireTmdbToken()}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`TMDB ${path} answered ${response.status}`);
  return (await response.json()) as T;
}

/** The person with their film credits (for `topPosters`). */
export function fetchPerson(id: number): Promise<Person> {
  return tmdb<Person>(`/person/${id}?append_to_response=movie_credits`);
}

/** Poster paths of the person's most-voted films, crew and cast, each film once: the montage background. */
export function topPosters(person: Person, count: number): string[] {
  const seen = new Set<number>();
  return [...person.movie_credits.crew, ...person.movie_credits.cast]
    .filter((c) => c.poster_path && !seen.has(c.id) && seen.add(c.id))
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .slice(0, count)
    .map((c) => c.poster_path!);
}
