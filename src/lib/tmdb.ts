import "server-only";
import { cache } from "react";
import { normalizeFilmDetails, normalizeMovieCredits, normalizePerson } from "@/lib/normalize";
import { MIN_ATTEMPT_MS, classifyConnectionError, retryDelayMs, retryFits } from "@/lib/retry";
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
 *
 * Every page and route that can reach TMDB exports a `maxDuration` above this: if the platform
 * ends the function first, this deadline never fires and the visitor gets a platform timeout
 * instead of our error. 20 seconds where one round of requests is made (8 to spare for the error
 * response or the render); 60 on the two routes that make several rounds in turn (the film-metrics
 * batch, 50 films 8 at a time; the collaborator suggestions, a person and then 16 more).
 * `src/app/max-duration.test.ts` lists them and checks.
 */
export const REQUEST_DEADLINE_MS = 12_000;
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
/**
 * The whole short-film lookup of one person, its chained page requests included, gives up after
 * this long, whatever REQUEST_DEADLINE_MS says: the lookup only sharpens a page, so a slow TMDB must
 * not keep the page waiting for it.
 */
const REFINEMENT_BUDGET_MS = 3000;

export class TmdbError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

/** Waits `ms`; false (at once) if `signal` aborts first, so a caller that gave up is not kept waiting. */
function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

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
  /** The deadline, not TMDB, ended it: it passed in the queue, or the attempt was left under MIN_ATTEMPT_MS. */
  | "deadline";

type Attempt =
  | { kind: "ok"; text: string }
  | { kind: "http"; status: number; retryAfter: string | null }
  | { kind: "error"; cause: ErrorCause };

/** When a request must be finished by, and a signal that aborts then (to leave a queue). */
interface Deadline {
  at: number;
  expired: AbortSignal;
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
 * min(ATTEMPT_TIMEOUT_MS, time left).
 *
 * Only failures of the connection are returned, as retryable: our timeout, the deadline, a
 * network error. Anything else thrown (a bug of ours, a bad header) is rethrown as it is, and so
 * is a TmdbError 504 when the caller's own `signal` aborted.
 */
async function attemptOnce(call: Call, deadline: Deadline): Promise<Attempt> {
  const { url, path, revalidate, token, signal, lane } = call;
  const { limiter, refinements } = client();
  let timeout: AbortSignal | undefined;
  let sent = false;
  let squeezed = false;
  try {
    const queueSignal = signal ? AbortSignal.any([signal, deadline.expired]) : deadline.expired;
    const send = () =>
      limiter.run(async (): Promise<Attempt> => {
        // A slot that came too late is no use: do not send an attempt that has no time to finish.
        const left = deadline.at - Date.now();
        if (left <= 0) return { kind: "error", cause: "deadline" };
        sent = true;
        squeezed = left < MIN_ATTEMPT_MS;
        timeout = AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, left));
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": USER_AGENT },
          next: { revalidate },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (res.ok) return { kind: "ok", text: await res.text() };
        await res.body?.cancel().catch(() => {});
        return { kind: "http", status: res.status, retryAfter: res.headers.get("retry-after") };
      }, queueSignal);
    return await (lane === "refinement" ? refinements.run(send, queueSignal) : send());
  } catch (error) {
    if (signal?.aborted) throw new TmdbError(504, `TMDB request to ${path} timed out`);
    if (!sent) {
      if (deadline.expired.aborted) return { kind: "error", cause: "deadline" };
      throw error;
    }
    if (timeout?.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      // An attempt the deadline left under MIN_ATTEMPT_MS says nothing about TMDB: not remembered.
      return { kind: "error", cause: squeezed ? "deadline" : "timeout" };
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
    case "deadline":
      return { status: 504, message: `TMDB request to ${path} timed out` };
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
 * network errors and timeouts are retried: after the wait Retry-After asks for (up to 10s), else
 * after ~500ms, then ~1500ms. The whole request, from this call on, is held to
 * REQUEST_DEADLINE_MS: time queued for a slot, attempts and waits all count, each attempt is cut
 * off at min(ATTEMPT_TIMEOUT_MS, time left), and a retry is made only if its wait plus
 * MIN_ATTEMPT_MS still fits. Other 4xx are final. A 404, and a request that is still failing once
 * it is out of tries or time, are remembered so the next ask fails at once (not one the deadline
 * ended: it never got a slot, or an attempt of MIN_ATTEMPT_MS, so nothing is known about TMDB).
 */
async function requestText(call: Call): Promise<string> {
  const { notFound, unavailable } = client();
  const key = call.url.toString();
  const deadline: Deadline = {
    at: Date.now() + REQUEST_DEADLINE_MS,
    expired: AbortSignal.timeout(REQUEST_DEADLINE_MS),
  };

  for (let attempt = 1; ; attempt++) {
    const outcome = await attemptOnce(call, deadline);
    if (outcome.kind === "ok") return outcome.text;

    const failure = describeFailure(outcome, call.path);
    const retryable = outcome.kind === "error" || outcome.status === 429 || outcome.status >= 500;

    if (!retryable) {
      if (failure.status === 404) notFound.set(key, failure);
      if (failure.status === 401 || failure.status === 403) warnAboutCredentials(failure.status);
      throw new TmdbError(failure.status, failure.message);
    }

    const delay = retryDelayMs(attempt, outcome.kind === "http" ? outcome.retryAfter : null, Date.now());
    if (attempt >= MAX_ATTEMPTS || !retryFits(delay, deadline.at - Date.now())) {
      if (!(outcome.kind === "error" && outcome.cause === "deadline")) unavailable.set(key, failure);
      throw new TmdbError(failure.status, failure.message);
    }
    // The caller's own deadline cuts a wait short too (a long Retry-After must not outlast it).
    if (!(await sleep(delay, call.signal))) throw new TmdbError(504, `TMDB request to ${call.path} timed out`);
  }
}

/**
 * GET against TMDB, parsed as JSON. Every TMDB call goes through here, so every call is held to
 * the same rules: at most MAX_CONCURRENT_REQUESTS on the wire, the retries, timeouts and deadline
 * described on `requestText`, and the Next data cache (`next.revalidate`, which only keeps 200s)
 * in front. A failure that was just seen for the same URL is thrown again without calling TMDB.
 *
 * A 200 that is not JSON (an HTML page from a proxy) is a 502, remembered 45s like the other failures
 * and not retried. Next's data cache keeps 200s, so such a body can sit in it until it revalidates
 * (there is no API to evict one entry, and revalidating the path would drop every good one with it):
 * until then the URL fails each time the 45s memory has lapsed.
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

  // Each caller parses for itself, so none can change what another one holds.
  const parse = (text: string): T => {
    try {
      return JSON.parse(text) as T;
    } catch {
      const failure = { status: 502, message: `TMDB request to ${path} returned an unreadable response` };
      unavailable.set(key, failure);
      throw new TmdbError(failure.status, failure.message);
    }
  };

  if (signal) return parse(await requestText({ url, path, revalidate, token, signal, lane }));

  let pending = inflight.get(key);
  if (!pending) {
    pending = requestText({ url, path, revalidate, token, signal: undefined, lane }).finally(() =>
      inflight.delete(key),
    );
    inflight.set(key, pending);
  }
  return parse(await pending);
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
 * - The whole lookup, page after page, is given REFINEMENT_BUDGET_MS (3 seconds), the wait in the
 *   lane included. When that runs out it resolves at once with the pages it has by then (maybe
 *   none), whatever TMDB is doing.
 *
 * A lookup that is cut short, or that lost a page, leaves some shorts counting as ordinary
 * credits on that render. Nothing derived from it is kept for long: the Next data cache holds raw
 * TMDB responses only (and only the pages that did arrive), the next request asks for the missing
 * ones again, and `getPersonMovieCredits` marks the timeline `shortsIncomplete` so the caches
 * downstream (collaborator suggestions, OG cards) keep it briefly.
 */
async function lookUpShortMovies(personId: number): Promise<{ ids: Set<number>; complete: boolean }> {
  const budget = AbortSignal.timeout(REFINEMENT_BUDGET_MS);
  // Registered before any request is made, so it runs first when the budget ends.
  let cutShort = false;
  const outOfTime = new Promise<void>((resolve) =>
    budget.addEventListener(
      "abort",
      () => {
        cutShort = true;
        resolve();
      },
      { once: true },
    ),
  );

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
  let complete = true;
  const collect = (data: RawDiscoverMovies) => {
    for (const movie of data.results ?? []) ids.add(movie.id);
  };

  const pages = (async () => {
    try {
      const first = await query(1);
      collect(first);

      const count = Math.min(first.total_pages ?? 1, MAX_DISCOVER_PAGES);
      const rest = await Promise.allSettled(
        Array.from({ length: Math.max(0, count - 1) }, (_, i) => query(i + 2)),
      );
      for (const result of rest) {
        if (result.status === "fulfilled") collect(result.value);
        else complete = false;
      }
    } catch (error) {
      complete = false;
      if (!cutShort) {
        const status = error instanceof TmdbError ? ` (status ${error.status})` : "";
        console.warn(`TMDB short-movie lookup failed for person ${personId}${status}`);
      }
    }
  })();

  await Promise.race([pages, outOfTime]);
  if (cutShort) {
    complete = false;
    console.warn(`TMDB short-movie lookup for person ${personId} cut short after ${REFINEMENT_BUDGET_MS}ms`);
  }
  // A copy: a page that arrives after the race was decided must not change what was returned.
  return { ids: new Set(ids), complete };
}

/**
 * A person with their movie credits. `shorts: false` skips the short-film lookup (see
 * `lookUpShortMovies`): shorts then count as ordinary credits. Pass an options object rather than
 * letting `.map` hand over its index.
 *
 * `cache()` makes `generateMetadata` and the page of one render share a person's load (the
 * discover lookup carries a signal, so neither our in-flight map nor Next's fetch dedupe would).
 * It is keyed by the arguments, so it is per person, whatever form the page's slug takes.
 */
export const getPersonMovieCredits = cache(
  async (id: number, { shorts: withShorts = true } = {}): Promise<PersonTimeline> => {
    const [person, credits, shorts] = await Promise.all([
      getPerson(id),
      tmdbGet<RawMovieCredits>(`/person/${id}/movie_credits`, DAY),
      withShorts ? lookUpShortMovies(id) : { ids: new Set<number>(), complete: true },
    ]);
    return {
      person,
      films: normalizeMovieCredits(credits, shorts.ids),
      ...(shorts.complete ? {} : { shortsIncomplete: true as const }),
    };
  },
);

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
