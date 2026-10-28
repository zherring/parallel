import { describe, expect, it } from "vitest";
import {
  GRAPH_CANDIDATES,
  MIN_GRAPH_ROW,
  buildCollaboratorRows,
  membersFromCredits,
  notabilityScore,
  pickCandidates,
  rankCollaborators,
  type FilmMembers,
} from "@/lib/collaborator-graph";
import type { RoleGroup } from "@/lib/role-groups";

/** A film from `[personId, group]` pairs; a person may hold several groups. */
const film = (...members: [number, RoleGroup][]): FilmMembers => {
  const map = new Map<number, Set<RoleGroup>>();
  for (const [id, group] of members) map.set(id, (map.get(id) ?? new Set()).add(group));
  return map;
};

const none = () => 0;

describe("membersFromCredits", () => {
  it("counts the top 12 billed cast and skips everyone below", () => {
    const cast = Array.from({ length: 15 }, (_, i) => ({ id: 100 + i, order: i, character: "Someone" }));
    const members = membersFromCredits({ cast });
    expect([...members.keys()]).toEqual(Array.from({ length: 12 }, (_, i) => 100 + i));
    expect([...members.get(100)!]).toEqual(["acting"]);
  });

  it("skips uncredited and self appearances", () => {
    const members = membersFromCredits({
      cast: [
        { id: 1, order: 0, character: "Han Solo" },
        { id: 2, order: 1, character: "Himself" },
        { id: 3, order: 2, character: "Waiter (uncredited)" },
        { id: 4, order: 3 },
      ],
    });
    expect([...members.keys()]).toEqual([1, 4]);
  });

  it("maps crew jobs to groups the way the pair page does and ignores the rest", () => {
    const members = membersFromCredits({
      crew: [
        { id: 10, job: "Director" },
        { id: 11, job: "Screenplay" },
        { id: 12, job: "Story" },
        { id: 13, job: "Director of Photography" },
        { id: 14, job: "Original Music Composer" },
        { id: 15, job: "Editor" },
        { id: 16, job: "Producer" },
        { id: 17, job: "Production Design" },
        { id: 18, job: "Executive Producer" },
        { id: 19, job: "Gaffer" },
        { id: 20 },
      ],
    });
    expect([...members].map(([id, groups]) => [id, [...groups][0]])).toEqual([
      [10, "directing"],
      [11, "writing"],
      [12, "writing"],
      [13, "camera"],
      [14, "music"],
      [15, "editing"],
      [16, "other"],
      [17, "other"],
    ]);
  });

  it("gives someone who acts and directs on one film both groups", () => {
    const members = membersFromCredits({
      cast: [{ id: 7, order: 0, character: "Lead" }],
      crew: [{ id: 7, job: "Director" }],
    });
    expect([...members.get(7)!].sort()).toEqual(["acting", "directing"]);
  });

  it("treats missing credits as an empty film", () => {
    expect(membersFromCredits(null).size).toBe(0);
    expect(membersFromCredits({}).size).toBe(0);
  });
});

describe("rankCollaborators", () => {
  const films = [
    film([1, "acting"], [2, "directing"], [3, "acting"]),
    film([1, "acting"], [2, "directing"], [4, "music"]),
    film([1, "acting"], [3, "acting"], [5, "acting"]),
  ];

  it("counts the films each person shares with the subject, most first", () => {
    expect(rankCollaborators(1, films, none).map(({ id, count }) => [id, count])).toEqual([
      [2, 2],
      [3, 2],
    ]);
  });

  it("drops people below the threshold and never lists the subject", () => {
    const ids = rankCollaborators(1, films, none).map((r) => r.id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(4);
    expect(ids).not.toContain(5);
    expect(rankCollaborators(1, films, none, 1).map((r) => r.id)).toEqual([2, 3, 4, 5]);
  });

  it("breaks equal counts by notability, then by id", () => {
    const notability = (id: number) => (id === 3 ? 50 : 10);
    expect(rankCollaborators(1, films, notability).map((r) => r.id)).toEqual([3, 2]);
    expect(rankCollaborators(1, films, none).map((r) => r.id)).toEqual([2, 3]);
  });

  it("reports the group a collaborator mostly worked in", () => {
    const mixed = [
      film([1, "acting"], [2, "writing"], [2, "other"]),
      film([1, "acting"], [2, "writing"]),
      film([1, "acting"], [2, "other"]),
    ];
    expect(rankCollaborators(1, mixed, none)[0]).toMatchObject({ id: 2, count: 3, group: "writing" });
  });
});

describe("pickCandidates", () => {
  it("keeps a director and a composer in a list of co-stars", () => {
    // Person 1 shares 3 films with eighteen actors, and 2 films each with a director and a composer.
    const costars = Array.from({ length: 18 }, (_, i) => [100 + i, "acting"] as [number, RoleGroup]);
    const films = [
      film([1, "acting"], ...costars, [900, "directing"], [901, "music"]),
      film([1, "acting"], ...costars, [900, "directing"], [901, "music"]),
      film([1, "acting"], ...costars),
    ];
    const ids = pickCandidates(1, films, none).map((r) => r.id);
    expect(ids).toHaveLength(GRAPH_CANDIDATES);
    expect(ids).toContain(900);
    expect(ids).toContain(901);
  });
});

describe("buildCollaboratorRows", () => {
  const films = [
    film([1, "acting"], [2, "directing"], [3, "acting"], [4, "music"]),
    film([1, "acting"], [2, "directing"], [3, "acting"], [4, "music"]),
    film([1, "acting"], [2, "directing"], [3, "acting"], [4, "music"]),
    film([2, "directing"], [5, "acting"]),
    film([6, "acting"], [7, "acting"]),
  ];

  it("writes parallel id and count arrays for each person with enough collaborators", () => {
    const rows = buildCollaboratorRows(films, [1, 2, 3, 4, 5, 6, 7], none);
    // Equal counts: the director first, then the composer, then the co-stars (see pickSuggestions).
    expect(rows).toEqual([
      [1, [2, 4, 3], [3, 3, 3]],
      [2, [4, 1, 3], [3, 3, 3]],
      [3, [2, 4, 1], [3, 3, 3]],
      [4, [2, 1, 3], [3, 3, 3]],
    ]);
  });

  it("only gives rows to the eligible people, sorted by id", () => {
    const rows = buildCollaboratorRows(films, [4, 1], none);
    expect(rows.map((r) => r[0])).toEqual([1, 4]);
  });

  it("leaves out a person with fewer than the minimum number of candidates", () => {
    const thin = [film([1, "acting"], [2, "acting"]), film([1, "acting"], [2, "acting"])];
    expect(MIN_GRAPH_ROW).toBe(3);
    expect(buildCollaboratorRows(thin, [1, 2], none)).toEqual([]);
  });

  it("never stores a collaborator with fewer than two shared films", () => {
    const rows = buildCollaboratorRows(films, [1, 2, 3, 4, 5, 6, 7], none);
    for (const [, , counts] of rows) for (const count of counts) expect(count).toBeGreaterThanOrEqual(2);
  });
});

describe("notabilityScore", () => {
  it("lets credits dominate and popularity break ties", () => {
    expect(notabilityScore(3, 9)).toBeGreaterThan(notabilityScore(2, 9_000));
    expect(notabilityScore(3, 9)).toBeGreaterThan(notabilityScore(3, 2));
    expect(notabilityScore(0, -5)).toBe(0);
  });
});
