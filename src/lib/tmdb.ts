import "server-only";
import { normalizeFilmDetails, normalizeMovieCredits, normalizePerson } from "@/lib/normalize";
import type {
  RawDiscoverMovies,
  RawMovieCredits,
  RawMovieDetails,
  RawPerson,
  RawSearchPeople,
  RawSearchPerson,
} from "@/lib/tmdb-types";
import type { FilmDetails, PersonSearchResult, PersonSummary, PersonTimeline } from "@/lib/types";

const BASE_URL = "https://api.themoviedb.org/3";
const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const MAX_SEARCH_RESULTS = 8;
const MAX_KNOWN_FOR_TITLES = 3;
const RETRY_DELAY_MS = 300;
const MAX_RETRY_DELAY_MS = 2000;
/** Anything shorter than this many minutes is a "short" and counts as a minor credit. */
const SHORT_MAX_MINUTES = 39;
/** 20 results per page: 200 short movies per person is far more than anyone has. */
const MAX_DISCOVER_PAGES = 10;

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
  signal?: AbortSignal,
): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is not set");

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        next: { revalidate },
        ...(signal && { signal }),
      });
    } catch (error) {
      if (signal?.aborted) throw new TmdbError(504, `TMDB request to ${path} timed out`);
      throw error;
    }

    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      const retryAfterMs = Number(res.headers.get("retry-after")) * 1000;
      await sleep(Math.min(retryAfterMs || RETRY_DELAY_MS, MAX_RETRY_DELAY_MS));
      continue;
    }
    if (!res.ok) throw new TmdbError(res.status, `TMDB request to ${path} failed with ${res.status}`);
    return (await res.json()) as T;
  }
}

function searchPeopleRaw(query: string, signal?: AbortSignal): Promise<RawSearchPeople> {
  return tmdbGet<RawSearchPeople>("/search/person", HOUR, { query, include_adult: "false" }, signal);
}

function toSearchResult(p: RawSearchPerson): PersonSearchResult {
  return {
    id: p.id,
    name: p.name,
    profilePath: p.profile_path,
    knownFor: p.known_for_department || null,
    knownForTitles: (p.known_for ?? [])
      .map((k) => k.title ?? k.name)
      .filter((title): title is string => Boolean(title))
      .slice(0, MAX_KNOWN_FOR_TITLES),
  };
}

export async function searchPeople(query: string): Promise<PersonSearchResult[]> {
  const { results } = await searchPeopleRaw(query);
  return results.slice(0, MAX_SEARCH_RESULTS).map(toSearchResult);
}

/** A TMDB person search hit with the popularity score TMDB ranks the person by elsewhere. */
export interface PopularPersonResult extends PersonSearchResult {
  popularity: number;
}

/**
 * TMDB's own person search (whole-word matches, in its relevance order), all of the page it
 * returns rather than the first few, each with its popularity. For merging with the local people
 * index; `signal` aborts the request, which then fails with a 504 TmdbError.
 */
export async function searchPeopleWithPopularity(
  query: string,
  signal?: AbortSignal,
): Promise<PopularPersonResult[]> {
  const { results } = await searchPeopleRaw(query, signal);
  return results.map((p) => ({ ...toSearchResult(p), popularity: p.popularity ?? 0 }));
}

export async function getPerson(id: number): Promise<PersonSummary> {
  return normalizePerson(await tmdbGet<RawPerson>(`/person/${id}`, DAY));
}

/**
 * Ids of the movies in a person's credits that run under 40 minutes: shorts, featurettes,
 * making-ofs. `movie_credits` lists them as ordinary credits and has no runtime, so this
 * asks `/discover/movie` for them instead.
 *
 * - `with_people` matches cast or crew, so one query covers every kind of credit.
 * - `with_runtime.gte=1` leaves out movies with an unknown runtime (TMDB stores 0).
 * - `include_video=true` is deliberate: by default discover drops movies TMDB flags as
 *   "video" (music videos, extras), and those are exactly what belongs in this set.
 * - Long video compilations (e.g. a 60+ minute "Video Collection") and movies with no
 *   runtime are not caught here; `normalizeMovieCredits` also honours the `video` flag
 *   that `movie_credits` carries.
 *
 * Never throws: the lookup only refines the page, so any failure (after the retry in
 * `tmdbGet`) yields an empty set, or the pages that did load.
 */
export async function getShortMovieIds(personId: number): Promise<Set<number>> {
  const query = (page: number) =>
    tmdbGet<RawDiscoverMovies>("/discover/movie", DAY, {
      with_people: String(personId),
      "with_runtime.gte": "1",
      "with_runtime.lte": String(SHORT_MAX_MINUTES),
      include_adult: "false",
      include_video: "true",
      sort_by: "primary_release_date.asc",
      page: String(page),
    });

  const ids = new Set<number>();
  const collect = (data: RawDiscoverMovies) => {
    for (const movie of data.results ?? []) ids.add(movie.id);
  };

  try {
    const first = await query(1);
    collect(first);

    const pages = Math.min(first.total_pages ?? 1, MAX_DISCOVER_PAGES);
    const rest = await Promise.allSettled(
      Array.from({ length: Math.max(0, pages - 1) }, (_, i) => query(i + 2)),
    );
    for (const result of rest) if (result.status === "fulfilled") collect(result.value);
  } catch (error) {
    const status = error instanceof TmdbError ? ` (status ${error.status})` : "";
    console.warn(`TMDB short-movie lookup failed for person ${personId}${status}`);
  }
  return ids;
}

export async function getPersonMovieCredits(id: number): Promise<PersonTimeline> {
  const [person, credits, shortMovieIds] = await Promise.all([
    getPerson(id),
    tmdbGet<RawMovieCredits>(`/person/${id}/movie_credits`, DAY),
    getShortMovieIds(id),
  ]);
  return { person, films: normalizeMovieCredits(credits, shortMovieIds) };
}

export async function getFilmDetails(id: number): Promise<FilmDetails> {
  const movie = await tmdbGet<RawMovieDetails>(`/movie/${id}`, DAY, {
    append_to_response: "credits",
  });
  return normalizeFilmDetails(movie);
}
