import { describe, expect, it } from "vitest";
import { peopleDescription, peopleSocial, peopleTitle } from "@/lib/seo";
import { sharedFilms } from "@/lib/shared";
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

  it("names only released films when the list comes from sharedFilms", () => {
    const credit = { role: "director" as const, job: "Director", minor: false };
    const dated = (id: number, title: string, releaseDate: string): Film => ({
      ...film(id, Number(releaseDate.slice(0, 4))),
      title,
      releaseDate,
      credits: [credit],
    });
    const films = [dated(1, "Aliens", "1986-07-18"), dated(2, "Avatar 4", "2029-12-21")];
    const people = [timeline(1, "A", films), timeline(2, "B", films)];
    const description = peopleDescription(people, sharedFilms(people, { includeMinor: false, today: "2026-06-01" }));
    expect(description).toBe("Films made together by A & B: Aliens.");
    // And once the other one is out it is named too.
    const later = peopleDescription(people, sharedFilms(people, { includeMinor: false, today: "2029-12-21" }));
    expect(later).toBe("Films made together by A & B: Aliens, Avatar 4.");
  });

  it("says nothing is shared when the only shared film is announced", () => {
    const upcoming = { ...film(1, 2031), credits: [{ role: "actor" as const, job: "Actor", minor: false }] };
    const people = [timeline(1, "A", [upcoming]), timeline(2, "B", [upcoming])];
    expect(peopleDescription(people, sharedFilms(people, { includeMinor: false, today: "2026-06-01" }))).toBe(
      "No films made together by A & B found on TMDB.",
    );
  });

  it("summarizes a single person, ignoring minor films", () => {
    const solo = timeline(1, "A", [film(1, 1995), film(2, 2003, true), film(3, 2014)]);
    expect(peopleDescription([solo], [])).toBe("A: 2 films from 1995 to 2014 on a timeline.");
  });

  it("handles a single person with no films", () => {
    expect(peopleDescription([timeline(1, "A", [])], [])).toBe("A: filmography timeline.");
  });
});

describe("peopleSocial", () => {
  const social = peopleSocial("A & B: films made together", "Films made together by A & B: Film 1.", "/p/1-a+2-b");

  it("asks for the large image card, so the generated image is shown big", () => {
    expect(social.twitter).toMatchObject({ card: "summary_large_image", title: "A & B: films made together" });
  });

  it("describes the page for Open Graph", () => {
    expect(social.openGraph).toMatchObject({
      title: "A & B: films made together",
      description: "Films made together by A & B: Film 1.",
      url: "/p/1-a+2-b",
      type: "website",
      siteName: "Parallel",
    });
  });

  it("sets no image of its own, leaving og:image and twitter:image to the generated card", () => {
    expect(social.openGraph).not.toHaveProperty("images");
    expect(social.twitter).not.toHaveProperty("images");
  });
});
