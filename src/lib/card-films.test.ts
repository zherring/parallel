import { describe, expect, it } from "vitest";
import { cardFilms, careerFilms } from "@/lib/card-films";
import type { Film, PersonTimeline } from "@/lib/types";

const TODAY = "2026-10-27";

const film = (id: number, year: number, over: Partial<Film> = {}): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${year}-06-01`,
  year,
  posterPath: `/poster-${id}.jpg`,
  voteCount: 100,
  credits: [{ role: "director", job: "Director", minor: false }],
  minor: false,
  ...over,
});

const timeline = (id: number, films: Film[]): PersonTimeline => ({
  person: { id, name: `Person ${id}`, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

const minor = { minor: true, credits: [{ role: "other" as const, job: "Thanks", minor: true }] };

describe("cardFilms", () => {
  it("gives the films everyone made, with the most votes anyone's entry has", () => {
    const a = timeline(1, [film(1, 2000, { voteCount: 10 }), film(2, 2003)]);
    const b = timeline(2, [film(1, 2000, { voteCount: 90 }), film(3, 2005)]);
    const { films, source } = cardFilms([a, b], TODAY);
    expect(source).toBe("shared");
    expect(films.map((f) => [f.id, f.voteCount])).toEqual([[1, 90]]);
  });

  it("leaves out shared films that are minor for someone, and those not out yet", () => {
    const a = timeline(1, [film(1, 2000), film(2, 2001, minor), film(3, 2030, { releaseDate: "2030-01-01" })]);
    const b = timeline(2, [film(1, 2000), film(2, 2001, minor), film(3, 2030, { releaseDate: "2030-01-01" })]);
    expect(cardFilms([a, b], TODAY).films.map((f) => f.id)).toEqual([1]);
  });

  it("gives a person's own career, without minor films and announced ones", () => {
    const solo = timeline(1, [film(1, 1990), film(2, 1995, minor), film(3, 2030, { releaseDate: "2030-01-01" }), film(4, 2000)]);
    const { films, source } = cardFilms([solo], TODAY);
    expect(source).toBe("career");
    expect(films.map((f) => f.id)).toEqual([1, 4]);
  });

  it("falls back to everyone's careers when they share nothing, each film once", () => {
    const a = timeline(1, [film(1, 1990), film(2, 2000)]);
    const b = timeline(2, [film(3, 1995)]);
    const { films, source } = cardFilms([a, b], TODAY);
    expect(source).toBe("career");
    expect(films.map((f) => f.id).sort()).toEqual([1, 2, 3]);
  });

  it("keeps minor films only when a career has nothing else, and announced ones only when it has nothing out", () => {
    expect(cardFilms([timeline(1, [film(1, 1990, minor)])], TODAY).films.map((f) => f.id)).toEqual([1]);
    const soon = film(1, 2030, { releaseDate: "2030-01-01" });
    expect(cardFilms([timeline(1, [soon])], TODAY).films.map((f) => f.id)).toEqual([1]);
  });

  it("has no films for nobody with any", () => {
    expect(cardFilms([timeline(1, [])], TODAY)).toEqual({ films: [], source: "career" });
  });
});

describe("careerFilms", () => {
  it("is every released, non-minor film of everyone, once each, with the most votes anyone's entry has", () => {
    const a = timeline(1, [film(1, 2000, { voteCount: 10 }), film(2, 2003), film(3, 2001, minor), film(4, 2030, { releaseDate: "2030-01-01" })]);
    const b = timeline(2, [film(1, 2000, { voteCount: 90 }), film(5, 2005)]);
    const films = careerFilms([a, b], TODAY);
    expect(films.map((f) => f.id).sort()).toEqual([1, 2, 5]);
    expect(films.find((f) => f.id === 1)?.voteCount).toBe(90);
  });
});
