import { describe, expect, it } from "vitest";
import { peopleDescription, peopleTitle } from "@/lib/seo";
import type { Film, PersonTimeline, SharedFilm } from "@/lib/types";

const film = (id: number, year: number, minor = false): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${year}-01-01`,
  year,
  posterPath: null,
  voteCount: 0,
  credits: [],
  minor,
});

const timeline = (id: number, name: string, films: Film[]): PersonTimeline => ({
  person: { id, name, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

const shared = (n: number): SharedFilm[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    title: `Film ${i + 1}`,
    year: 2000 + i,
    releaseDate: `${2000 + i}-01-01`,
    posterPath: null,
    byPerson: {},
  }));

describe("peopleTitle", () => {
  it("titles a single person and a group", () => {
    expect(peopleTitle(["David Fincher"])).toBe("David Fincher: filmography timeline");
    expect(peopleTitle(["David Fincher", "Jeff Cronenweth"])).toBe(
      "David Fincher & Jeff Cronenweth: films made together",
    );
  });
});

describe("peopleDescription", () => {
  const pair = [timeline(1, "A", []), timeline(2, "B", [])];

  it("lists shared titles", () => {
    expect(peopleDescription(pair, shared(2))).toBe("Films made together by A & B: Film 1, Film 2.");
  });

  it("caps the list at six titles", () => {
    expect(peopleDescription(pair, shared(8))).toBe(
      "Films made together by A & B: Film 1, Film 2, Film 3, Film 4, Film 5, Film 6 and 2 more.",
    );
  });

  it("says so when nothing is shared", () => {
    expect(peopleDescription(pair, [])).toBe("No films made together by A & B found on TMDB.");
  });

  it("summarizes a single person, ignoring minor films", () => {
    const solo = timeline(1, "A", [film(1, 1995), film(2, 2003, true), film(3, 2014)]);
    expect(peopleDescription([solo], [])).toBe("A: 2 films from 1995 to 2014 on a timeline.");
  });

  it("handles a single person with no films", () => {
    expect(peopleDescription([timeline(1, "A", [])], [])).toBe("A: filmography timeline.");
  });
});
