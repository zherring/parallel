import type { FilmMembers } from "@/lib/collaborator-graph";

/**
 * Teams: pairs of people who are credited together on the films of a third (the subject). Pure, like the collaborator
 * graph it is counted from (`collaborator-graph.ts`: who counts on a film is the same top-billed cast and key crew).
 */

/** Two people have to share at least this many of the subject's films to be a team. */
export const MIN_TEAM_FILMS = 2;

export interface RankedTeam {
  /** The two people, lower id first. */
  ids: readonly [number, number];
  /** The subject's films both are credited on. */
  count: number;
  /** Higher is better known (the two people's together); breaks ties between equal counts. */
  notability: number;
}

/**
 * Every pair of people credited together on at least `minShared` of `films` (the subject's own), most films first, then
 * best known, then lowest ids. The subject is in no team.
 */
export function rankTeams(
  subjectId: number,
  films: readonly FilmMembers[],
  notability: (id: number) => number,
  minShared: number = MIN_TEAM_FILMS,
): RankedTeam[] {
  const tally = new Map<string, { ids: readonly [number, number]; count: number }>();
  for (const members of films) {
    const ids = [...members.keys()].filter((id) => id !== subjectId).sort((a, b) => a - b);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${ids[i]}+${ids[j]}`;
        const entry = tally.get(key);
        if (entry) entry.count++;
        else tally.set(key, { ids: [ids[i], ids[j]], count: 1 });
      }
    }
  }
  const ranked: RankedTeam[] = [];
  for (const { ids, count } of tally.values()) {
    if (count >= minShared) ranked.push({ ids, count, notability: notability(ids[0]) + notability(ids[1]) });
  }
  return ranked.sort((a, b) => b.count - a.count || b.notability - a.notability || a.ids[0] - b.ids[0] || a.ids[1] - b.ids[1]);
}

/**
 * The first `limit` of `ranked` (best first) in which nobody is in more than `perPerson` teams: three people who always
 * work together are three pairs with the same films, and a list of them is one team said three times.
 */
export function pickTeams<T extends { ids: readonly [number, number] }>(ranked: readonly T[], limit: number, perPerson: number): T[] {
  const uses = new Map<number, number>();
  const picked: T[] = [];
  for (const team of ranked) {
    if (picked.length >= limit) break;
    if (team.ids.some((id) => (uses.get(id) ?? 0) >= perPerson)) continue;
    for (const id of team.ids) uses.set(id, (uses.get(id) ?? 0) + 1);
    picked.push(team);
  }
  return picked;
}
