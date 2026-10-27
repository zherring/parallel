import { describe, expect, it } from "vitest";
import { normalizeFilmDetails, normalizeMovieCredits, normalizePerson } from "@/lib/normalize";
import type { RawMovieCredits, RawMovieDetails } from "@/lib/tmdb-types";

const movie = (id: number, title: string, release_date: string | undefined) => ({
  id,
  title,
  release_date,
  poster_path: `/p${id}.jpg`,
});

describe("normalizePerson", () => {
  it("maps fields and nulls empty strings", () => {
    expect(
      normalizePerson({
        id: 7467,
        name: "David Fincher",
        profile_path: "/f.jpg",
        known_for_department: "Directing",
        birthday: "1962-08-28",
        deathday: "",
      }),
    ).toEqual({
      id: 7467,
      name: "David Fincher",
      profilePath: "/f.jpg",
      knownFor: "Directing",
      birthday: "1962-08-28",
      deathday: null,
    });
  });
});

describe("normalizeMovieCredits", () => {
  const raw: RawMovieCredits = {
    cast: [
      { ...movie(3, "Late Film", "2014-10-01"), character: "Bartender", order: 20 },
      { ...movie(2, "Making Of", "2003-12-02"), character: "Self (archive footage)", order: 26 },
      { ...movie(1, "Early Film", "1995-09-22"), character: "Lead", order: 0 },
      { ...movie(9, "No Date", ""), character: "Lead", order: 0 },
    ],
    crew: [
      { ...movie(1, "Early Film", "1995-09-22"), job: "Director" },
      { ...movie(1, "Early Film", "1995-09-22"), job: "Director" },
      { ...movie(1, "Early Film", "1995-09-22"), job: "Executive Producer" },
      { ...movie(3, "Late Film", "2014-10-01"), job: "Gaffer" },
      { ...movie(9, "No Date", undefined), job: "Director" },
    ],
  };
  const films = normalizeMovieCredits(raw);

  it("drops entries without a release date and sorts ascending", () => {
    expect(films.map((f) => f.id)).toEqual([1, 2, 3]);
    expect(films.map((f) => f.year)).toEqual([1995, 2003, 2014]);
  });

  it("merges cast and crew into one film with deduped credits", () => {
    const early = films[0];
    expect(early.credits.map((c) => `${c.role}:${c.job}`)).toEqual([
      "actor:Actor",
      "director:Director",
      "other:Executive Producer",
    ]);
    expect(early.credits[0]).toMatchObject({ character: "Lead", order: 0, minor: false });
    expect(early.posterPath).toBe("/p1.jpg");
    expect(early.releaseDate).toBe("1995-09-22");
  });

  it("flags a film minor only when every credit is minor", () => {
    expect(films[0].minor).toBe(false);
    expect(films[1].minor).toBe(true);
    expect(films[2].credits).toHaveLength(2);
    expect(films[2].minor).toBe(true);
  });

  it("keeps one credit per character for the same job", () => {
    const [film] = normalizeMovieCredits({
      cast: [
        { ...movie(5, "Dual", "2000-01-01"), character: "Twin A", order: 0 },
        { ...movie(5, "Dual", "2000-01-01"), character: "Twin B", order: 1 },
      ],
      crew: [],
    });
    expect(film.credits.map((c) => c.character)).toEqual(["Twin A", "Twin B"]);
  });

  it("carries TMDB's vote count, defaulting to 0", () => {
    const [popular, unknown] = normalizeMovieCredits({
      cast: [],
      crew: [
        { ...movie(1, "Popular", "2000-01-01"), vote_count: 33145, job: "Director" },
        { ...movie(2, "Unknown", "2001-01-01"), job: "Director" },
      ],
    });
    expect(popular.voteCount).toBe(33145);
    expect(unknown.voteCount).toBe(0);
  });
});

describe("normalizeMovieCredits with short movies", () => {
  const raw: RawMovieCredits = {
    cast: [
      { ...movie(10, "A Short Role", "2009-05-16"), character: "Lead", order: 0 },
      { ...movie(11, "Feature", "2010-01-01"), character: "Lead", order: 0 },
    ],
    crew: [
      { ...movie(10, "A Short Role", "2009-05-16"), job: "Director" },
      { ...movie(12, "Featurette", "2011-01-01"), job: "Director" },
      { ...movie(13, "Feature Two", "2012-01-01"), job: "Director" },
    ],
  };

  it("marks every credit on a short movie minor, whatever the role", () => {
    const films = normalizeMovieCredits(raw, new Set([10, 12]));
    const byId = new Map(films.map((f) => [f.id, f]));

    expect(byId.get(10)?.credits.map((c) => [c.job, c.minor])).toEqual([
      ["Actor", true],
      ["Director", true],
    ]);
    expect(byId.get(10)?.minor).toBe(true);
    expect(byId.get(12)?.credits.every((c) => c.minor)).toBe(true);
    expect(byId.get(12)?.minor).toBe(true);
  });

  it("leaves movies outside the set untouched", () => {
    const films = normalizeMovieCredits(raw, new Set([10, 12]));
    const byId = new Map(films.map((f) => [f.id, f]));

    expect(byId.get(11)?.minor).toBe(false);
    expect(byId.get(13)?.minor).toBe(false);
    expect(byId.get(13)?.credits[0]).toMatchObject({ job: "Director", minor: false });
  });

  it("changes nothing without a set, or with an empty one", () => {
    expect(normalizeMovieCredits(raw, new Set())).toEqual(normalizeMovieCredits(raw));
    expect(normalizeMovieCredits(raw).every((f) => !f.minor)).toBe(true);
  });

  it("ignores ids that are not in the credits", () => {
    expect(normalizeMovieCredits(raw, new Set([999]))).toEqual(normalizeMovieCredits(raw));
  });
});

describe("normalizeMovieCredits with TMDB's video flag", () => {
  const credits = (extra: { video?: boolean; vote_count?: number }): RawMovieCredits => ({
    cast: [],
    crew: [{ ...movie(1, "Madonna: The Video Collection", "1999-11-02"), ...extra, job: "Director" }],
  });

  it("treats an obscure video-flagged movie as short even without a runtime", () => {
    const [film] = normalizeMovieCredits(credits({ video: true, vote_count: 9 }));
    expect(film.minor).toBe(true);
  });

  it("keeps a well-known video-flagged release (Grindhouse) as a regular film", () => {
    const [film] = normalizeMovieCredits(credits({ video: true, vote_count: 1972 }));
    expect(film.minor).toBe(false);
  });

  it("ignores movies that are not flagged", () => {
    expect(normalizeMovieCredits(credits({ video: false, vote_count: 9 }))[0].minor).toBe(false);
    expect(normalizeMovieCredits(credits({}))[0].minor).toBe(false);
  });
});

describe("normalizeMovieCredits with documentary appearances", () => {
  const cast = (character: string | undefined, genre_ids: number[] | undefined) =>
    normalizeMovieCredits({
      cast: [{ ...movie(1, "On Location", "2012-03-20"), character, order: 1, genre_ids }],
      crew: [],
    })[0];

  it("treats a cast credit without a character on a documentary as appearing as oneself", () => {
    expect(cast("", [99]).minor).toBe(true);
    expect(cast(undefined, [18, 99]).minor).toBe(true);
  });

  it("keeps a documentary credit that names a character", () => {
    expect(cast("Narrator", [99]).minor).toBe(false);
  });

  it("keeps blank-character cast credits on other kinds of movie", () => {
    expect(cast("", [18]).minor).toBe(false);
    expect(cast("", undefined).minor).toBe(false);
  });

  it("does not touch crew credits on a documentary", () => {
    const [film] = normalizeMovieCredits({
      cast: [],
      crew: [{ ...movie(2, "A Documentary", "2012-03-20"), genre_ids: [99], job: "Director" }],
    });
    expect(film.minor).toBe(false);
  });
});

describe("normalizeFilmDetails", () => {
  const person = (id: number) => ({ id, name: `P${id}`, profile_path: null });
  const raw: RawMovieDetails = {
    id: 550,
    title: "Fight Club",
    release_date: "1999-10-15",
    poster_path: "/poster.jpg",
    backdrop_path: "/back.jpg",
    runtime: 139,
    tagline: "",
    overview: "A ticking-time-bomb insomniac...",
    genres: [{ name: "Drama" }, { name: "Thriller" }],
    credits: {
      cast: [
        ...Array.from({ length: 40 }, (_, i) => ({ ...person(100 + i), character: `C${i}`, order: 39 - i })),
      ],
      crew: [
        { ...person(1), job: "Gaffer" },
        { ...person(2), job: "Editor" },
        { ...person(3), job: "Director" },
        { ...person(3), job: "Director" },
        { ...person(4), job: "Executive Producer" },
        { ...person(5), job: "Screenplay" },
        { ...person(6), job: "Producer" },
      ],
    },
  };
  const details = normalizeFilmDetails(raw);

  it("maps core fields", () => {
    expect(details).toMatchObject({
      id: 550,
      title: "Fight Club",
      year: 1999,
      releaseDate: "1999-10-15",
      posterPath: "/poster.jpg",
      backdropPath: "/back.jpg",
      runtime: 139,
      tagline: null,
      genres: ["Drama", "Thriller"],
    });
  });

  it("returns the top 30 cast by billing order", () => {
    expect(details.cast).toHaveLength(30);
    expect(details.cast.map((c) => c.order)).toEqual(Array.from({ length: 30 }, (_, i) => i));
    expect(details.cast[0]).toMatchObject({ role: "actor", job: "Actor", character: "C39" });
  });

  it("lists key roles first in role order, drops minor departments and duplicates", () => {
    expect(details.crew.map((c) => `${c.role}:${c.job}`)).toEqual([
      "director:Director",
      "writer:Screenplay",
      "editor:Editor",
      "producer:Producer",
      "other:Executive Producer",
    ]);
  });

  it("handles a movie with no date or credits", () => {
    expect(
      normalizeFilmDetails({ id: 1, title: "T", release_date: "", poster_path: null, backdrop_path: null }),
    ).toMatchObject({ year: null, releaseDate: null, cast: [], crew: [], genres: [], runtime: null });
  });
});
