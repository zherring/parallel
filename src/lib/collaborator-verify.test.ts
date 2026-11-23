import { describe, expect, it } from "vitest";
import {
  MAX_SUGGESTIONS,
  filmsCreditedAs,
  suggestFromTimelines,
  toSuggestion,
  verifyCollaborator,
} from "@/lib/collaborator-verify";
import { sharedFilms } from "@/lib/shared";
import type { Credit, Film, PersonTimeline, RoleKey } from "@/lib/types";

const TODAY = "2026-06-01";

const credit = (role: RoleKey, extra: Partial<Credit> = {}): Credit => ({
  role,
  job: role === "actor" ? "Actor" : role,
  minor: false,
  ...extra,
});

const film = (id: number, releaseDate: string, credits: Credit[], voteCount = 0): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate,
  year: Number(releaseDate.slice(0, 4)),
  posterPath: null,
  voteCount,
  credits,
  minor: credits.every((c) => c.minor),
});

const timeline = (id: number, name: string, films: Film[]): PersonTimeline => ({
  person: { id, name, profilePath: `/${id}.jpg`, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

/** Films 1..n, all released, each credited to `role` for the person. */
const filmsAs = (role: RoleKey, ids: number[], extra: Partial<Credit> = {}) =>
  ids.map((id) => film(id, `20${String(id).padStart(2, "0")}-01-01`, [credit(role, extra)], id));

const SUBJECT = timeline(1, "Subject", filmsAs("actor", [1, 2, 3, 4, 5, 6]));

describe("verifyCollaborator", () => {
  it("counts exactly the films the pair page counts", () => {
    const other = timeline(2, "Director", filmsAs("director", [2, 3, 4, 90]));
    const verified = verifyCollaborator(SUBJECT, other, 0, { today: TODAY });
    const pair = sharedFilms([SUBJECT, other], { includeMinor: false, today: TODAY });
    expect(verified?.count).toBe(pair.length);
    expect(verified?.films.map((f) => f.id)).toEqual(pair.map((f) => f.id));
    expect(verified?.count).toBe(3);
  });

  it("does not count a film that is not out yet", () => {
    const upcoming = film(50, "2999-01-01", [credit("director")]);
    const subject = timeline(1, "Subject", [...filmsAs("actor", [1, 2]), film(50, "2999-01-01", [credit("actor")])]);
    const other = timeline(2, "Director", [...filmsAs("director", [1, 2]), upcoming]);
    expect(verifyCollaborator(subject, other, 0, { today: TODAY })?.count).toBe(2);
  });

  it("does not count minor credits", () => {
    const other = timeline(2, "Cameo", filmsAs("actor", [1, 2, 3], { minor: true }));
    expect(verifyCollaborator(SUBJECT, other, 0, { today: TODAY })).toBeNull();
  });

  it("drops a candidate with fewer than two shared films", () => {
    const other = timeline(2, "Once", filmsAs("director", [1]));
    expect(verifyCollaborator(SUBJECT, other, 0, { today: TODAY })).toBeNull();
    expect(verifyCollaborator(SUBJECT, other, 0, { today: TODAY, minShared: 1 })?.count).toBe(1);
  });

  it("groups a collaborator by the work they mostly did", () => {
    const other = timeline(2, "Both", [
      film(1, "2001-01-01", [credit("actor")]),
      film(2, "2002-01-01", [credit("director")]),
      film(3, "2003-01-01", [credit("director"), credit("actor")]),
    ]);
    expect(verifyCollaborator(SUBJECT, other, 0, { today: TODAY })?.group).toBe("directing");
  });
});

describe("verifyCollaborator with roles (Kevin Bacon mode's list: actors and directors)", () => {
  const ROLES: readonly RoleKey[] = ["actor", "director"];

  it("keeps an actor and a director, and drops a composer or a costume designer who share as many films", () => {
    for (const role of ["actor", "director"] as const) {
      expect(verifyCollaborator(SUBJECT, timeline(2, role, filmsAs(role, [1, 2, 3])), 0, { today: TODAY, roles: ROLES })?.count, role).toBe(3);
    }
    for (const role of ["composer", "costume-designer", "cinematographer", "writer", "editor", "producer"] as const) {
      expect(verifyCollaborator(SUBJECT, timeline(2, role, filmsAs(role, [1, 2, 3])), 0, { today: TODAY, roles: ROLES }), role).toBeNull();
      // Every kind of work, without roles: the list everybody else has.
      expect(verifyCollaborator(SUBJECT, timeline(2, role, filmsAs(role, [1, 2, 3])), 0, { today: TODAY })?.count, role).toBe(3);
    }
  });

  it("needs the actor's or director's credit on as many films as the list asks for, not one: a composer who acted once is not who the list is about", () => {
    const composerWhoActedOnce = timeline(2, "Composer", [
      film(1, "2001-01-01", [credit("composer"), credit("actor")]),
      film(2, "2002-01-01", [credit("composer")]),
      film(3, "2003-01-01", [credit("composer")]),
    ]);
    expect(verifyCollaborator(SUBJECT, composerWhoActedOnce, 0, { today: TODAY, roles: ROLES })).toBeNull();
    // A director who also wrote and produced is a director on every one of them.
    const writerDirector = timeline(3, "Writer-director", filmsAs("director", [1, 2]).map((f) => ({ ...f, credits: [...f.credits, credit("writer")] })));
    expect(verifyCollaborator(SUBJECT, writerDirector, 0, { today: TODAY, roles: ROLES })?.count).toBe(2);
  });

  it("does not count a minor credit as the work: a cameo is not acting with him", () => {
    const cameos = timeline(2, "Cameos", [
      film(1, "2001-01-01", [credit("composer"), credit("actor", { minor: true })]),
      film(2, "2002-01-01", [credit("composer"), credit("actor", { minor: true })]),
    ]);
    expect(verifyCollaborator(SUBJECT, cameos, 0, { today: TODAY, roles: ROLES })).toBeNull();
  });

  it("keeps the count the pair page's own: all the shared films, whatever the person did on them", () => {
    const mixed = timeline(2, "Actor and composer", [
      film(1, "2001-01-01", [credit("actor")]),
      film(2, "2002-01-01", [credit("actor")]),
      film(3, "2003-01-01", [credit("composer")]),
    ]);
    expect(verifyCollaborator(SUBJECT, mixed, 0, { today: TODAY, roles: ROLES })?.count).toBe(3);
  });

  it("filters the list: suggestFromTimelines leaves the crew out and keeps the others' places", () => {
    const people = [
      timeline(10, "Composer", filmsAs("composer", [1, 2, 3, 4])),
      timeline(11, "Costar", filmsAs("actor", [1, 2, 3])),
      timeline(12, "Cinematographer", filmsAs("cinematographer", [1, 2, 3])),
      timeline(13, "Director", filmsAs("director", [1, 2])),
    ];
    expect(suggestFromTimelines(SUBJECT, people, { today: TODAY }).map((s) => s.id)).toEqual([10, 12, 11, 13]);
    expect(suggestFromTimelines(SUBJECT, people, { today: TODAY, roles: ROLES }).map((s) => s.id)).toEqual([11, 13]);
  });

  it("counts a person's films in the roles", () => {
    const films = sharedFilms([SUBJECT, timeline(2, "Mixed", [film(1, "2001-01-01", [credit("actor")]), film(2, "2002-01-01", [credit("composer")])])], { includeMinor: false, today: TODAY });
    expect(filmsCreditedAs(films, 2, ["actor", "director"])).toBe(1);
    expect(filmsCreditedAs(films, 2, ["composer"])).toBe(1);
    expect(filmsCreditedAs(films, 99, ["actor"])).toBe(0);
  });
});

describe("toSuggestion", () => {
  it("lists the roles on the shared films and the three best-voted titles", () => {
    const other = timeline(2, "Steven Spielberg", [
      film(1, "2001-01-01", [credit("director"), credit("writer")]),
      film(2, "2002-01-01", [credit("director")]),
      film(3, "2003-01-01", [credit("director")]),
      film(4, "2004-01-01", [credit("director")]),
    ]);
    const verified = verifyCollaborator(SUBJECT, other, 0, { today: TODAY })!;
    // SUBJECT's votes are the film ids, so 4, 3 and 2 are the best voted.
    expect(toSuggestion(verified, SUBJECT)).toEqual({
      id: 2,
      name: "Steven Spielberg",
      profilePath: "/2.jpg",
      sharedCount: 4,
      roles: "Director, Writer",
      titles: ["Film 4", "Film 3", "Film 2"],
    });
  });
});

describe("suggestFromTimelines", () => {
  const costar = (id: number, films: number[]) => timeline(id, `Costar ${id}`, filmsAs("actor", films));

  it("ranks by the exact count, not by the candidates' order", () => {
    // The candidate list says 10 first, but 11 really shares more films.
    const list = suggestFromTimelines(SUBJECT, [costar(10, [1, 2]), costar(11, [1, 2, 3, 4])], { today: TODAY });
    expect(list.map((s) => s.id)).toEqual([11, 10]);
    expect(list.map((s) => s.sharedCount)).toEqual([4, 2]);
  });

  it("keeps the candidates' order between equal counts", () => {
    const list = suggestFromTimelines(SUBJECT, [costar(12, [1, 2]), costar(10, [3, 4]), costar(11, [5, 6])], {
      today: TODAY,
    });
    expect(list.map((s) => s.id)).toEqual([12, 10, 11]);
  });

  it("applies the count threshold and never suggests the person themselves", () => {
    const list = suggestFromTimelines(SUBJECT, [costar(10, [1]), SUBJECT, costar(11, [1, 2])], { today: TODAY });
    expect(list.map((s) => s.id)).toEqual([11]);
  });

  it("makes room for a director and a composer among many co-stars", () => {
    const costars = [20, 21, 22, 23, 24, 25].map((id) => costar(id, [1, 2, 3, 4, 5]));
    const director = timeline(30, "Director", filmsAs("director", [1, 2]));
    const composer = timeline(31, "Composer", filmsAs("composer", [3, 4]));
    const list = suggestFromTimelines(SUBJECT, [...costars, director, composer], { today: TODAY, limit: 5 });
    expect(list).toHaveLength(5);
    expect(list.map((s) => s.id)).toContain(30);
    expect(list.map((s) => s.id)).toContain(31);
    expect(list.filter((s) => s.roles === "Actor")).toHaveLength(3);
  });

  it("returns at most ten and nothing for no candidates", () => {
    const many = Array.from({ length: 14 }, (_, i) => costar(100 + i, [1, 2]));
    expect(suggestFromTimelines(SUBJECT, many, { today: TODAY })).toHaveLength(MAX_SUGGESTIONS);
    expect(suggestFromTimelines(SUBJECT, [], { today: TODAY })).toEqual([]);
  });
});
