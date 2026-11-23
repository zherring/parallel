import { describe, expect, it } from "vitest";
import {
  CREW_GROUP_ORDER,
  countsForPeople,
  filmMetaLine,
  formatRuntime,
  groupFilmCredits,
  mergePeople,
  tmdbMovieUrl,
} from "@/lib/film-people";
import type { FilmPerson, RoleKey } from "@/lib/types";

const crew = (id: number, name: string, job: string, role: RoleKey, profilePath: string | null = null): FilmPerson => ({
  id,
  name,
  profilePath,
  job,
  role,
});
const cast = (id: number, name: string, character: string | undefined, order: number): FilmPerson => ({
  id,
  name,
  profilePath: null,
  job: "Actor",
  role: "actor",
  ...(character ? { character } : {}),
  order,
});

describe("mergePeople", () => {
  it("merges the same person into one row and joins distinct jobs", () => {
    const rows = mergePeople(
      [
        crew(1, "Jim Uhls", "Screenplay", "writer"),
        crew(2, "Chuck Palahniuk", "Novel", "writer"),
        crew(1, "Jim Uhls", "Writer", "writer"),
        crew(1, "Jim Uhls", "Screenplay", "writer"),
      ],
      (p) => p.job,
    );
    expect(rows).toEqual([
      { id: 1, name: "Jim Uhls", profilePath: null, detail: "Screenplay, Writer" },
      { id: 2, name: "Chuck Palahniuk", profilePath: null, detail: "Novel" },
    ]);
  });

  it("keeps first-appearance order and picks up a photo from a later credit", () => {
    const rows = mergePeople(
      [crew(2, "B", "Editor", "editor"), crew(1, "A", "Editor", "editor"), crew(2, "B", "Editor", "editor", "/b.jpg")],
      (p) => p.job,
    );
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
    expect(rows[0].profilePath).toBe("/b.jpg");
  });

  it("uses the given separator and skips empty details", () => {
    const rows = mergePeople(
      [cast(1, "Edward Norton", "The Narrator", 0), cast(1, "Edward Norton", undefined, 5), cast(1, "Edward Norton", "Rabbit", 9)],
      (p) => p.character ?? "",
      " / ",
    );
    expect(rows[0].detail).toBe("The Narrator / Rabbit");
  });
});

describe("groupFilmCredits", () => {
  const film = {
    crew: [
      crew(10, "Art Linson", "Producer", "producer"),
      crew(7467, "David Fincher", "Director", "director"),
      crew(20, "Jim Uhls", "Screenplay", "writer"),
      crew(20, "Jim Uhls", "Writer", "writer"),
      crew(7479, "Jeff Cronenweth", "Director of Photography", "cinematographer"),
      crew(30, "James Haygood", "Editor", "editor"),
      crew(31, "The Dust Brothers", "Original Music Composer", "composer"),
      crew(32, "Alex McDowell", "Production Design", "production-designer"),
      crew(33, "Michael Kaplan", "Costume Design", "costume-designer"),
      crew(35, "A Title Studio", "Main Title Designer", "title-designer"),
      crew(34, "Laray Mayfield", "Casting", "other"),
      crew(7467, "David Fincher", "Executive Producer", "other"),
    ],
    cast: [
      cast(287, "Brad Pitt", "Tyler Durden", 1),
      cast(819, "Edward Norton", "The Narrator", 0),
      cast(287, "Brad Pitt", "Tyler (voice)", 20),
    ],
  };

  it("orders crew groups director to other, skipping empty ones", () => {
    const { crew: groups } = groupFilmCredits(film, []);
    expect(groups.map((g) => g.label)).toEqual([
      "Directors",
      "Writers",
      "Cinematography",
      "Editing",
      "Music",
      "Production design",
      "Costume design",
      "Title design",
      "Producers",
      "Other crew",
    ]);
    expect(groups.map((g) => g.role)).toEqual(CREW_GROUP_ORDER);

    const sparse = groupFilmCredits({ crew: [film.crew[1], film.crew[5]], cast: [] }, []);
    expect(sparse.crew.map((g) => g.label)).toEqual(["Directors", "Editing"]);
  });

  it("merges a person with several jobs in the same group and keeps others separate", () => {
    const { crew: groups } = groupFilmCredits(film, []);
    const writers = groups.find((g) => g.role === "writer")!;
    expect(writers.people).toEqual([
      { id: 20, name: "Jim Uhls", profilePath: null, detail: "Screenplay, Writer" },
    ]);
    const other = groups.find((g) => g.role === "other")!;
    expect(other.people.map((p) => `${p.name}: ${p.detail}`)).toEqual([
      "Laray Mayfield: Casting",
      "David Fincher: Executive Producer",
    ]);
  });

  it("returns cast by billing with one row per person", () => {
    const { cast: rows } = groupFilmCredits(film, []);
    expect(rows.map((r) => r.name)).toEqual(["Brad Pitt", "Edward Norton"]);
    expect(rows[0].detail).toBe("Tyler Durden / Tyler (voice)");
  });

  it("builds the in-timeline group in timeline order, merging cast and crew credits", () => {
    const { inTimeline } = groupFilmCredits(film, [{ id: 287 }, { id: 7467 }, { id: 999 }, { id: 287 }]);
    expect(inTimeline.map((p) => p.name)).toEqual(["Brad Pitt", "David Fincher"]);
    expect(inTimeline[0].detail).toBe("Actor as Tyler Durden, Actor as Tyler (voice)");
    expect(inTimeline[1].detail).toBe("Director, Executive Producer");
  });

  it("is empty for people who did not work on the film and for an empty timeline", () => {
    expect(groupFilmCredits(film, []).inTimeline).toEqual([]);
    expect(groupFilmCredits(film, [{ id: 999 }]).inTimeline).toEqual([]);
  });

  it("labels an actor without a character plainly", () => {
    const { inTimeline } = groupFilmCredits({ crew: [], cast: [cast(5, "Extra", undefined, 3)] }, [{ id: 5 }]);
    expect(inTimeline[0].detail).toBe("Actor");
  });
});

describe("formatRuntime", () => {
  it("formats hours and minutes", () => {
    expect(formatRuntime(139)).toBe("2h 19m");
    expect(formatRuntime(120)).toBe("2h");
    expect(formatRuntime(45)).toBe("45m");
    expect(formatRuntime(61)).toBe("1h 1m");
  });

  it("returns null for missing runtimes", () => {
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
    expect(formatRuntime(undefined)).toBeNull();
    expect(formatRuntime(-5)).toBeNull();
  });
});

describe("filmMetaLine", () => {
  it("joins year, runtime and genres", () => {
    expect(filmMetaLine({ year: 1999, runtime: 139, genres: ["Drama", "Thriller"] })).toBe(
      "1999 · 2h 19m · Drama, Thriller",
    );
  });

  it("skips whatever is missing", () => {
    expect(filmMetaLine({ year: null, runtime: 90, genres: [] })).toBe("1h 30m");
    expect(filmMetaLine({ year: 2001, runtime: null, genres: ["Comedy"] })).toBe("2001 · Comedy");
    expect(filmMetaLine({ year: null, runtime: null, genres: [] })).toBe("");
  });
});

describe("tmdbMovieUrl", () => {
  it("links to the TMDB movie page", () => {
    expect(tmdbMovieUrl(550)).toBe("https://www.themoviedb.org/movie/550");
  });
});

describe("countsForPeople", () => {
  const TODAY = "2026-11-22";
  const film = (overrides: Partial<Parameters<typeof countsForPeople>[0]> = {}): Parameters<typeof countsForPeople>[0] => ({
    releaseDate: "1995-06-30",
    runtime: 140,
    genres: ["Drama"],
    cast: [cast(1, "Kevin Bacon", "Jack Swigert", 2), cast(2, "Tom Hanks", "Jim Lovell", 0)],
    crew: [crew(3, "Ron Howard", "Director", "director")],
    ...overrides,
  });

  it("counts a released film in which every one of them has a credit that is not minor", () => {
    expect(countsForPeople(film(), [1, 2], TODAY)).toBe(true);
    // A crew credit counts as well as a cast one.
    expect(countsForPeople(film(), [1, 3], TODAY)).toBe(true);
    expect(countsForPeople(film(), [1], TODAY)).toBe(true);
  });

  it("does not count one of them who is not credited on it, or the film when it is not out yet", () => {
    expect(countsForPeople(film(), [1, 999], TODAY)).toBe(false);
    expect(countsForPeople(film({ releaseDate: "2026-12-18" }), [1, 2], TODAY)).toBe(false);
    expect(countsForPeople(film({ releaseDate: "2026-11-22" }), [1, 2], TODAY)).toBe(true);
    expect(countsForPeople(film({ releaseDate: null }), [1, 2], TODAY)).toBe(false);
  });

  it("does not count a cast credit that is minor: billed from the 16th, or a walk-on, archive or self part", () => {
    expect(countsForPeople(film({ cast: [cast(1, "Kevin Bacon", "Jack", 1), cast(2, "Late Billed", "Guest", 15)] }), [1, 2], TODAY)).toBe(false);
    expect(countsForPeople(film({ cast: [cast(1, "Kevin Bacon", "Jack", 1), cast(2, "Late Billed", "Guest", 14)] }), [1, 2], TODAY)).toBe(true);
    expect(countsForPeople(film({ cast: [cast(1, "Kevin Bacon", "Jack", 1), cast(2, "Cameo", "Himself", 3)] }), [1, 2], TODAY)).toBe(false);
    expect(countsForPeople(film({ cast: [cast(1, "Kevin Bacon", "Jack", 1), cast(2, "Cameo", "Mover (uncredited)", 3)] }), [1, 2], TODAY)).toBe(false);
  });

  it("does not count a crew credit that is not a key role, nor a cast one on a documentary with no character", () => {
    expect(countsForPeople(film({ crew: [crew(3, "Caterer", "Catering", "other")] }), [1, 3], TODAY)).toBe(false);
    // One minor credit is enough to hold them out only when they have no other: a director who also has a walk-on counts.
    expect(
      countsForPeople(film({ cast: [cast(1, "Kevin Bacon", "Jack", 1), cast(3, "Ron Howard", "Himself", 40)], crew: [crew(3, "Ron Howard", "Director", "director")] }), [1, 3], TODAY),
    ).toBe(true);
    const documentary = film({ genres: ["Documentary"], cast: [cast(1, "Kevin Bacon", undefined, 0), cast(2, "Tom Hanks", "Narrator", 1)] });
    expect(countsForPeople(documentary, [2], TODAY)).toBe(true);
    expect(countsForPeople(documentary, [1, 2], TODAY)).toBe(false);
  });

  it("does not count anything on a short film", () => {
    expect(countsForPeople(film({ runtime: 39 }), [1, 2], TODAY)).toBe(false);
    expect(countsForPeople(film({ runtime: 40 }), [1, 2], TODAY)).toBe(true);
    // An unknown runtime is not a short.
    expect(countsForPeople(film({ runtime: null }), [1, 2], TODAY)).toBe(true);
  });
});
