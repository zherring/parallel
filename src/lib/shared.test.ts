import { describe, expect, it } from "vitest";
import { sharedFilms, sharedFilmsPairwise } from "@/lib/shared";
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
    credits,
    minor: credits.every((c) => c.minor),
  };
}

const timeline = (id: number, films: Film[]): PersonTimeline => ({
  person: { id, name: `Person ${id}`, profilePath: null, knownFor: null, birthday: null, deathday: null },
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
