import { describe, expect, it } from "vitest";
import { csvFilename, filmsToCsv } from "@/lib/csv";
import {
  DEFAULT_SORT,
  METRIC_SORT_KEYS,
  SORT_KEYS,
  ariaSort,
  defaultDirection,
  directionWords,
  isMetricSortKey,
  metricKeys,
  nextSort,
  parseSort,
  sortAnnouncement,
  sortFilms,
  sortParams,
  type MetricsById,
  type SortKey,
  type SortState,
} from "@/lib/films-table";
import type { FilmMetrics, SharedFilm } from "@/lib/types";

const TODAY = "2026-10-27";

const film = (id: number, title: string, releaseDate: string): SharedFilm => ({
  id,
  title,
  year: Number(releaseDate.slice(0, 4)),
  releaseDate,
  posterPath: null,
  byPerson: {},
});

const metrics = (extra: Partial<FilmMetrics> = {}): FilmMetrics => ({
  voteAverage: 7.5,
  voteCount: 5000,
  budget: 10_000_000,
  revenue: 50_000_000,
  releaseDate: "1990-01-01",
  awards: null,
  ...extra,
});

const ids = (films: SharedFilm[]) => films.map((f) => f.id);
const toMap = (byId: Record<number, FilmMetrics | null>): MetricsById =>
  new Map(Object.entries(byId).map(([id, m]) => [Number(id), m] as const));
const sorted = (films: SharedFilm[], sort: SortState, byId: Record<number, FilmMetrics | null> = {}) =>
  ids(sortFilms(films, sort, toMap(byId), TODAY));

// Chronological: 1 (1977) < 2 (1980) < 3 (1983) < 4 (1989).
const FILMS = [
  film(1, "Star Wars", "1977-05-25"),
  film(2, "The Empire Strikes Back", "1980-05-21"),
  film(3, "Return of the Jedi", "1983-05-25"),
  film(4, "Indiana Jones and the Last Crusade", "1989-05-24"),
];
// Shuffled, so a no-op sort cannot pass for a real one.
const SHUFFLED = [FILMS[2], FILMS[0], FILMS[3], FILMS[1]];

const asc = (key: SortKey): SortState => ({ key, dir: "asc" });
const desc = (key: SortKey): SortState => ({ key, dir: "desc" });

describe("direction rules", () => {
  it("starts titles and years ascending and the metrics descending (best first)", () => {
    expect(defaultDirection("film")).toBe("asc");
    expect(defaultDirection("year")).toBe("asc");
    expect(defaultDirection("rating")).toBe("desc");
    expect(defaultDirection("box-office")).toBe("desc");
    expect(defaultDirection("awards")).toBe("desc");
  });

  it("defaults to chronological", () => {
    expect(DEFAULT_SORT).toEqual({ key: "year", dir: "asc" });
  });

  it("knows which columns need the metrics", () => {
    expect(SORT_KEYS.filter(isMetricSortKey)).toEqual(METRIC_SORT_KEYS);
    expect(METRIC_SORT_KEYS).toEqual(["rating", "box-office", "awards"]);
  });

  it("starts another column at its default direction", () => {
    expect(nextSort(DEFAULT_SORT, "box-office")).toEqual({ key: "box-office", dir: "desc" });
    expect(nextSort(desc("rating"), "film")).toEqual({ key: "film", dir: "asc" });
    // Not the previous column's direction.
    expect(nextSort(asc("year"), "awards")).toEqual({ key: "awards", dir: "desc" });
    expect(nextSort(desc("awards"), "year")).toEqual({ key: "year", dir: "asc" });
  });

  it("flips the same column on every click", () => {
    let sort = nextSort(DEFAULT_SORT, "rating");
    expect(sort).toEqual(desc("rating"));
    sort = nextSort(sort, "rating");
    expect(sort).toEqual(asc("rating"));
    sort = nextSort(sort, "rating");
    expect(sort).toEqual(desc("rating"));
  });

  it("flips the default sort's column to newest first", () => {
    expect(nextSort(DEFAULT_SORT, "year")).toEqual(desc("year"));
  });

  it("reports aria-sort for the sorted column only", () => {
    expect(ariaSort(desc("rating"), "rating")).toBe("descending");
    expect(ariaSort(asc("rating"), "rating")).toBe("ascending");
    expect(ariaSort(desc("rating"), "year")).toBe("none");
  });
});

describe("announcements", () => {
  it.each([
    [desc("box-office"), "Sorted by box office, highest first"],
    [asc("box-office"), "Sorted by box office, lowest first"],
    [desc("rating"), "Sorted by rating, highest first"],
    [desc("awards"), "Sorted by awards, most first"],
    [asc("awards"), "Sorted by awards, fewest first"],
    [asc("year"), "Sorted by year, oldest first"],
    [desc("year"), "Sorted by year, newest first"],
    [asc("film"), "Sorted by film title, A to Z"],
    [desc("film"), "Sorted by film title, Z to A"],
  ])("words %j as %s", (sort, text) => {
    expect(sortAnnouncement(sort)).toBe(text);
  });

  it("words the direction alone for the mobile toggle", () => {
    expect(directionWords(desc("rating"))).toBe("highest first");
    expect(directionWords(asc("film"))).toBe("A to Z");
  });
});

describe("sort in the URL", () => {
  it("parses a column and a direction", () => {
    expect(parseSort("box-office", "desc")).toEqual(desc("box-office"));
    expect(parseSort("film", "desc")).toEqual(desc("film"));
    expect(parseSort("year", "asc")).toEqual(asc("year"));
  });

  it("uses the column's default direction when dir is missing or unknown", () => {
    expect(parseSort("rating", null)).toEqual(desc("rating"));
    expect(parseSort("rating", "sideways")).toEqual(desc("rating"));
    expect(parseSort("film", undefined)).toEqual(asc("film"));
  });

  it("ignores an unknown or missing column", () => {
    expect(parseSort(null, "desc")).toBeNull();
    expect(parseSort("", "desc")).toBeNull();
    expect(parseSort("director", "desc")).toBeNull();
    expect(parseSort("__proto__", "asc")).toBeNull();
  });

  it("writes no parameters for the default order and both for anything else", () => {
    expect(sortParams(DEFAULT_SORT)).toBeNull();
    expect(sortParams(desc("box-office"))).toEqual({ sort: "box-office", dir: "desc" });
    expect(sortParams(desc("year"))).toEqual({ sort: "year", dir: "desc" });
  });

  it("round-trips every sort", () => {
    for (const key of SORT_KEYS) {
      for (const dir of ["asc", "desc"] as const) {
        const params = sortParams({ key, dir });
        expect(params ? parseSort(params.sort, params.dir) : DEFAULT_SORT).toEqual({ key, dir });
      }
    }
  });
});

describe("metricKeys", () => {
  it("is all empty without metrics", () => {
    for (const none of [null, undefined]) {
      expect(metricKeys(none, TODAY)).toEqual({ rating: null, boxOffice: null, awards: null });
    }
  });

  it("uses the score as shown, to one decimal", () => {
    expect(metricKeys(metrics({ voteAverage: 7.84 }), TODAY).rating).toBe(7.8);
    expect(metricKeys(metrics({ voteAverage: 7.86 }), TODAY).rating).toBe(7.9);
  });

  it("treats a rating under the vote floor as none", () => {
    expect(metricKeys(metrics({ voteAverage: 9.5, voteCount: 9 }), TODAY).rating).toBeNull();
    expect(metricKeys(metrics({ voteAverage: 9.5, voteCount: 10 }), TODAY).rating).toBe(9.5);
    expect(metricKeys(metrics({ voteAverage: null }), TODAY).rating).toBeNull();
  });

  it("keeps a few-ratings score (10 to 99 votes): it is shown, so it sorts", () => {
    expect(metricKeys(metrics({ voteAverage: 6.1, voteCount: 40 }), TODAY).rating).toBe(6.1);
  });

  it("uses the gross, and none for a token release, an unreleased film or no revenue", () => {
    expect(metricKeys(metrics({ revenue: 775_398_007 }), TODAY).boxOffice).toBe(775_398_007);
    expect(metricKeys(metrics({ revenue: 400_000 }), TODAY).boxOffice).toBeNull();
    expect(metricKeys(metrics({ revenue: null }), TODAY).boxOffice).toBeNull();
    expect(metricKeys(metrics({ revenue: 90_000_000, releaseDate: "2027-06-01" }), TODAY).boxOffice).toBeNull();
    expect(metricKeys(metrics({ revenue: 90_000_000, releaseDate: "2026-10-27" }), TODAY).boxOffice).toBe(90_000_000);
  });

  it("orders awards by wins, nominations, festival prizes", () => {
    const prize = { festival: "Cannes", prize: "Palme d'Or" };
    expect(metricKeys(metrics({ awards: { oscarWins: 4, oscarNominations: 6, festivalPrizes: [prize] } }), TODAY).awards).toEqual([
      4, 6, 1,
    ]);
  });

  it("never lets nominations fall below wins, and counts distinct prizes", () => {
    const prize = { festival: "Cannes", prize: "Palme d'Or" };
    const keys = metricKeys(
      metrics({ awards: { oscarWins: 3, oscarNominations: 1, festivalPrizes: [prize, prize, { festival: "Venice", prize: "Golden Lion" }] } }),
      TODAY,
    );
    expect(keys.awards).toEqual([3, 3, 2]);
  });

  it("has no awards key when the cell would be empty", () => {
    expect(metricKeys(metrics({ awards: null }), TODAY).awards).toBeNull();
    expect(metricKeys(metrics({ awards: { oscarWins: 0, oscarNominations: 0, festivalPrizes: [] } }), TODAY).awards).toBeNull();
    // Nominations alone are something to show.
    expect(metricKeys(metrics({ awards: { oscarWins: 0, oscarNominations: 2, festivalPrizes: [] } }), TODAY).awards).toEqual([0, 2, 0]);
  });
});

describe("sortFilms: year and film", () => {
  it("sorts by release date, oldest first", () => {
    expect(sorted(SHUFFLED, asc("year"))).toEqual([1, 2, 3, 4]);
  });

  it("flips to newest first, exactly reversed", () => {
    expect(sorted(SHUFFLED, desc("year"))).toEqual([4, 3, 2, 1]);
  });

  it("orders films of one release date by id, reversed with the direction", () => {
    const same = [film(9, "B", "2000-01-01"), film(5, "A", "2000-01-01"), film(7, "C", "1999-01-01")];
    expect(sorted(same, asc("year"))).toEqual([7, 5, 9]);
    expect(sorted(same, desc("year"))).toEqual([9, 5, 7]);
  });

  it("sorts by title A to Z, ignoring case", () => {
    const films = [film(1, "zodiac", "2007-03-02"), film(2, "Alien", "1979-05-25"), film(3, "Blade Runner", "1982-06-25")];
    expect(sorted(films, asc("film"))).toEqual([2, 3, 1]);
    expect(sorted(films, desc("film"))).toEqual([1, 3, 2]);
  });

  it("sorts numbers inside titles as numbers", () => {
    const films = [film(1, "Part 10", "2010-01-01"), film(2, "Part 2", "2002-01-01")];
    expect(sorted(films, asc("film"))).toEqual([2, 1]);
  });

  it("breaks title ties chronologically, oldest first even when descending", () => {
    const films = [film(1, "Heat", "1995-12-15"), film(2, "heat", "1986-01-01"), film(3, "Aliens", "1986-07-18")];
    expect(sorted(films, asc("film"))).toEqual([3, 2, 1]);
    expect(sorted(films, desc("film"))).toEqual([2, 1, 3]);
  });

  it("does not need the metrics", () => {
    expect(sorted(SHUFFLED, asc("year"), { 1: metrics() })).toEqual([1, 2, 3, 4]);
  });
});

describe("sortFilms: rating", () => {
  const byId = { 1: metrics({ voteAverage: 8.2 }), 2: metrics({ voteAverage: 8.7 }), 3: metrics({ voteAverage: 7.9 }), 4: metrics({ voteAverage: 7.2 }) };

  it("puts the highest first when descending", () => {
    expect(sorted(SHUFFLED, desc("rating"), byId)).toEqual([2, 1, 3, 4]);
  });

  it("puts the lowest first when ascending", () => {
    expect(sorted(SHUFFLED, asc("rating"), byId)).toEqual([4, 3, 1, 2]);
  });

  it("sorts films under the vote floor as having no rating: last either way", () => {
    const withNoise = { ...byId, 4: metrics({ voteAverage: 9.9, voteCount: 3 }) };
    expect(sorted(SHUFFLED, desc("rating"), withNoise)).toEqual([2, 1, 3, 4]);
    expect(sorted(SHUFFLED, asc("rating"), withNoise)).toEqual([3, 1, 2, 4]);
  });

  it("breaks ties on the shown score by year, oldest first, in either direction", () => {
    const tied = { 1: metrics({ voteAverage: 7.81 }), 2: metrics({ voteAverage: 7.76 }), 3: metrics({ voteAverage: 7.8 }), 4: metrics({ voteAverage: 6 }) };
    expect(sorted(SHUFFLED, desc("rating"), tied)).toEqual([1, 2, 3, 4]);
    expect(sorted(SHUFFLED, asc("rating"), tied)).toEqual([4, 1, 2, 3]);
  });
});

describe("sortFilms: box office", () => {
  const byId = {
    1: metrics({ revenue: 775_000_000 }),
    2: metrics({ revenue: 538_000_000 }),
    3: metrics({ revenue: 475_000_000 }),
    4: metrics({ revenue: 474_000_000 }),
  };

  it("answers 'most successful' with the biggest gross first", () => {
    expect(sorted(SHUFFLED, desc("box-office"), byId)).toEqual([1, 2, 3, 4]);
    expect(sorted(SHUFFLED, asc("box-office"), byId)).toEqual([4, 3, 2, 1]);
  });

  it("sorts unreleased films and token releases last in both directions", () => {
    const films = [...FILMS, film(5, "Next Year", "2027-06-01"), film(6, "Streamer", "2019-11-01")];
    const data = {
      ...byId,
      5: metrics({ revenue: 999_000_000, releaseDate: "2027-06-01" }),
      6: metrics({ revenue: 12_000, releaseDate: "2019-11-01" }),
    };
    expect(sorted(films, desc("box-office"), data)).toEqual([1, 2, 3, 4, 6, 5]);
    expect(sorted(films, asc("box-office"), data)).toEqual([4, 3, 2, 1, 6, 5]);
  });

  it("keeps films with no data in chronological order among themselves", () => {
    const data = { 3: metrics({ revenue: 100_000_000 }) };
    expect(sorted(SHUFFLED, desc("box-office"), data)).toEqual([3, 1, 2, 4]);
    expect(sorted(SHUFFLED, asc("box-office"), data)).toEqual([3, 1, 2, 4]);
  });

  it("breaks equal grosses by year, oldest first", () => {
    const equal = { 1: metrics({ revenue: 5_000_000 }), 2: metrics({ revenue: 5_000_000 }), 3: metrics({ revenue: 5_000_000 }), 4: metrics({ revenue: 5_000_000 }) };
    expect(sorted(SHUFFLED, desc("box-office"), equal)).toEqual([1, 2, 3, 4]);
    expect(sorted(SHUFFLED, asc("box-office"), equal)).toEqual([1, 2, 3, 4]);
  });
});

describe("sortFilms: awards", () => {
  const prize = (festival: string) => ({ festival, prize: "Top prize" });
  const byId = {
    1: metrics({ awards: { oscarWins: 6, oscarNominations: 10, festivalPrizes: [] } }),
    2: metrics({ awards: { oscarWins: 3, oscarNominations: 9, festivalPrizes: [] } }),
    3: metrics({ awards: { oscarWins: 3, oscarNominations: 4, festivalPrizes: [prize("Cannes"), prize("Venice")] } }),
    4: metrics({ awards: { oscarWins: 0, oscarNominations: 0, festivalPrizes: [prize("Berlin")] } }),
  };

  it("orders by Oscar wins, then nominations, then festival prizes", () => {
    expect(sorted(SHUFFLED, desc("awards"), byId)).toEqual([1, 2, 3, 4]);
    expect(sorted(SHUFFLED, asc("awards"), byId)).toEqual([4, 3, 2, 1]);
  });

  it("falls back to festival prizes only when wins and nominations tie", () => {
    const data = {
      1: metrics({ awards: { oscarWins: 1, oscarNominations: 2, festivalPrizes: [prize("Cannes")] } }),
      2: metrics({ awards: { oscarWins: 1, oscarNominations: 2, festivalPrizes: [prize("Cannes"), prize("Venice")] } }),
    };
    expect(sorted([FILMS[0], FILMS[1]], desc("awards"), data)).toEqual([2, 1]);
  });

  it("ranks Oscar nominations alone above festival prizes alone", () => {
    const data = {
      1: metrics({ awards: { oscarWins: 0, oscarNominations: 1, festivalPrizes: [] } }),
      2: metrics({ awards: { oscarWins: 0, oscarNominations: 0, festivalPrizes: [prize("Cannes"), prize("Venice")] } }),
    };
    expect(sorted([FILMS[1], FILMS[0]], desc("awards"), data)).toEqual([1, 2]);
  });

  it("sorts films with no awards last in both directions", () => {
    const data = { ...byId, 1: metrics({ awards: null }), 2: metrics({ awards: { oscarWins: 0, oscarNominations: 0, festivalPrizes: [] } }) };
    expect(sorted(SHUFFLED, desc("awards"), data)).toEqual([3, 4, 1, 2]);
    expect(sorted(SHUFFLED, asc("awards"), data)).toEqual([4, 3, 1, 2]);
  });
});

describe("sortFilms: missing data and edge cases", () => {
  it.each(["rating", "box-office", "awards"] as const)("keeps chronological order when every film has no %s data", (key) => {
    const everyFilmFailed: Record<number, FilmMetrics | null> = { 1: null, 2: null, 3: null, 4: null };
    for (const byId of [{}, everyFilmFailed]) {
      expect(sorted(SHUFFLED, desc(key), byId)).toEqual([1, 2, 3, 4]);
      expect(sorted(SHUFFLED, asc(key), byId)).toEqual([1, 2, 3, 4]);
    }
  });

  it("treats a film missing from the map like a failed one", () => {
    const data = { 2: metrics({ revenue: 10_000_000 }), 3: null };
    expect(sorted(SHUFFLED, desc("box-office"), data)).toEqual([2, 1, 3, 4]);
  });

  it("handles no films and one film", () => {
    expect(sorted([], desc("rating"))).toEqual([]);
    expect(sorted([FILMS[0]], desc("awards"))).toEqual([1]);
  });

  it("returns a new array and leaves the input alone", () => {
    const input = [...SHUFFLED];
    const out = sortFilms(input, asc("year"), new Map(), TODAY);
    expect(out).not.toBe(input);
    expect(ids(input)).toEqual(ids(SHUFFLED));
  });

  it("is deterministic however the input was ordered", () => {
    const data = { 1: metrics({ revenue: 5 * 1e6 }), 2: metrics({ revenue: 5 * 1e6 }), 3: metrics({ revenue: 9 * 1e6 }) };
    const a = sorted([FILMS[0], FILMS[1], FILMS[2]], desc("box-office"), data);
    const b = sorted([FILMS[2], FILMS[1], FILMS[0]], desc("box-office"), data);
    expect(a).toEqual(b);
  });

  it("flipping direction twice gives the first order back", () => {
    const data = { 1: metrics({ voteAverage: 8 }), 2: metrics({ voteAverage: 9 }), 3: metrics({ voteAverage: 7 }) };
    const first = sorted(SHUFFLED, desc("rating"), data);
    expect(sorted(SHUFFLED, asc("rating"), data)).not.toEqual(first);
    expect(sorted(SHUFFLED, desc("rating"), data)).toEqual(first);
  });
});

describe("export order", () => {
  it("writes the CSV in the sorted order, one row per film", () => {
    const data = {
      1: metrics({ revenue: 475_000_000 }),
      2: metrics({ revenue: 538_000_000 }),
      3: metrics({ revenue: 775_000_000 }),
      4: null,
    };
    const order = sortFilms(FILMS, desc("box-office"), toMap(data), TODAY);

    const rows = filmsToCsv(order).trim().split("\r\n").slice(1);
    expect(rows.map((row) => row.split(",").slice(0, 2).join(","))).toEqual([
      "Return of the Jedi,1983",
      "The Empire Strikes Back,1980",
      "Star Wars,1977",
      "Indiana Jones and the Last Crusade,1989",
    ]);
  });

  it("follows the order of the table when it is newest first, with the same file name", () => {
    const newest = sortFilms(FILMS, desc("year"), new Map(), TODAY);

    expect(
      filmsToCsv(newest)
        .split("\r\n")
        .slice(1, 3)
        .map((row) => row.split(",").slice(0, 2).join(",")),
    ).toEqual(["Indiana Jones and the Last Crusade,1989", "Return of the Jedi,1983"]);
    expect(csvFilename(["Harrison Ford", "George Lucas"])).toBe("harrison-ford-george-lucas-shared-films.csv");
  });
});
