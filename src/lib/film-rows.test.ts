import { describe, expect, it } from "vitest";
import { filmsToCsv } from "@/lib/csv";
import { personRows, sharedRows } from "@/lib/film-rows";
import { DEFAULT_SORT, sortFilms, type MetricsById, type SortState } from "@/lib/films-table";
import { sharedFilms } from "@/lib/shared";
import type { Credit, Film, FilmMetrics, PersonTimeline } from "@/lib/types";

const TODAY = "2026-10-27";

const credit = (role: Credit["role"], job: string, minor = false): Credit => ({ role, job, minor });
const actor = credit("actor", "Actor");
const director = credit("director", "Director");
const writer = credit("writer", "Writer");
const cameo = credit("actor", "Actor", true);
const sound = credit("other", "Sound", true);

function film(id: number, title: string, releaseDate: string, credits: Credit[]): Film {
  return {
    id,
    title,
    releaseDate,
    year: Number(releaseDate.slice(0, 4)),
    posterPath: `/p${id}.jpg`,
    voteCount: 0,
    credits,
    minor: credits.every((c) => c.minor),
  };
}

const timeline = (id: number, name: string, films: Film[]): PersonTimeline => ({
  person: { id, name, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

const metrics = (extra: Partial<FilmMetrics> = {}): FilmMetrics => ({
  voteAverage: 7.5,
  voteCount: 5000,
  budget: 10_000_000,
  revenue: 50_000_000,
  releaseDate: "2000-01-01",
  awards: null,
  ...extra,
});

const toMap = (byId: Record<number, FilmMetrics | null>): MetricsById =>
  new Map(Object.entries(byId).map(([id, m]) => [Number(id), m] as const));

const ford = timeline(1, "Harrison Ford", [
  film(1, "Star Wars", "1977-05-25", [actor]),
  film(2, "Raiders of the Lost Ark", "1981-06-12", [actor, credit("producer", "Producer", true)]),
  film(3, "Blink and You Miss It", "1990-01-01", [cameo]),
  film(4, "Short Behind The Scenes", "1995-01-01", [sound]),
  film(5, "Next Indy", "2027-06-01", [actor]),
]);

describe("personRows", () => {
  it("lists a person's non-minor films, oldest first, upcoming films included", () => {
    const rows = personRows(ford, false);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 5]);
    expect(rows[2]).toMatchObject({ title: "Next Indy", year: 2027, releaseDate: "2027-06-01", posterPath: "/p5.jpg" });
  });

  it("adds the minor films, in timeline order, when the toggle is on", () => {
    expect(personRows(ford, true).map((row) => row.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("shows the person's roles on the film, without their name", () => {
    expect(personRows(ford, false)[0].credits).toEqual([{ personId: 1, name: null, roles: "Actor" }]);
  });

  it("summarises only the non-minor credits unless the toggle is on", () => {
    const multi = timeline(1, "Clint Eastwood", [film(9, "Unforgiven", "1992-08-07", [credit("director", "Director"), credit("actor", "Actor", true)])]);
    expect(personRows(multi, false)[0].credits[0].roles).toBe("Director");
    expect(personRows(multi, true)[0].credits[0].roles).toBe("Actor, Director");
  });

  it("lists each role once, in the usual order", () => {
    const both = timeline(1, "Someone", [film(9, "Both", "2000-01-01", [writer, director, actor, credit("actor", "Actor")])]);
    expect(personRows(both, false)[0].credits[0].roles).toBe("Actor, Director, Writer");
  });

  it("is empty for a person with no films, and when every film is minor and the toggle is off", () => {
    expect(personRows(timeline(2, "Nobody", []), true)).toEqual([]);
    const minorOnly = timeline(2, "Extra", [film(1, "Walk-on", "2001-01-01", [cameo])]);
    expect(personRows(minorOnly, false)).toEqual([]);
    expect(personRows(minorOnly, true)).toHaveLength(1);
  });

  it("does not change the timeline it reads", () => {
    const before = JSON.stringify(ford);
    personRows(ford, true);
    expect(JSON.stringify(ford)).toBe(before);
  });
});

describe("sharedRows", () => {
  const a = timeline(1, "David Fincher", [film(20, "Fight Club", "1999-10-15", [director])]);
  const b = timeline(2, "Jeff Cronenweth", [film(20, "Fight Club", "1999-10-15", [credit("cinematographer", "Director of Photography")])]);

  it("gives one named credit line per person, in lane order", () => {
    const rows = sharedRows(sharedFilms([a, b], { includeMinor: false, today: TODAY }), [
      { id: 1, name: "David Fincher" },
      { id: 2, name: "Jeff Cronenweth" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 20, title: "Fight Club", year: 1999 });
    expect(rows[0].credits).toEqual([
      { personId: 1, name: "David Fincher", roles: "Director" },
      { personId: 2, name: "Jeff Cronenweth", roles: "Cinematographer" },
    ]);
  });
});

describe("a solo list in the table", () => {
  const rows = personRows(ford, false);
  const sorted = (sort: SortState, byId: Record<number, FilmMetrics | null> = {}) =>
    sortFilms(rows, sort, toMap(byId), TODAY).map((row) => row.id);

  it("starts chronological, like the lane", () => {
    expect(sorted(DEFAULT_SORT)).toEqual([1, 2, 5]);
    expect(sorted({ key: "year", dir: "desc" })).toEqual([5, 2, 1]);
  });

  it("sorts an upcoming film last by box office, even if TMDB already holds a figure for it", () => {
    const byId = {
      1: metrics({ revenue: 775_000_000 }),
      2: metrics({ revenue: 390_000_000 }),
      5: metrics({ revenue: 999_000_000, releaseDate: "2027-06-01" }),
    };
    expect(sorted({ key: "box-office", dir: "desc" }, byId)).toEqual([1, 2, 5]);
    expect(sorted({ key: "box-office", dir: "asc" }, byId)).toEqual([2, 1, 5]);
  });

  it("sorts an upcoming film last by rating when it has none to show", () => {
    const byId = {
      1: metrics({ voteAverage: 8.2 }),
      2: metrics({ voteAverage: 7.9 }),
      5: metrics({ voteAverage: null, voteCount: 0, revenue: null, releaseDate: "2027-06-01" }),
    };
    expect(sorted({ key: "rating", dir: "desc" }, byId)).toEqual([1, 2, 5]);
    expect(sorted({ key: "rating", dir: "asc" }, byId)).toEqual([2, 1, 5]);
  });

  it("exports the listed films in the order of the table, as the same CSV", () => {
    const order = sortFilms(rows, { key: "film", dir: "asc" }, toMap({}), TODAY);
    const titles = filmsToCsv(order)
      .trim()
      .split("\r\n")
      .slice(1)
      .map((row) => row.split(",")[0]);
    expect(titles).toEqual(["Next Indy", "Raiders of the Lost Ark", "Star Wars"]);
  });
});
