import "server-only";
import { normalizeFilmDetails, normalizeMovieCredits, normalizePerson } from "@/lib/normalize";
import type {
  RawMovieCredits,
  RawMovieDetails,
  RawPerson,
  RawSearchPeople,
} from "@/lib/tmdb-types";
import type { FilmDetails, PersonSearchResult, PersonSummary, PersonTimeline } from "@/lib/types";

const BASE_URL = "https://api.themoviedb.org/3";
const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const MAX_SEARCH_RESULTS = 8;
const MAX_KNOWN_FOR_TITLES = 3;
const RETRY_DELAY_MS = 300;
const MAX_RETRY_DELAY_MS = 2000;

export class TmdbError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function tmdbGet<T>(
  path: string,
  revalidate: number,
  params: Record<string, string> = {},
): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is not set");

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      next: { revalidate },
    });

    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      const retryAfterMs = Number(res.headers.get("retry-after")) * 1000;
      await sleep(Math.min(retryAfterMs || RETRY_DELAY_MS, MAX_RETRY_DELAY_MS));
      continue;
    }
    if (!res.ok) throw new TmdbError(res.status, `TMDB request to ${path} failed with ${res.status}`);
    return (await res.json()) as T;
  }
}

export async function searchPeople(query: string): Promise<PersonSearchResult[]> {
  const { results } = await tmdbGet<RawSearchPeople>("/search/person", HOUR, {
    query,
    include_adult: "false",
  });
  return results.slice(0, MAX_SEARCH_RESULTS).map((p) => ({
    id: p.id,
    name: p.name,
    profilePath: p.profile_path,
    knownFor: p.known_for_department || null,
    knownForTitles: (p.known_for ?? [])
      .map((k) => k.title ?? k.name)
      .filter((title): title is string => Boolean(title))
      .slice(0, MAX_KNOWN_FOR_TITLES),
  }));
}

export async function getPerson(id: number): Promise<PersonSummary> {
  return normalizePerson(await tmdbGet<RawPerson>(`/person/${id}`, DAY));
}

export async function getPersonMovieCredits(id: number): Promise<PersonTimeline> {
  const [person, credits] = await Promise.all([
    getPerson(id),
    tmdbGet<RawMovieCredits>(`/person/${id}/movie_credits`, DAY),
  ]);
  return { person, films: normalizeMovieCredits(credits) };
}

export async function getFilmDetails(id: number): Promise<FilmDetails> {
  const movie = await tmdbGet<RawMovieDetails>(`/movie/${id}`, DAY, {
    append_to_response: "credits",
  });
  return normalizeFilmDetails(movie);
}
