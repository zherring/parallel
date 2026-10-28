import type { RoleKey } from "@/lib/types";

/**
 * The kinds of work a collaborator is grouped by, in the order they break ties: the director a
 * person works with is a more interesting suggestion than a fourth co-star, so Directing comes
 * first and Acting after the crew departments.
 */
export const ROLE_GROUPS = ["directing", "camera", "writing", "music", "editing", "acting", "other"] as const;

export type RoleGroup = (typeof ROLE_GROUPS)[number];

const GROUP_OF_ROLE: Record<RoleKey, RoleGroup> = {
  director: "directing",
  cinematographer: "camera",
  writer: "writing",
  composer: "music",
  editor: "editing",
  actor: "acting",
  producer: "other",
  "production-designer": "other",
  "costume-designer": "other",
  other: "other",
};

export function roleGroupOf(role: RoleKey): RoleGroup {
  return GROUP_OF_ROLE[role];
}

const groupRank = (group: RoleGroup) => ROLE_GROUPS.indexOf(group);

/**
 * The group someone mostly worked in, given how many films they were credited in per group: the
 * group with the most films, ties to the earlier group in ROLE_GROUPS. "other" (producers and
 * designers) only counts when it is all there is, so a director who also produced stays a
 * director.
 */
export function primaryGroup(filmsPerGroup: Partial<Record<RoleGroup, number>>): RoleGroup {
  let best: RoleGroup | null = null;
  for (const group of ROLE_GROUPS) {
    if (group === "other") continue;
    const films = filmsPerGroup[group] ?? 0;
    if (films > 0 && (best === null || films > (filmsPerGroup[best] ?? 0))) best = group;
  }
  return best ?? "other";
}

/** A candidate for `pickSuggestions`: how many films it shares and the kind of work it did. */
export interface Pickable {
  group: RoleGroup;
  count: number;
}

/** How many people of one role group are guaranteed a place before the rest are filled by count. */
export const GROUP_QUOTA = 2;

/**
 * Chooses up to `limit` suggestions from `candidates`, which must already be ranked best first
 * (by shared films, then notability).
 *
 * A star's best-ranked collaborators are often all co-stars, while the director, cinematographer
 * and composer they keep working with are the interesting ones. So first each role group gets
 * its best `quota` candidates (rank order within a group is kept; when the groups together are
 * more than `limit`, every group's best comes before any group's second), then the remaining
 * slots go to the best-ranked candidates left. The result is ordered by shared films, most first,
 * with ties by role group (ROLE_GROUPS order) and then by the original rank.
 */
export function pickSuggestions<T extends Pickable>(
  candidates: readonly T[],
  limit: number,
  quota: number = GROUP_QUOTA,
): T[] {
  if (limit <= 0 || candidates.length === 0) return [];

  const byGroup = new Map<RoleGroup, number[]>();
  candidates.forEach((candidate, index) => {
    const indices = byGroup.get(candidate.group);
    if (indices) indices.push(index);
    else byGroup.set(candidate.group, [index]);
  });

  const chosen = new Set<number>();
  for (let round = 0; round < quota && chosen.size < limit; round++) {
    const layer = [...byGroup.values()].flatMap((indices) => (round < indices.length ? [indices[round]] : []));
    for (const index of layer.sort((a, b) => a - b)) {
      if (chosen.size >= limit) break;
      chosen.add(index);
    }
  }
  for (let index = 0; index < candidates.length && chosen.size < limit; index++) chosen.add(index);

  return [...chosen]
    .sort(
      (a, b) =>
        candidates[b].count - candidates[a].count ||
        groupRank(candidates[a].group) - groupRank(candidates[b].group) ||
        a - b,
    )
    .map((index) => candidates[index]);
}
