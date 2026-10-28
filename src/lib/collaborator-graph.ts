import type { CollaboratorRow } from "@/lib/collaborators-format";
import { pickSuggestions, roleGroupOf, primaryGroup, type RoleGroup } from "@/lib/role-groups";
import { isMinorCast, isMinorCrewRole, roleForJob } from "@/lib/roles";

/**
 * The collaborator graph: for each person, the people most often credited next to them across a
 * set of films. Pure, so the crawl script, the live fallback and the tests share one definition
 * of who counts and how they are ranked.
 *
 * Who counts on a film is the pair page's definition of a non-minor credit (`roles.ts`), so a
 * count here is close to the "N films together" a pair page shows: cast billed in the top 12
 * (never uncredited or self appearances) and every crew job that is not "other" (director,
 * writers, cinematographer, editor, composer, producer, designers). The exact number is always
 * recomputed from the two filmographies before it is shown (see collaborators.ts).
 */

/** Cast billed this far down (0-based) or beyond is not a collaborator. */
export const TOP_BILLED = 12;
/** Two people have to share at least this many films to be collaborators. */
export const MIN_SHARED_FILMS = 2;
/** A row keeps this many candidates, picked for variety (see `pickSuggestions`). */
export const GRAPH_CANDIDATES = 12;
/** A person with fewer candidates than this has no row: the live fallback does better. */
export const MIN_GRAPH_ROW = 3;

/** Everyone credited on one film, with the role groups they hold on it. */
export type FilmMembers = ReadonlyMap<number, ReadonlySet<RoleGroup>>;

interface CreditsLike {
  cast?: { id: number; order?: number; character?: string }[];
  crew?: { id: number; job?: string }[];
}

/** The people of a film that count as collaborators, from TMDB's `/movie/{id}/credits`. */
export function membersFromCredits(credits: CreditsLike | null | undefined): Map<number, Set<RoleGroup>> {
  const members = new Map<number, Set<RoleGroup>>();
  const add = (id: number, group: RoleGroup) => {
    const groups = members.get(id);
    if (groups) groups.add(group);
    else members.set(id, new Set([group]));
  };
  for (const c of credits?.cast ?? []) {
    const order = c.order ?? 0;
    if (order >= TOP_BILLED || isMinorCast(order, c.character)) continue;
    add(c.id, "acting");
  }
  for (const c of credits?.crew ?? []) {
    if (!c.job) continue;
    const role = roleForJob(c.job);
    if (!isMinorCrewRole(role)) add(c.id, roleGroupOf(role));
  }
  return members;
}

export interface RankedCollaborator {
  id: number;
  /** Films shared among the ones given. */
  count: number;
  /** The kind of work the collaborator mostly did on those films. */
  group: RoleGroup;
  /** Higher is better known; breaks ties between equal counts. */
  notability: number;
}

/** Credits and TMDB popularity in one number: credits dominate, popularity breaks ties. */
export function notabilityScore(credits: number, popularity: number): number {
  return credits * 10_000 + Math.min(Math.max(popularity, 0), 9_999);
}

/**
 * Everyone who shares at least `minShared` of `films` with the subject, most films first, then
 * best known, then lowest id. `films` are the films to look in (the subject's own); the subject
 * is never their own collaborator.
 */
export function rankCollaborators(
  subjectId: number,
  films: readonly FilmMembers[],
  notability: (id: number) => number,
  minShared: number = MIN_SHARED_FILMS,
): RankedCollaborator[] {
  const tally = new Map<number, { count: number; perGroup: Partial<Record<RoleGroup, number>> }>();
  for (const members of films) {
    for (const [id, groups] of members) {
      if (id === subjectId) continue;
      let entry = tally.get(id);
      if (!entry) {
        entry = { count: 0, perGroup: {} };
        tally.set(id, entry);
      }
      entry.count++;
      for (const group of groups) entry.perGroup[group] = (entry.perGroup[group] ?? 0) + 1;
    }
  }

  const ranked: RankedCollaborator[] = [];
  for (const [id, { count, perGroup }] of tally) {
    if (count >= minShared) ranked.push({ id, count, group: primaryGroup(perGroup), notability: notability(id) });
  }
  return ranked.sort((a, b) => b.count - a.count || b.notability - a.notability || a.id - b.id);
}

/** The subject's candidates: the best-ranked collaborators with a variety of roles, at most `limit`. */
export function pickCandidates(
  subjectId: number,
  films: readonly FilmMembers[],
  notability: (id: number) => number,
  limit: number = GRAPH_CANDIDATES,
): RankedCollaborator[] {
  return pickSuggestions(rankCollaborators(subjectId, films, notability), limit);
}

/**
 * One row per eligible person who has at least MIN_GRAPH_ROW candidates, from every film's
 * members. `films` are all crawled films; each person is looked up in the ones they are in.
 */
export function buildCollaboratorRows(
  films: readonly FilmMembers[],
  eligible: Iterable<number>,
  notability: (id: number) => number,
): CollaboratorRow[] {
  const filmsOf = new Map<number, FilmMembers[]>();
  for (const members of films) {
    for (const id of members.keys()) {
      const list = filmsOf.get(id);
      if (list) list.push(members);
      else filmsOf.set(id, [members]);
    }
  }

  const rows: CollaboratorRow[] = [];
  for (const id of eligible) {
    const own = filmsOf.get(id);
    if (!own || own.length < MIN_SHARED_FILMS) continue;
    const candidates = pickCandidates(id, own, notability);
    if (candidates.length < MIN_GRAPH_ROW) continue;
    rows.push([id, candidates.map((c) => c.id), candidates.map((c) => c.count)]);
  }
  return rows.sort((a, b) => a[0] - b[0]);
}
