import "server-only";
import {
  GRAPH_CANDIDATES,
  MIN_GRAPH_ROW,
  membersFromCredits,
  membersOfGroups,
  pickCandidates,
} from "@/lib/collaborator-graph";
import { suggestFromTimelines } from "@/lib/collaborator-verify";
import { loadCollaboratorGraph } from "@/lib/collaborators-index";
import { mapLimited } from "@/lib/map-limited";
import { isReleased, todayIso } from "@/lib/released";
import { roleGroupOf } from "@/lib/role-groups";
import { getFilmCredits, getPersonMovieCredits } from "@/lib/tmdb";
import { TtlCache } from "@/lib/ttl-cache";
import type { CollaboratorSuggestions, PersonTimeline, RoleKey } from "@/lib/types";

/** Candidates whose filmographies are fetched to be counted exactly. */
const VERIFY_CANDIDATES = GRAPH_CANDIDATES;
/**
 * Filmographies (and film credits) loaded at once. This bounds the fan-out, not the wire: the
 * TMDB client's own limiter holds the requests on the wire to six. Without it all 16 candidates
 * would ask at once, and with every request's 12s deadline running from the moment it is asked
 * for, the ones at the back of the queue would run out of time before they were ever sent.
 */
const CONCURRENCY = 6;
/** The live fallback looks at the person's best-known films only. */
const LIVE_FILMS = 25;
/**
 * When a caller asks for a thin graph row to be topped up (`minCandidates`), the crawl barely saw the person's films, so the top-up looks at more of them (the
 * teams' list reads as many, and shares their credits through the fetch cache): someone with eleven small films with them, who is billed on none of their
 * best-known twenty-five, is still among their most frequent. Up to this many credit requests on a cold cache, which is why only the callers that ask pay it.
 */
const TOP_UP_FILMS = 80;

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
/** A list that is missing candidates is kept only briefly: long enough to spare TMDB, short enough to heal. */
const PARTIAL_TTL_MS = 5 * 60 * 1000;
const CACHE_SIZE = 200;

/** Finished lists, for a few hours. TMDB's own responses are cached for a day by the fetch cache. */
const finished = new TtlCache<string, CollaboratorSuggestions>(CACHE_SIZE, CACHE_TTL_MS);
/** Lists some of whose candidates could not be loaded, for a few minutes. */
const partial = new TtlCache<string, CollaboratorSuggestions>(CACHE_SIZE, PARTIAL_TTL_MS);
/** Lists being computed right now, so a burst of requests for one person does the work once. */
const running = new Map<string, Promise<SuggestionResult>>();

/** What a caller may ask of `suggestCollaboratorsChecked` besides the person. */
export interface SuggestionOptions {
  /**
   * Fill a graph row with fewer candidates than this with the live ones (the crawl saw few of the person's films, and the caller lists that many). Off by
   * default: the top-up costs up to TOP_UP_FILMS credit requests on a cold cache, so a caller that wants it has to say so. Rounded down, and at most the
   * candidates that are counted (GRAPH_CANDIDATES); under 1 is off.
   */
  minCandidates?: number;
  /**
   * Keep only the people who did one of these kinds of work with the person (Kevin Bacon mode's "Often with" is actors and directors, `MODE_ROLES`): the live candidates are
   * counted from those credits alone, so the crew never takes a place, and any candidate, the graph's included, without enough of those credits among the films shared is left out
   * when it is counted exactly (so a graph row that is long enough, which is used as it is, can come out shorter). Off by default: everybody else's list, and his outside the mode, is every kind of work.
   */
  roles?: readonly RoleKey[];
}

/** `minCandidates` as it is used: a whole number from 0 (off) to VERIFY_CANDIDATES. */
function fillTarget(minCandidates: number | undefined): number {
  if (minCandidates === undefined || !Number.isFinite(minCandidates)) return 0;
  return Math.min(Math.max(Math.trunc(minCandidates), 0), VERIFY_CANDIDATES);
}

/** The remembered list is per person, per fill and per restriction: a topped-up list is not the graph's list, nor is a list of actors and directors, and each is kept apart. */
const cacheKey = (personId: number, fill: number, roles: readonly RoleKey[]): string =>
  [String(personId), fill > 0 ? `fill${fill}` : "", ...(roles.length > 0 ? [`roles:${[...roles].sort().join(",")}`] : [])].filter(Boolean).join("+");

/** A list, and whether every candidate made it into it (false: some filmographies failed to load). */
export interface SuggestionResult {
  suggestions: CollaboratorSuggestions;
  complete: boolean;
}

/** Forgets every remembered list (for tests). */
export function resetSuggestionCache(): void {
  finished.clear();
  partial.clear();
  running.clear();
}

/** The graph's candidates for a person, best first, or null when the graph has no (or a thin) row. */
async function graphCandidates(personId: number): Promise<number[] | null> {
  try {
    const row = (await loadCollaboratorGraph()).get(personId);
    return row && row.ids.length >= MIN_GRAPH_ROW ? row.ids.slice(0, VERIFY_CANDIDATES) : null;
  } catch (error) {
    // A graph that cannot be read only costs speed: the live fallback still answers.
    console.error(error instanceof Error ? error.message : "Collaborator graph failed to load");
    return null;
  }
}

/** Throws the first failure when nothing succeeded, so a TMDB outage is an error and not "no results". */
export function fulfilledOrThrow<T>(settled: PromiseSettledResult<T>[]): T[] {
  const values: T[] = [];
  let firstError: unknown;
  let failed = false;
  for (const result of settled) {
    if (result.status === "fulfilled") values.push(result.value);
    else if (!failed) {
      failed = true;
      firstError = result.reason;
    }
  }
  if (settled.length > 0 && values.length === 0) throw firstError;
  return values;
}

/**
 * Candidates counted live: who is credited next to the person on their best-known released
 * films (their top `filmCount`, 25 unless said, by vote count), by the same counting as the graph. Credits of films that
 * fail to load are skipped; if none load, this throws.
 */
async function liveCandidates(
  subject: PersonTimeline,
  today: string,
  signal?: AbortSignal,
  filmCount: number = LIVE_FILMS,
  roles: readonly RoleKey[] = [],
): Promise<number[]> {
  const films = subject.films
    .filter((film) => !film.minor && isReleased(film.releaseDate, today))
    .sort((a, b) => b.voteCount - a.voteCount || b.releaseDate.localeCompare(a.releaseDate) || a.id - b.id)
    .slice(0, filmCount);

  const credits = fulfilledOrThrow(await mapLimited(films, CONCURRENCY, (film) => getFilmCredits(film.id, signal)));

  // TMDB's popularity of each person breaks ties between equal counts.
  const popularity = new Map<number, number>();
  for (const { cast = [], crew = [] } of credits) {
    for (const person of [...cast, ...crew]) {
      popularity.set(person.id, Math.max(popularity.get(person.id) ?? 0, person.popularity ?? 0));
    }
  }
  // A restricted list counts only the credits it is about, so that crew never takes one of the candidates' places.
  const groups = roles.map(roleGroupOf);
  const members = credits.map((c) => (groups.length > 0 ? membersOfGroups(membersFromCredits(c), groups) : membersFromCredits(c)));
  return pickCandidates(subject.person.id, members, (id) => popularity.get(id) ?? 0, VERIFY_CANDIDATES).map(
    (candidate) => candidate.id,
  );
}

async function compute(personId: number, signal: AbortSignal | undefined, fill: number, roles: readonly RoleKey[]): Promise<SuggestionResult> {
  const subject = await getPersonMovieCredits(personId, { signal });
  const today = todayIso();

  const fromGraph = await graphCandidates(personId);
  let source: CollaboratorSuggestions["source"] = fromGraph ? "graph" : "live";
  let candidateIds: number[];
  // Whether the live candidates a thin row wanted were found: without them the list is the graph's alone, and is kept briefly.
  let toppedUp = true;
  if (fromGraph && fromGraph.length >= fill) {
    candidateIds = fromGraph;
  } else if (fromGraph) {
    // A row under the asked-for fill: the graph's candidates first, then the live ones the graph lacks. A restricted list takes the live ones first: they are all of its kind,
    // where the graph's include the crew that the exact count will drop (and in the 16 places, the live ones are what fills the list).
    try {
      const live = await liveCandidates(subject, today, signal, TOP_UP_FILMS, roles);
      candidateIds = [...new Set(roles.length > 0 ? [...live, ...fromGraph] : [...fromGraph, ...live])].slice(0, VERIFY_CANDIDATES);
      source = "live";
    } catch (error) {
      console.warn(error instanceof Error ? `Live collaborators unavailable, using the graph's: ${error.message}` : "Live collaborators unavailable, using the graph's");
      candidateIds = fromGraph;
      toppedUp = false;
    }
  } else {
    candidateIds = await liveCandidates(subject, today, signal, LIVE_FILMS, roles);
  }

  // Candidates skip the short-film lookup. A film counts as shared only if both people have a
  // non-minor credit on it, and the subject's own lookup (above) already marks the shorts they
  // share, so the counts match the pair page. Sixteen more lookups would also queue in the shared
  // short-film lane ahead of a visitor's page, whose 3s budget counts that wait.
  const settled = await mapLimited(candidateIds, CONCURRENCY, (id) => getPersonMovieCredits(id, { shorts: false, signal }));
  const timelines = fulfilledOrThrow(settled);
  const results = suggestFromTimelines(subject, timelines, { today, roles: roles.length > 0 ? roles : undefined });
  // Incomplete too when the subject's short-film lookup was cut short or capped: the counts then include a few shorts.
  const complete = toppedUp && timelines.length === candidateIds.length && !subject.shortsIncomplete;
  return { suggestions: { source, results }, complete };
}

/**
 * The people `personId` has worked with most, ready to suggest: candidates from the
 * precomputed collaborator graph (or, for someone the graph does not know, counted live over
 * their best-known films; a row the graph has but under `options.minCandidates`, which is asked for and
 * never the default, is topped up with the live ones), each one then counted exactly from the two
 * filmographies and made varied by role. Throws a TmdbError when TMDB cannot answer (404 for an unknown person).
 *
 * Remembered for a few hours; when some candidates could not be loaded (or a short-film lookup
 * was cut short) the list is incomplete and is remembered for a few minutes only, after which the
 * next request tries again. `complete` says which, so the API route can give a shared cache the
 * same two lifetimes.
 *
 * `signal` is the route's time budget (see ROUTE_BUDGET_MS), passed to every TMDB call: candidates
 * not loaded by the time it aborts are left out, so the list is partial. (A computation already
 * under way for the same person keeps the signal of the request that started it.)
 */
export function suggestCollaboratorsChecked(personId: number, signal?: AbortSignal, options: SuggestionOptions = {}): Promise<SuggestionResult> {
  const fill = fillTarget(options.minCandidates);
  const roles = options.roles ?? [];
  const key = cacheKey(personId, fill, roles);
  const done = finished.get(key);
  if (done) return Promise.resolve({ suggestions: done, complete: true });
  const incomplete = partial.get(key);
  if (incomplete) return Promise.resolve({ suggestions: incomplete, complete: false });

  let pending = running.get(key);
  if (!pending) {
    pending = compute(personId, signal, fill, roles)
      .then((result) => {
        (result.complete ? finished : partial).set(key, result.suggestions);
        return result;
      })
      .finally(() => running.delete(key));
    running.set(key, pending);
  }
  return pending;
}
