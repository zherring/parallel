import "server-only";
import { normalizeFilmDetails, normalizeMovieCredits, normalizePerson } from "@/lib/normalize";
import { classifyConnectionError, retryDelayMs, retryFits } from "@/lib/retry";
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
/** Of those, how many the optional short-film lookups may use at once; the rest is left to what a page needs. */
const MAX_CONCURRENT_REFINEMENTS = 2;
/** One try plus two retries, on 429, 5xx, network errors and timeouts. */
const MAX_ATTEMPTS = 3;
/** One attempt (headers and body) is given up on after this long, or sooner if the deadline is closer. */
const ATTEMPT_TIMEOUT_MS = 8000;
/**
 * The most time one request takes in all, from the moment it is asked for: waiting for a limiter
 * slot, every attempt and every wait between attempts. Past it the failure is thrown.
 */
const REQUEST_DEADLINE_MS = 12_000;
/** A 404 is remembered this long: the id does not exist, asking again will not change that. */
const NOT_FOUND_TTL_MS = 10 * 60 * 1000;
/** A request that still failed after its retries is remembered this long, so a bad spell is not hammered. */
const UNAVAILABLE_TTL_MS = 45 * 1000;
const NEGATIVE_CACHE_SIZE = 500;
const CREDENTIALS_LOG_INTERVAL_MS = 60 * 1000;
/** Says who is calling, as TMDB's API terms ask. No contact details in it on purpose. */
const USER_AGENT = "Parallel/1.0 (+https://github.com/zherring/parallel)";
/** Anything shorter than this many minutes is a "short" and counts as a minor credit. */
const SHORT_MAX_MINUTES = 39;
/** 20 results per page: 200 short movies per person is far more than anyone has. */
const MAX_DISCOVER_PAGES = 10;
/** With more than this many people in one request (a page, a fan-out)... */
const FULL_REFINEMENT_MAX_PEOPLE = 2;
/** ...only this many discover pages are read per person (60 short movies), not MAX_DISCOVER_PAGES. */
const CROWDED_DISCOVER_PAGES = 3;
/** The whole short-film lookup of one person, its chained page requests included, gives up after this long. */
const REFINEMENT_BUDGET_MS = REQUEST_DEADLINE_MS;

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
  /** TMDB requests on the wire, all of them: the whole client's limit. */
  limiter: Semaphore;
  /** The short-film refinement's own, smaller limit (each such request also takes a `limiter` slot). */
  refinements: Semaphore;
  /** Requests (by URL) that came back 404. */
  notFound: TtlCache<string, Failure>;
  /** Requests (by URL) that kept failing with 429, 5xx, a network error or a timeout. */
  unavailable: TtlCache<string, Failure>;
  /** Requests being made right now, so identical ones share a single trip to TMDB. */
  inflight: Map<string, Promise<string>>;
  /** When the "check your token" error was last logged, so a bad token logs once a minute, not per request. */
  credentialsLoggedAt: number;
}

// Bump the suffix when ClientState changes shape: dev hot reloads keep the old object on globalThis.
const STATE_KEY = "__parallelTmdbClient:v2";

/**
 * The limiters and the failure memories live on `globalThis` rather than in module variables:
 * Next bundles server components and route handlers separately, and each bundle would otherwise
 * get its own copy (and its own six slots) of this module.
 */
function client(): ClientState {
  const holder = globalThis as typeof globalThis & { [STATE_KEY]?: ClientState };
  return (holder[STATE_KEY] ??= {
    limiter: new Semaphore(MAX_CONCURRENT_REQUESTS),
    refinements: new Semaphore(MAX_CONCURRENT_REFINEMENTS),
    notFound: new TtlCache(NEGATIVE_CACHE_SIZE, NOT_FOUND_TTL_MS),
    unavailable: new TtlCache(NEGATIVE_CACHE_SIZE, UNAVAILABLE_TTL_MS),
    inflight: new Map(),
    credentialsLoggedAt: Number.NEGATIVE_INFINITY,
  });
}

/** Forgets the limiters, remembered failures and shared requests. For tests only. */
export function __resetTmdbClientStateForTests(): void {
  delete (globalThis as typeof globalThis & { [STATE_KEY]?: ClientState })[STATE_KEY];
}

/**
 * Which queue a request waits in. "critical" requests are what a page cannot render without: a
 * person, their credits, a film's details, search. "refinement" requests only sharpen a page that
 * can render without them (the short-film lookup, which is most of a person's requests) and wait
 * in a lane of their own: see `attemptOnce`.
 */
type Lane = "critical" | "refinement";

/** One call to TMDB, as every attempt of it sees it. */
interface Call {
  url: URL;
  path: string;
  revalidate: number;
  token: string;
  /** The caller's own deadline (see `tmdbGet`). */
  signal: AbortSignal | undefined;
  lane: Lane;
}

/** How an attempt failed without TMDB answering with an error status. */
type ErrorCause =
  | "timeout"
  | "network"
  /** A 200 whose body is not JSON (an HTML error page from a proxy, a cut-off body). */
  | "unreadable"
  /** The deadline passed while waiting for a slot, so TMDB was never asked. */
  | "queue";

type Attempt =
  | { kind: "ok"; text: string }
  | { kind: "http"; status: number; retryAfter: string | null }
  | { kind: "error"; cause: ErrorCause };

/** When a request must be finished by, and a signal that aborts then (to leave a queue). */
interface Deadline {
  at: number;
  expired: AbortSignal;
}

function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * One try. It holds a limiter slot from the moment it starts until the body has been read, and
 * gives it back before anything sleeps. A response the Next data cache serves comes back within a
 * millisecond or so, so cache hits pass through the limiter without waiting on TMDB.
 *
 * Refinement requests first take one of the `refinements` slots (two) and only then queue for a
 * limiter slot. So at most two of the six slots are ever theirs, and at most two of them are ever
 * ahead of a critical request in the limiter's queue: a burst of 200 short-film lookups waits in
 * the refinement lane, where it blocks nobody. (A priority queue would also work; this needs no
 * change to the Semaphore.)
 *
 * The wait for either queue counts toward the request's `deadline`: a request still queued when
 * it passes leaves the queue without being sent. Once it has a slot, the attempt gets
 * min(ATTEMPT_TIMEOUT_MS, time left). `bypassCache` skips the Next data cache (for retrying a
 * cached body that turned out unreadable).
 *
 * Only failures of the connection are returned, as retryable: our timeout, the deadline, a
 * network error, an unreadable body. Anything else thrown (a bug of ours, a bad header) is
 * rethrown as it is, and so is a TmdbError 504 when the caller's own `signal` aborted.
 */
async function attemptOnce(call: Call, deadline: Deadline, bypassCache: boolean): Promise<Attempt> {
  const { url, path, revalidate, token, signal, lane } = call;
  const { limiter, refinements } = client();
  let timeout: AbortSignal | undefined;
  let sent = false;
  try {
    const queueSignal = signal ? AbortSignal.any([signal, deadline.expired]) : deadline.expired;
    const send = () =>
      limiter.run(async (): Promise<Attempt> => {
        sent = true;
        timeout = AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, Math.max(1, deadline.at - Date.now())));
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": USER_AGENT },
          ...(bypassCache ? { cache: "no-store" as const } : { next: { revalidate } }),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (res.ok) {
          const text = await res.text();
          return isJson(text) ? { kind: "ok", text } : { kind: "error", cause: "unreadable" };
        }
        await res.body?.cancel().catch(() => {});
        return { kind: "http", status: res.status, retryAfter: res.headers.get("retry-after") };
      }, queueSignal);
    return await (lane === "refinement" ? refinements.run(send, queueSignal) : send());
  } catch (error) {
    if (signal?.aborted) throw new TmdbError(504, `TMDB request to ${path} timed out`);
    if (!sent) {
      if (deadline.expired.aborted) return { kind: "error", cause: "queue" };
      throw error;
    }
    if (timeout?.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      return { kind: "error", cause: "timeout" };
    }
    const cause = classifyConnectionError(error);
    if (cause) return { kind: "error", cause };
    throw error;
  }
}

function describeFailure(outcome: Exclude<Attempt, { kind: "ok" }>, path: string): Failure {
  if (outcome.kind === "http") {
    return { status: outcome.status, message: `TMDB request to ${path} failed with ${outcome.status}` };
  }
  switch (outcome.cause) {
    case "timeout":
    case "queue":
      return { status: 504, message: `TMDB request to ${path} timed out` };
    case "unreadable":
      return { status: 502, message: `TMDB request to ${path} returned an unreadable response` };
    case "network":
      return { status: 502, message: `TMDB request to ${path} failed (network error)` };
  }
}

/** Says what a 401 or 403 almost certainly means. Never includes the token. At most once a minute. */
function warnAboutCredentials(status: number): void {
  const state = client();
  const now = Date.now();
  if (now - state.credentialsLoggedAt < CREDENTIALS_LOG_INTERVAL_MS) return;
  state.credentialsLoggedAt = now;
  console.error(`TMDB answered ${status}: check that TMDB_READ_ACCESS_TOKEN is set to a valid read access token`);
}

/**
 * The body of a successful response to `call.url`, after up to MAX_ATTEMPTS tries. 429, 5xx,
 * network errors, timeouts and unreadable 200s are retried: after the wait Retry-After asks for
 * (up to 10s), else after ~500ms, then ~1500ms. The whole request, from this call on, is held to
 * REQUEST_DEADLINE_MS: time queued for a slot, attempts and waits all count, each attempt is cut
 * off at min(ATTEMPT_TIMEOUT_MS, time left), and a retry is made only if its wait plus
 * MIN_ATTEMPT_MS still fits. Other 4xx are final. A 404, and a request that is still failing once
 * it is out of tries or time, are remembered so the next ask fails at once (not one that never
 * got a slot: TMDB was not asked, so nothing is known about it).
 */
async function requestText(call: Call): Promise<string> {
  const { notFound, unavailable } = client();
  const key = call.url.toString();
  const deadline: Deadline = {
    at: Date.now() + REQUEST_DEADLINE_MS,
    expired: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  };
  let bypassCache = false;

  for (let attempt = 1; ; attempt++) {
    const outcome = await attemptOnce(call, deadline, bypassCache);
    if (outcome.kind === "ok") return outcome.text;

    const failure = describeFailure(outcome, call.path);
    const retryable = outcome.kind === "error" || outcome.status === 429 || outcome.status >= 500;

    if (!retryable) {
      if (failure.status === 404) notFound.set(key, failure);
      if (failure.status === 401 || failure.status === 403) warnAboutCredentials(failure.status);
      throw new TmdbError(failure.status, failure.message);
    }

    // The Next data cache keeps 200s, so a cached unreadable body would come back on every retry.
    if (outcome.kind === "error" && outcome.cause === "unreadable") bypassCache = true;

    const delay = retryDelayMs(attempt, outcome.kind === "http" ? outcome.retryAfter : null, Date.now());
    if (attempt >= MAX_ATTEMPTS || !retryFits(delay, deadline.at - Date.now())) {
      if (!(outcome.kind === "error" && outcome.cause === "queue")) unavailable.set(key, failure);
      throw new TmdbError(failure.status, failure.message);
    }
    await sleep(delay);
  }
}

/**
 * GET against TMDB, parsed as JSON. Every TMDB call goes through here, so every call is held to
 * the same rules: at most MAX_CONCURRENT_REQUESTS on the wire, the retries, timeouts and deadline
 * described on `requestText`, and the Next data cache (`next.revalidate`, which only keeps 200s)
 * in front. A failure that was just seen for the same URL is thrown again without calling TMDB.
 *
 * `signal` is the caller's own deadline (the search route gives up after 1.5s): when it aborts,
 * this fails with a 504 and is neither retried nor remembered. A call without one shares the
 * request of an identical call already under way. (Every attempt carries a signal of its own
 * timeout, and Next's `dedupe-fetch.js` skips its per-render fetch memoization for any fetch
 * given a `signal`, so that sharing is done here instead; it covers calls that overlap in time,
 * not repeats made one after another.)
 */
async function tmdbGet<T>(
  path: string,
  revalidate: number,
  params: Record<string, string> = {},
  signal?: AbortSignal,
  lane: Lane = "critical",
): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is not set");

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const { notFound, unavailable, inflight } = client();
  const key = url.toString();
  const known = notFound.get(key) ?? unavailable.get(key);
  if (known) throw new TmdbError(known.status, known.message);

  if (signal) return JSON.parse(await requestText({ url, path, revalidate, token, signal, lane })) as T;

  let pending = inflight.get(key);
  if (!pending) {
    pending = requestText({ url, path, revalidate, token, signal: undefined, lane }).finally(() =>
      inflight.delete(key),
    );
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
 * `tmdbGet`) yields an empty set, or the pages that did load. So that it can never hold a page
 * up, it is kept out of the way of the requests the page does need:
 * - Its requests wait in their own lane, two at a time (see `attemptOnce`), however many people
 *   and pages are asked for.
 * - The whole lookup, page after page, gives up after REFINEMENT_BUDGET_MS.
 * - With more than two people in the request (`peopleOnPage`: a 3 or 4 person page, the
 *   collaborator suggestions' fan-out) it reads 3 pages per person (60 short movies), not 10.
 */
export async function getShortMovieIds(
  personId: number,
  { peopleOnPage = 1 }: { peopleOnPage?: number } = {},
): Promise<Set<number>> {
  const maxPages = peopleOnPage > FULL_REFINEMENT_MAX_PEOPLE ? CROWDED_DISCOVER_PAGES : MAX_DISCOVER_PAGES;
  const budget = AbortSignal.timeout(REFINEMENT_BUDGET_MS);
  const query = (page: number) =>
    tmdbGet<RawDiscoverMovies>(
      "/discover/movie",
      DAY,
      {
        with_people: String(personId),
        "with_runtime.gte": "1",
        "with_runtime.lte": String(SHORT_MAX_MINUTES),
        include_adult: "false",
        include_video: "true",
        sort_by: "primary_release_date.asc",
        page: String(page),
      },
      budget,
      "refinement",
    );

  const ids = new Set<number>();
  const collect = (data: RawDiscoverMovies) => {
    for (const movie of data.results ?? []) ids.add(movie.id);
  };

  try {
    const first = await query(1);
    collect(first);

    const pages = Math.min(first.total_pages ?? 1, maxPages);
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

/**
 * A person with their movie credits. `peopleOnPage` is how many people are being loaded together
 * (for the cap on short-movie pages, see `getShortMovieIds`); pass an options object rather than
 * letting `.map` hand over its index.
 */
export async function getPersonMovieCredits(
  id: number,
  options: { peopleOnPage?: number } = {},
): Promise<PersonTimeline> {
  const [person, credits, shortMovieIds] = await Promise.all([
    getPerson(id),
    tmdbGet<RawMovieCredits>(`/person/${id}/movie_credits`, DAY),
    getShortMovieIds(id, options),
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
