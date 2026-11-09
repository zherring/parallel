import "server-only";
import { normalizeFilmDetails, normalizeMovieCredits, normalizePerson } from "@/lib/normalize";
import { retryDelayMs } from "@/lib/retry";
import { Semaphore } from "@/lib/semaphore";
import type {
  RawDiscoverMovies,
  RawFilmCredits,
  RawMovieCredits,
  RawMovieDetails,
  RawMovieMetrics,
  RawPerson,
  RawSearchPeople,
  RawSearchPerson,
} from "@/lib/tmdb-types";
import { TtlCache } from "@/lib/ttl-cache";
import type { FilmDetails, MovieMetrics, PersonSearchResult, PersonSummary, PersonTimeline } from "@/lib/types";

const BASE_URL = "https://api.themoviedb.org/3";
const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const MAX_SEARCH_RESULTS = 8;
const MAX_KNOWN_FOR_TITLES = 3;
/** TMDB requests on the wire at once, per server instance, whoever asks (pages, routes, scripts). */
const MAX_CONCURRENT_REQUESTS = 6;
/** One try plus two retries, on 429, 5xx, network errors and timeouts. */
const MAX_ATTEMPTS = 3;
/** One attempt (headers and body) is given up on after this long. */
const ATTEMPT_TIMEOUT_MS = 8000;
/** Total time one request may spend waiting between its attempts; past it the failure is thrown. */
const RETRY_BUDGET_MS = 10_000;
/** A 404 is remembered this long: the id does not exist, asking again will not change that. */
const NOT_FOUND_TTL_MS = 10 * 60 * 1000;
/** A request that still failed after its retries is remembered this long, so a bad spell is not hammered. */
const UNAVAILABLE_TTL_MS = 45 * 1000;
const NEGATIVE_CACHE_SIZE = 500;
/** Says who is calling, as TMDB's API terms ask. No contact details in it on purpose. */
const USER_AGENT = "Parallel/1.0 (+https://github.com/zherring/parallel)";
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

interface Failure {
  status: number;
  message: string;
}

interface ClientState {
  limiter: Semaphore;
  /** Requests (by URL) that came back 404. */
  notFound: TtlCache<string, Failure>;
  /** Requests (by URL) that kept failing with 429, 5xx, a network error or a timeout. */
  unavailable: TtlCache<string, Failure>;
  /** Requests being made right now, so identical ones share a single trip to TMDB. */
  inflight: Map<string, Promise<string>>;
}

const STATE_KEY = "__parallelTmdbClient";

/**
 * The limiter and the failure memories live on `globalThis` rather than in module variables:
 * Next bundles server components and route handlers separately, and each bundle would otherwise
 * get its own copy (and its own six slots) of this module.
 */
function client(): ClientState {
  const holder = globalThis as typeof globalThis & { [STATE_KEY]?: ClientState };
  return (holder[STATE_KEY] ??= {
    limiter: new Semaphore(MAX_CONCURRENT_REQUESTS),
    notFound: new TtlCache(NEGATIVE_CACHE_SIZE, NOT_FOUND_TTL_MS),
    unavailable: new TtlCache(NEGATIVE_CACHE_SIZE, UNAVAILABLE_TTL_MS),
    inflight: new Map(),
  });
}

/** Forgets the limiter, remembered failures and shared requests (for tests). */
export function resetTmdbClientState(): void {
  delete (globalThis as typeof globalThis & { [STATE_KEY]?: ClientState })[STATE_KEY];
}

type Attempt =
  | { kind: "ok"; text: string }
  | { kind: "http"; status: number; retryAfter: string | null }
  | { kind: "error"; status: number };

/**
 * One try. It holds one of the limiter's slots from the moment it starts until the body has been
 * read, and gives it back before anything sleeps. A response the Next data cache serves comes
 * back within a millisecond or so, so cache hits pass through the limiter without waiting on TMDB.
 * Throws only when the caller's own `signal` aborted; every other failure is returned.
 */
async function attemptOnce(
  url: URL,
  path: string,
  revalidate: number,
  token: string,
  signal: AbortSignal | undefined,
): Promise<Attempt> {
  let timeout: AbortSignal | undefined;
  try {
    return await client().limiter.run(async (): Promise<Attempt> => {
      timeout = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": USER_AGENT },
        next: { revalidate },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (res.ok) return { kind: "ok", text: await res.text() };
      await res.body?.cancel().catch(() => {});
      return { kind: "http", status: res.status, retryAfter: res.headers.get("retry-after") };
    }, signal);
  } catch (error) {
    if (signal?.aborted) throw new TmdbError(504, `TMDB request to ${path} timed out`);
    const timedOut = timeout?.aborted || (error instanceof Error && error.name === "TimeoutError");
    return { kind: "error", status: timedOut ? 504 : 502 };
  }
}

/**
 * The body of a successful response to `url`, after up to MAX_ATTEMPTS tries. 429, 5xx, network
 * errors and timeouts are retried: after the wait Retry-After asks for (up to 10s), else after
 * ~500ms, then ~1500ms. The waits together stay within RETRY_BUDGET_MS; a retry that would not fit
 * is not made. Other 4xx are final. A 404, and a request that is still failing once it is out of
 * tries, are remembered so the next ask fails at once.
 */
async function requestText(
  url: URL,
  path: string,
  revalidate: number,
  token: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  const { notFound, unavailable } = client();
  const key = url.toString();
  let waited = 0;

  for (let attempt = 1; ; attempt++) {
    const outcome = await attemptOnce(url, path, revalidate, token, signal);
    if (outcome.kind === "ok") return outcome.text;

    const retryable = outcome.kind === "error" || outcome.status === 429 || outcome.status >= 500;
    const failure: Failure = {
      status: outcome.status,
      message:
        outcome.kind === "http"
          ? `TMDB request to ${path} failed with ${outcome.status}`
          : outcome.status === 504
            ? `TMDB request to ${path} timed out`
            : `TMDB request to ${path} failed (network error)`,
    };

    if (!retryable) {
      if (failure.status === 404) notFound.set(key, failure);
      throw new TmdbError(failure.status, failure.message);
    }

    const delay = retryDelayMs(attempt, outcome.kind === "http" ? outcome.retryAfter : null, Date.now());
    if (attempt >= MAX_ATTEMPTS || waited + delay > RETRY_BUDGET_MS) {
      unavailable.set(key, failure);
      throw new TmdbError(failure.status, failure.message);
    }
    waited += delay;
    await sleep(delay);
  }
}

/**
 * GET against TMDB, parsed as JSON. Every TMDB call goes through here, so every call is held to
 * the same rules: at most MAX_CONCURRENT_REQUESTS on the wire, the retries and timeout described
 * on `requestText`, and the Next data cache (`next.revalidate`, which only keeps 200s) in front.
 * A failure that was just seen for the same URL is thrown again without calling TMDB.
 *
 * `signal` is the caller's own deadline (the search route gives up after 1.5s): when it aborts,
 * this fails with a 504 and is neither retried nor remembered. A call without one shares the
 * request of an identical call already under way. (Passing a signal turns off Next's per-render
 * fetch memoization, which is why that sharing is done here instead.)
 */
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

  const { notFound, unavailable, inflight } = client();
  const key = url.toString();
  const known = notFound.get(key) ?? unavailable.get(key);
  if (known) throw new TmdbError(known.status, known.message);

  if (signal) return JSON.parse(await requestText(url, path, revalidate, token, signal)) as T;

  let pending = inflight.get(key);
  if (!pending) {
    pending = requestText(url, path, revalidate, token, undefined).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  // Each caller parses for itself, so none can change what another one holds.
  return JSON.parse(await pending) as T;
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
 * Never throws: the lookup only refines the page, so any failure (after the retries in
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

/**
 * The cast and crew of one film (`/movie/{id}/credits`), cached for a day like the other film
 * lookups. For the live fallback of the collaborator suggestions, which counts who worked on a
 * person's best-known films.
 */
export function getFilmCredits(id: number): Promise<RawFilmCredits> {
  return tmdbGet<RawFilmCredits>(`/movie/${id}/credits`, DAY);
}

export async function getFilmDetails(id: number): Promise<FilmDetails> {
  const movie = await tmdbGet<RawMovieDetails>(`/movie/${id}`, DAY, {
    append_to_response: "credits",
  });
  return normalizeFilmDetails(movie);
}

/** TMDB stores 0 for an unknown budget or revenue. */
const positiveOrNull = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

/**
 * The numbers for the hover card: a plain `/movie/{id}` (no credits appended, so the payload is
 * small), cached for a day like the other film lookups. Unknown figures come back as null.
 */
export async function getMovieMetrics(id: number): Promise<MovieMetrics> {
  const movie = await tmdbGet<RawMovieMetrics>(`/movie/${id}`, DAY);
  const votes = typeof movie.vote_count === "number" && movie.vote_count > 0 ? movie.vote_count : 0;
  return {
    voteAverage: votes > 0 ? positiveOrNull(movie.vote_average) : null,
    voteCount: votes,
    budget: positiveOrNull(movie.budget),
    revenue: positiveOrNull(movie.revenue),
    releaseDate: movie.release_date || null,
  };
}
