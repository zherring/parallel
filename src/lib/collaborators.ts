import "server-only";
import {
  GRAPH_CANDIDATES,
  MIN_GRAPH_ROW,
  membersFromCredits,
  pickCandidates,
} from "@/lib/collaborator-graph";
import { suggestFromTimelines } from "@/lib/collaborator-verify";
import { loadCollaboratorGraph } from "@/lib/collaborators-index";
import { mapLimited } from "@/lib/map-limited";
import { isReleased, todayIso } from "@/lib/released";
import { getFilmCredits, getPersonMovieCredits } from "@/lib/tmdb";
import { TtlCache } from "@/lib/ttl-cache";
import type { CollaboratorSuggestions, PersonTimeline } from "@/lib/types";

/** Candidates whose filmographies are fetched to be counted exactly. */
const VERIFY_CANDIDATES = GRAPH_CANDIDATES;
/** TMDB requests in flight at once (each filmography is a few requests of its own). */
const CONCURRENCY = 6;
/** The live fallback looks at the person's best-known films only. */
const LIVE_FILMS = 25;

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const CACHE_SIZE = 200;

/** Finished lists, for a few hours. TMDB's own responses are cached for a day by the fetch cache. */
const finished = new TtlCache<number, CollaboratorSuggestions>(CACHE_SIZE, CACHE_TTL_MS);
/** Lists being computed right now, so a burst of requests for one person does the work once. */
const running = new Map<number, Promise<CollaboratorSuggestions>>();

/** Forgets every remembered list (for tests). */
export function resetSuggestionCache(): void {
  finished.clear();
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
function fulfilledOrThrow<T>(settled: PromiseSettledResult<T>[]): T[] {
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
 * films (their top 25 by vote count), by the same counting as the graph. Credits of films that
 * fail to load are skipped; if none load, this throws.
 */
async function liveCandidates(subject: PersonTimeline, today: string): Promise<number[]> {
  const films = subject.films
    .filter((film) => !film.minor && isReleased(film.releaseDate, today))
    .sort((a, b) => b.voteCount - a.voteCount || b.releaseDate.localeCompare(a.releaseDate) || a.id - b.id)
    .slice(0, LIVE_FILMS);

  const credits = fulfilledOrThrow(await mapLimited(films, CONCURRENCY, (film) => getFilmCredits(film.id)));

  // TMDB's popularity of each person breaks ties between equal counts.
  const popularity = new Map<number, number>();
  for (const { cast = [], crew = [] } of credits) {
    for (const person of [...cast, ...crew]) {
      popularity.set(person.id, Math.max(popularity.get(person.id) ?? 0, person.popularity ?? 0));
    }
  }
  const members = credits.map((c) => membersFromCredits(c));
  return pickCandidates(subject.person.id, members, (id) => popularity.get(id) ?? 0, VERIFY_CANDIDATES).map(
    (candidate) => candidate.id,
  );
}

async function compute(personId: number): Promise<{ suggestions: CollaboratorSuggestions; complete: boolean }> {
  const subject = await getPersonMovieCredits(personId);
  const today = todayIso();

  const fromGraph = await graphCandidates(personId);
  const source = fromGraph ? "graph" : "live";
  const candidateIds = fromGraph ?? (await liveCandidates(subject, today));

  // The same filmographies the pair page loads, so the counts match what a click shows.
  const settled = await mapLimited(candidateIds, CONCURRENCY, (id) => getPersonMovieCredits(id));
  const timelines = fulfilledOrThrow(settled);
  const results = suggestFromTimelines(subject, timelines, { today });
  return { suggestions: { source, results }, complete: timelines.length === candidateIds.length };
}

/**
 * The people `personId` has worked with most, ready for the chips: candidates from the
 * precomputed collaborator graph (or, for someone the graph does not know, counted live over
 * their best-known films), each one then counted exactly from the two filmographies and made
 * varied by role. Throws a TmdbError when TMDB cannot answer (404 for an unknown person).
 *
 * Remembered for a few hours, except when some candidates could not be loaded: that list is
 * incomplete, so the next request tries again.
 */
export function suggestCollaborators(personId: number): Promise<CollaboratorSuggestions> {
  const remembered = finished.get(personId);
  if (remembered) return Promise.resolve(remembered);

  let pending = running.get(personId);
  if (!pending) {
    pending = compute(personId)
      .then(({ suggestions, complete }) => {
        if (complete) finished.set(personId, suggestions);
        return suggestions;
      })
      .finally(() => running.delete(personId));
    running.set(personId, pending);
  }
  return pending;
}
