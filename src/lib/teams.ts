import "server-only";
import { membersFromCredits } from "@/lib/collaborator-graph";
import { fulfilledOrThrow } from "@/lib/collaborators";
import { mapLimited } from "@/lib/map-limited";
import { isReleased, todayIso } from "@/lib/released";
import { sharedFilms } from "@/lib/shared";
import { pickTeams, rankTeams, MIN_TEAM_FILMS } from "@/lib/teams-rank";
import { getFilmCredits, getPersonMovieCredits } from "@/lib/tmdb";
import { TtlCache } from "@/lib/ttl-cache";
import type { PersonTimeline, TeamSuggestion, TeamSuggestions } from "@/lib/types";

/** Film credits and filmographies loaded at once (the TMDB client's own limiter holds the wire to six). */
const CONCURRENCY = 6;
/** The subject's films whose credits are read: their best-known ones, by votes. */
const TEAM_FILMS = 80;
/** Teams counted exactly, from the two filmographies: more than are shown, since the exact count drops and reorders some. */
const TEAM_CANDIDATES = 12;
/** A person is in at most this many of the candidates, and in one of the teams shown. */
const CANDIDATES_PER_PERSON = 2;
export const MAX_TEAMS = 6;
const MAX_TITLES = 3;

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const PARTIAL_TTL_MS = 5 * 60 * 1000;
const CACHE_SIZE = 50;

const finished = new TtlCache<number, TeamSuggestions>(CACHE_SIZE, CACHE_TTL_MS);
const partial = new TtlCache<number, TeamSuggestions>(CACHE_SIZE, PARTIAL_TTL_MS);
const running = new Map<number, Promise<TeamResult>>();

/** A list, and whether everything it is counted from was loaded (false: some credits or filmographies were not). */
export interface TeamResult {
  teams: TeamSuggestions;
  complete: boolean;
}

/** Forgets every remembered list (for tests). */
export function resetTeamCache(): void {
  finished.clear();
  partial.clear();
  running.clear();
}

async function compute(personId: number, signal?: AbortSignal): Promise<TeamResult> {
  const subject = await getPersonMovieCredits(personId, { signal });
  const today = todayIso();
  const films = subject.films
    .filter((film) => !film.minor && isReleased(film.releaseDate, today))
    .sort((a, b) => b.voteCount - a.voteCount || b.releaseDate.localeCompare(a.releaseDate) || a.id - b.id)
    .slice(0, TEAM_FILMS);

  // Who is credited next to the subject on each film: one request a film, a day in the fetch cache.
  const credits = fulfilledOrThrow(await mapLimited(films, CONCURRENCY, (film) => getFilmCredits(film.id, signal)));
  const popularity = new Map<number, number>();
  for (const { cast = [], crew = [] } of credits) {
    for (const person of [...cast, ...crew]) {
      popularity.set(person.id, Math.max(popularity.get(person.id) ?? 0, person.popularity ?? 0));
    }
  }
  const ranked = rankTeams(personId, credits.map((c) => membersFromCredits(c)), (id) => popularity.get(id) ?? 0);
  const candidates = pickTeams(ranked, TEAM_CANDIDATES, CANDIDATES_PER_PERSON);

  // The exact count is the page's own: the films all three share by `sharedFilms`, from the filmographies.
  const ids = [...new Set(candidates.flatMap((team) => team.ids))];
  const settled = await mapLimited(ids, CONCURRENCY, (id) => getPersonMovieCredits(id, { shorts: false, signal }));
  const timelines = new Map<number, PersonTimeline>();
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") timelines.set(ids[index], result.value);
  });

  const votes = new Map(subject.films.map((film) => [film.id, film.voteCount]));
  const verified: (TeamSuggestion & { ids: readonly [number, number] })[] = [];
  for (const team of candidates) {
    const [a, b] = [timelines.get(team.ids[0]), timelines.get(team.ids[1])];
    if (!a || !b) continue;
    const together = sharedFilms([subject, a, b], { includeMinor: false, today });
    if (together.length < MIN_TEAM_FILMS) continue;
    const titles = [...together]
      .sort((x, y) => (votes.get(y.id) ?? 0) - (votes.get(x.id) ?? 0) || y.releaseDate.localeCompare(x.releaseDate) || x.id - y.id)
      .slice(0, MAX_TITLES)
      .map((film) => film.title);
    const person = ({ person }: PersonTimeline) => ({ id: person.id, name: person.name, profilePath: person.profilePath });
    verified.push({ ids: team.ids, people: [person(a), person(b)], sharedCount: together.length, titles });
  }
  // By the exact count; equal counts keep the candidates' order (the credits' count, then how well known they are).
  verified.sort((x, y) => y.sharedCount - x.sharedCount);
  const results = pickTeams(verified, MAX_TEAMS, 1).map(({ people, sharedCount, titles }) => ({ people, sharedCount, titles }));

  const complete = credits.length === films.length && timelines.size === ids.length && !subject.shortsIncomplete;
  return { teams: { results }, complete };
}

/**
 * The teams of `personId`: the pairs of people who made the most films with them together, at most six, no person twice.
 * Candidates are counted from the credits of the person's best-known films (who is credited together, as the collaborator
 * graph counts it), and each is then counted exactly from the three filmographies, so a row never disagrees with the page
 * of the three it opens. Throws a TmdbError when TMDB cannot answer (404 for an unknown person).
 *
 * A cold request reads up to 80 film credits and 24 filmographies (about 130 TMDB requests, kept for a day by the fetch
 * cache); the list is then remembered for three hours, or for a few minutes when something it needed did not load.
 * `signal` is the route's time budget.
 */
export function suggestTeamsChecked(personId: number, signal?: AbortSignal): Promise<TeamResult> {
  const done = finished.get(personId);
  if (done) return Promise.resolve({ teams: done, complete: true });
  const incomplete = partial.get(personId);
  if (incomplete) return Promise.resolve({ teams: incomplete, complete: false });

  let pending = running.get(personId);
  if (!pending) {
    pending = compute(personId, signal)
      .then((result) => {
        (result.complete ? finished : partial).set(personId, result.teams);
        return result;
      })
      .finally(() => running.delete(personId));
    running.set(personId, pending);
  }
  return pending;
}
