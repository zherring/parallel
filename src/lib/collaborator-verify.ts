import { MIN_SHARED_FILMS } from "@/lib/collaborator-graph";
import { pickSuggestions, primaryGroup, roleGroupOf, type Pickable, type RoleGroup } from "@/lib/role-groups";
import { roleSummary } from "@/lib/roles";
import { sharedFilms } from "@/lib/shared";
import type { CollaboratorSuggestion, Credit, PersonTimeline, RoleKey, SharedFilm } from "@/lib/types";

/** How many suggestions there are at most (the Add a person dropdown lists the first few). */
export const MAX_SUGGESTIONS = 10;
const MAX_TITLES = 3;

/** A candidate whose films with the subject were counted the way the pair page counts them. */
export interface VerifiedCollaborator extends Pickable {
  /** Position among the candidates (best first): breaks ties between equal counts. */
  rank: number;
  person: PersonTimeline["person"];
  /** The films they share, oldest first: exactly the pair page's list. */
  films: SharedFilm[];
}

/** How many of `films` the person was credited on in one of `roles` (the credits the pair page counts: not the minor ones). */
export function filmsCreditedAs(films: readonly SharedFilm[], personId: number, roles: readonly RoleKey[]): number {
  return films.filter((film) => (film.byPerson[personId] ?? []).some((credit) => roles.includes(credit.role))).length;
}

/**
 * The real shared films of the subject and one candidate, by the pair page's own code
 * (`sharedFilms` with minor credits off: released films only). Null when they share fewer than
 * `minShared`, which is also how a stale or wrong candidate drops out.
 *
 * `roles` restricts the list to people who did that kind of work with the subject (Kevin Bacon mode's list is actors and directors): fewer than `minShared` of the
 * shared films with a credit in one of the roles is also null. The films, and so the count, are all of them, the pair page's own.
 */
export function verifyCollaborator(
  subject: PersonTimeline,
  other: PersonTimeline,
  rank: number,
  { today, minShared = MIN_SHARED_FILMS, roles }: { today: string; minShared?: number; roles?: readonly RoleKey[] },
): VerifiedCollaborator | null {
  const films = sharedFilms([subject, other], { includeMinor: false, today });
  if (films.length < minShared) return null;
  if (roles && filmsCreditedAs(films, other.person.id, roles) < minShared) return null;

  const perGroup: Partial<Record<RoleGroup, number>> = {};
  for (const film of films) {
    const groups = new Set((film.byPerson[other.person.id] ?? []).map((c) => roleGroupOf(c.role)));
    for (const group of groups) perGroup[group] = (perGroup[group] ?? 0) + 1;
  }
  return { rank, person: other.person, films, count: films.length, group: primaryGroup(perGroup) };
}

/** The suggestion for a verified collaborator: their roles on the shared films and the best-voted titles. */
export function toSuggestion(
  collaborator: VerifiedCollaborator,
  subject: PersonTimeline,
): CollaboratorSuggestion {
  const { person, films } = collaborator;
  const votes = new Map(subject.films.map((film) => [film.id, film.voteCount]));
  const credits: Credit[] = films.flatMap((film) => film.byPerson[person.id] ?? []);
  const titles = [...films]
    .sort(
      (a, b) =>
        (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0) || b.releaseDate.localeCompare(a.releaseDate) || a.id - b.id,
    )
    .slice(0, MAX_TITLES)
    .map((film) => film.title);
  return {
    id: person.id,
    name: person.name,
    profilePath: person.profilePath,
    sharedCount: collaborator.count,
    roles: roleSummary(credits),
    titles,
  };
}

/**
 * The suggestions for `subject` from the candidates' filmographies (best candidate first; a candidate
 * whose timeline could not be loaded is simply left out by the caller). Each candidate is counted
 * exactly, those under two shared films are dropped, the rest are re-ranked by the exact count
 * (ties keep the candidates' order, which is notability) and `pickSuggestions` makes the list
 * varied. `roles` keeps only the people who did that kind of work with the subject (see `verifyCollaborator`).
 */
export function suggestFromTimelines(
  subject: PersonTimeline,
  candidates: readonly PersonTimeline[],
  { today, limit = MAX_SUGGESTIONS, roles }: { today: string; limit?: number; roles?: readonly RoleKey[] },
): CollaboratorSuggestion[] {
  const verified: VerifiedCollaborator[] = [];
  candidates.forEach((other, rank) => {
    if (other.person.id === subject.person.id) return;
    const result = verifyCollaborator(subject, other, rank, { today, roles });
    if (result) verified.push(result);
  });
  verified.sort((a, b) => b.count - a.count || a.rank - b.rank);
  return pickSuggestions(verified, limit).map((v) => toSuggestion(v, subject));
}
