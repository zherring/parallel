import { describe, expect, it } from "vitest";
import { filmsToCsv } from "@/lib/csv";
import { sharedFilms, sharedFilmsPairwise, upcomingSharedFilms } from "@/lib/shared";
import type { Credit, Film, PersonTimeline } from "@/lib/types";

const key = (role: Credit["role"], job: string): Credit => ({ role, job, minor: false });
const minorCredit = (role: Credit["role"], job: string): Credit => ({ role, job, minor: true });

function film(id: number, releaseDate: string, credits: Credit[]): Film {
  return {
    id,
    title: `Film ${id}`,
    releaseDate,
    year: Number(releaseDate.slice(0, 4)),
    posterPath: `/p${id}.jpg`,
    voteCount: 0,
    credits,
    minor: credits.every((c) => c.minor),
  };
}

const timeline = (id: number, films: Film[]): PersonTimeline => ({
  person: { id, name: `Person ${id}`, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

const director = key("director", "Director");
const dp = key("cinematographer", "Director of Photography");
const actor = key("actor", "Actor");

const fincher = timeline(1, [
  film(10, "1995-09-22", [director]),
  film(20, "1999-10-15", [director]),
  film(30, "2014-10-01", [director]),
]);
const cronenweth = timeline(2, [
  film(30, "2014-10-01", [dp]),
  film(20, "1999-10-15", [dp]),
  film(40, "2000-01-01", [dp]),
]);
const pitt = timeline(3, [
  film(10, "1995-09-22", [actor]),
  film(20, "1999-10-15", [actor]),
  film(50, "2005-06-10", [actor]),
]);

describe("sharedFilms", () => {
  it("returns [] for fewer than two people", () => {
    expect(sharedFilms([], { includeMinor: false })).toEqual([]);
    expect(sharedFilms([fincher], { includeMinor: false })).toEqual([]);
  });

  it("finds the films two people share, sorted by release date", () => {
    const films = sharedFilms([fincher, cronenweth], { includeMinor: false });
    expect(films.map((f) => f.id)).toEqual([20, 30]);
    expect(films[0]).toMatchObject({ title: "Film 20", year: 1999, releaseDate: "1999-10-15", posterPath: "/p20.jpg" });
    expect(films[0].byPerson).toEqual({ 1: [director], 2: [dp] });
  });

  it("requires all people for three-person lists", () => {
    const films = sharedFilms([fincher, cronenweth, pitt], { includeMinor: false });
    expect(films.map((f) => f.id)).toEqual([20]);
    expect(Object.keys(films[0].byPerson)).toEqual(["1", "2", "3"]);
  });

  it("ignores minor credits unless includeMinor", () => {
    const cameo = timeline(4, [
      film(10, "1995-09-22", [minorCredit("actor", "Actor")]),
      film(20, "1999-10-15", [actor, minorCredit("other", "Gaffer")]),
    ]);
    expect(sharedFilms([fincher, cameo], { includeMinor: false }).map((f) => f.id)).toEqual([20]);
    expect(sharedFilms([fincher, cameo], { includeMinor: true }).map((f) => f.id)).toEqual([10, 20]);
  });

  it("only lists a person's non-minor credits when minor ones are excluded", () => {
    const mixed = timeline(4, [film(20, "1999-10-15", [actor, minorCredit("other", "Gaffer")])]);
    const [shared] = sharedFilms([fincher, mixed], { includeMinor: false });
    expect(shared.byPerson[4]).toEqual([actor]);
    const [all] = sharedFilms([fincher, mixed], { includeMinor: true });
    expect(all.byPerson[4]).toHaveLength(2);
  });
});

describe("sharedFilmsPairwise", () => {
  it("returns [] for fewer than three people", () => {
    expect(sharedFilmsPairwise([fincher, cronenweth], { includeMinor: false })).toEqual([]);
  });

  it("returns each pair's shared films for three people", () => {
    const pairs = sharedFilmsPairwise([fincher, cronenweth, pitt], { includeMinor: false });
    expect(pairs.map((p) => [p.a, p.b, p.films.map((f) => f.id)])).toEqual([
      [1, 2, [20, 30]],
      [1, 3, [10, 20]],
      [2, 3, [20]],
    ]);
  });
});

describe("films that are not out yet", () => {
  const TODAY = "2026-06-01";
  const both = (id: number, releaseDate: string): [Film, Film] => [
    film(id, releaseDate, [director]),
    film(id, releaseDate, [actor]),
  ];
  const [released1, released2] = both(1, "2001-04-05");
  const [yesterday1, yesterday2] = both(2, "2026-05-31");
  const [today1, today2] = both(3, "2026-06-01");
  const [tomorrow1, tomorrow2] = both(4, "2026-06-02");
  const [announced1, announced2] = both(5, "2029-12-18");
  const [undated1, undated2] = both(6, "");
  const one = timeline(1, [released1, yesterday1, today1, tomorrow1, announced1, undated1]);
  const two = timeline(2, [released2, yesterday2, today2, tomorrow2, announced2, undated2]);

  it("counts released films, including one released today, and leaves out the rest", () => {
    const films = sharedFilms([one, two], { includeMinor: false, today: TODAY });
    expect(films.map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it("leaves out a film with no release date", () => {
    expect(sharedFilms([one, two], { includeMinor: false, today: TODAY }).map((f) => f.id)).not.toContain(6);
  });

  it("follows the date it is given: the same film counts from its release day on", () => {
    const ids = (today: string) => sharedFilms([one, two], { includeMinor: false, today }).map((f) => f.id);
    expect(ids("2026-06-01")).toEqual([1, 2, 3]);
    expect(ids("2026-06-02")).toEqual([1, 2, 3, 4]);
    expect(ids("2029-12-17")).toEqual([1, 2, 3, 4]);
    expect(ids("2029-12-18")).toEqual([1, 2, 3, 4, 5]);
    expect(ids("2000-01-01")).toEqual([]);
  });

  it("leaves them out with minor credits on as well", () => {
    expect(sharedFilms([one, two], { includeMinor: true, today: TODAY }).map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it("defaults to the real today", () => {
    const [far1, far2] = both(7, "2999-01-01");
    const [old1, old2] = both(8, "1999-01-01");
    const films = sharedFilms([timeline(1, [far1, old1]), timeline(2, [far2, old2])], { includeMinor: false });
    expect(films.map((f) => f.id)).toEqual([8]);
  });

  it("leaves an upcoming film in a person's own timeline: only the shared list changes", () => {
    expect(one.films.map((f) => f.id)).toContain(5);
  });

  it("keeps them out of every pair of a three-person list", () => {
    const [a1, a2] = both(9, "2030-01-01");
    const three = timeline(3, [film(1, "2001-04-05", [actor]), film(9, "2030-01-01", [actor]), film(2, "2026-05-31", [actor])]);
    const pairs = sharedFilmsPairwise(
      [timeline(1, [released1, a1, yesterday1]), timeline(2, [released2, a2, yesterday2]), three],
      { includeMinor: false, today: TODAY },
    );
    expect(pairs.map((p) => [p.a, p.b, p.films.map((f) => f.id)])).toEqual([
      [1, 2, [1, 2]],
      [1, 3, [1, 2]],
      [2, 3, [1, 2]],
    ]);
  });

  it("lists exactly what sharedFilms leaves out, for the empty state to mention", () => {
    const opts = { includeMinor: false, today: TODAY };
    const out = upcomingSharedFilms([one, two], opts).map((f) => f.id);
    expect(out).toEqual([6, 4, 5]); // the undated one sorts first
    const counted = sharedFilms([one, two], opts).map((f) => f.id);
    expect(counted.filter((id) => out.includes(id))).toEqual([]);
    expect(upcomingSharedFilms([one], opts)).toEqual([]);
  });

  it("is a pair with nothing in common when the only shared film is announced", () => {
    const [x1, x2] = both(10, "2031-12-19");
    expect(sharedFilms([timeline(1, [x1]), timeline(2, [x2])], { includeMinor: false, today: TODAY })).toEqual([]);
  });

  it("feeds the export: the CSV has no row for an announced film", () => {
    const csv = filmsToCsv(sharedFilms([one, two], { includeMinor: false, today: TODAY }));
    const [header, ...rows] = csv.trim().split("\r\n");
    expect(header.startsWith("Title,Year,")).toBe(true);
    expect(rows.map((row) => row.split(",").slice(0, 2).join(","))).toEqual(["Film 1,2001", "Film 2,2026", "Film 3,2026"]);
  });
});
