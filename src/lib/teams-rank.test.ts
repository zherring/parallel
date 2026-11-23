import { describe, expect, it } from "vitest";
import type { FilmMembers } from "@/lib/collaborator-graph";
import { MIN_TEAM_FILMS, pickTeams, rankTeams } from "@/lib/teams-rank";

const film = (...ids: number[]): FilmMembers => new Map(ids.map((id) => [id, new Set(["acting" as const])]));
const SUBJECT = 1;

describe("rankTeams", () => {
  it("counts the films two people share with the subject, and drops pairs with fewer than three", () => {
    expect(MIN_TEAM_FILMS).toBe(3);
    const films = [film(1, 10, 11, 12), film(1, 10, 11), film(1, 10, 11, 13), film(1, 10, 11), film(1, 12, 13), film(1, 12, 13), film(1, 12, 13, 14), film(1, 14, 15), film(1, 14, 15)];
    const ranked = rankTeams(SUBJECT, films, () => 0);
    expect(ranked.map((team) => [team.ids, team.count])).toEqual([
      [[10, 11], 4],
      [[12, 13], 3],
    ]);
    // Two films together, however often the pair is billed with others, is not a team: the pair at the end shares two.
    expect(ranked.some((team) => team.ids[0] === 14 && team.ids[1] === 15)).toBe(false);
  });

  it("takes the threshold from the caller when it is given one", () => {
    const films = [film(1, 10, 11), film(1, 10, 11)];
    expect(rankTeams(SUBJECT, films, () => 0)).toEqual([]);
    expect(rankTeams(SUBJECT, films, () => 0, 2).map((team) => team.ids)).toEqual([[10, 11]]);
  });

  it("never puts the subject in a team, and names each pair once, lower id first", () => {
    const ranked = rankTeams(SUBJECT, [film(11, 1, 10), film(10, 11, 1), film(1, 10, 11)], () => 0);
    expect(ranked.map((team) => team.ids)).toEqual([[10, 11]]);
  });

  it("breaks ties by how well known the two are, then by id", () => {
    const films = [10, 20, 30].flatMap((first) => [film(1, first, first + 1), film(1, first, first + 1), film(1, first, first + 1)]);
    const notability = (id: number) => (id >= 30 ? 5 : id >= 20 ? 9 : 5);
    expect(rankTeams(SUBJECT, films, notability).map((team) => team.ids)).toEqual([[20, 21], [10, 11], [30, 31]]);
  });
});

describe("pickTeams", () => {
  const teams = [[10, 11], [10, 12], [11, 12], [20, 21], [10, 20]].map((ids) => ({ ids: ids as [number, number] }));

  it("lets nobody be in more teams than allowed, keeping the best", () => {
    expect(pickTeams(teams, 10, 1).map((team) => team.ids)).toEqual([[10, 11], [20, 21]]);
    expect(pickTeams(teams, 10, 2).map((team) => team.ids)).toEqual([[10, 11], [10, 12], [11, 12], [20, 21]]);
  });

  it("stops at the limit", () => {
    expect(pickTeams(teams, 1, 2)).toHaveLength(1);
  });
});
