import { describe, expect, it } from "vitest";
import {
  BEST_ORIGINAL_SONG,
  SONG_LINK_OVERRIDES,
  awardsQuery,
  festivalPrizesWon,
  parseAwardRows,
  summarizeFilm,
  summarizeFilms,
  tallyOscarCategories,
  type AwardRow,
} from "@/lib/awards-wikidata";

const PICTURE = "Q102427";
const DIRECTOR = "Q103360";
const ACTOR = "Q103916";
const SUPPORTING_ACTOR = "Q106291";
const ORIGINAL_SCORE = "Q22235329";
const PALME = "Q179808";
const GOLDEN_LION = "Q209459";
const GOLDEN_BEAR = "Q154590";
const HONORARY = "Q727328";
const SPECIAL_ACHIEVEMENT = "Q2032630";

const row = (cat: string, won: boolean, kind: AwardRow["kind"] = "film", who?: string, year?: number): AwardRow => ({
  tmdb: "1",
  cat,
  won,
  kind,
  who,
  year,
});

describe("tallyOscarCategories", () => {
  it("counts a category once however many statements say so, and a win as a nomination too", () => {
    const rows = [
      row(PICTURE, true),
      row(PICTURE, false), // the same category listed as both won and nominated
      row(PICTURE, true, "person", "P1"), // a producer's own statement
      row(PICTURE, false, "person", "P1"),
      row(DIRECTOR, false),
      row(DIRECTOR, false, "person", "P2"),
    ];
    expect(tallyOscarCategories(rows)).toEqual([
      { cat: PICTURE, nominations: 1, wins: 1 },
      { cat: DIRECTOR, nominations: 1, wins: 0 },
    ]);
  });

  it("counts each acting nominee, as the Academy does (three Supporting Actor nominees)", () => {
    const rows = [
      row(SUPPORTING_ACTOR, false), // the film's own statement does not add a nominee
      row(SUPPORTING_ACTOR, false, "person", "caan"),
      row(SUPPORTING_ACTOR, false, "person", "duvall"),
      row(SUPPORTING_ACTOR, false, "person", "pacino"),
    ];
    expect(tallyOscarCategories(rows)).toEqual([{ cat: SUPPORTING_ACTOR, nominations: 3, wins: 0 }]);
  });

  it("counts the winner among several acting nominees once", () => {
    const rows = [
      row(SUPPORTING_ACTOR, true, "person", "deniro"),
      row(SUPPORTING_ACTOR, false, "person", "deniro"), // a winner is often also listed as nominated
      row(SUPPORTING_ACTOR, false, "person", "strasberg"),
      row(SUPPORTING_ACTOR, false, "person", "gazzo"),
    ];
    expect(tallyOscarCategories(rows)).toEqual([{ cat: SUPPORTING_ACTOR, nominations: 3, wins: 1 }]);
  });

  it("keeps a single category with only the film's statement at one nomination", () => {
    expect(tallyOscarCategories([row(ACTOR, true)])).toEqual([{ cat: ACTOR, nominations: 1, wins: 1 }]);
  });

  it("does not multiply other categories by their nominees", () => {
    const rows = [row(DIRECTOR, true, "person", "wise"), row(DIRECTOR, true, "person", "robbins")];
    expect(tallyOscarCategories(rows)).toEqual([{ cat: DIRECTOR, nominations: 1, wins: 1 }]);
  });

  it("counts each song of Best Original Song, and a song once however it is recorded", () => {
    const rows = [
      row(BEST_ORIGINAL_SONG, true, "song", "Qunder", 1990),
      row(BEST_ORIGINAL_SONG, false, "song", "Qunder", 1990),
      row(BEST_ORIGINAL_SONG, false, "song", "Qkiss", 1990),
      row(BEST_ORIGINAL_SONG, false, "person", "ashman"), // the person-for-film statement adds no song
    ];
    expect(tallyOscarCategories(rows, 1989)).toEqual([{ cat: BEST_ORIGINAL_SONG, nominations: 2, wins: 1 }]);
  });

  it("still counts one song nomination when only the person's statement names the film", () => {
    expect(tallyOscarCategories([row(BEST_ORIGINAL_SONG, false, "person", "newman")])).toEqual([
      { cat: BEST_ORIGINAL_SONG, nominations: 1, wins: 0 },
    ]);
  });

  it("ignores songs whose ceremony is not within two years after the film (remake soundtracks)", () => {
    const rows = [
      row(BEST_ORIGINAL_SONG, true, "song", "Qwish", 1941), // "When You Wish Upon a Star" on Pinocchio (2022)
      row(BEST_ORIGINAL_SONG, false, "song", "Qtoolate", 2025),
      row(BEST_ORIGINAL_SONG, false, "song", "Qsame", 2022),
      row(BEST_ORIGINAL_SONG, false, "song", "Qnext", 2023),
      row(BEST_ORIGINAL_SONG, false, "song", "Qlate", 2024),
      row(BEST_ORIGINAL_SONG, false, "song", "Qnoyear"), // no ceremony year recorded: kept
    ];
    // 2022, 2023 and 2024 are within two years of a 2022 film; 1941 and 2025 are not.
    expect(tallyOscarCategories(rows, 2022)).toEqual([{ cat: BEST_ORIGINAL_SONG, nominations: 4, wins: 0 }]);
    expect(tallyOscarCategories([row(BEST_ORIGINAL_SONG, true, "song", "Qwish", 1941)], 2022)).toEqual([]);
    // Without a release year nothing can be ruled out.
    expect(tallyOscarCategories([row(BEST_ORIGINAL_SONG, true, "song", "Qwish", 1941)])).toHaveLength(1);
  });

  it("leaves out honorary and Special Achievement awards, which are not competitive", () => {
    const rows = [row(HONORARY, true), row(SPECIAL_ACHIEVEMENT, true), row(PICTURE, false)];
    expect(tallyOscarCategories(rows)).toEqual([{ cat: PICTURE, nominations: 1, wins: 0 }]);
  });

  it("leaves festival prizes out of the Oscar tally", () => {
    expect(tallyOscarCategories([row(PALME, true), row(GOLDEN_LION, true)])).toEqual([]);
  });
});

describe("festivalPrizesWon", () => {
  it("lists won top prizes in the order Cannes, Venice, Berlin, once each", () => {
    const rows = [row(GOLDEN_BEAR, true), row(PALME, true), row(PALME, true), row(GOLDEN_LION, true)];
    expect(festivalPrizesWon(rows)).toEqual([
      { festival: "Cannes", prize: "Palme d'Or" },
      { festival: "Venice", prize: "Golden Lion" },
      { festival: "Berlin", prize: "Golden Bear" },
    ]);
  });

  it("ignores nominations and statements on a person (Lady Vengeance did not win the Golden Lion)", () => {
    const rows = [row(GOLDEN_LION, false), row(PALME, true, "person", "someone"), row(GOLDEN_BEAR, false, "person", "x")];
    expect(festivalPrizesWon(rows)).toEqual([]);
  });
});

describe("summarizeFilm / summarizeFilms", () => {
  it("adds the categories up into wins, nominations and prizes", () => {
    const rows = [row(PICTURE, true), row(DIRECTOR, false), row(ORIGINAL_SCORE, true), row(PALME, true)];
    expect(summarizeFilm(rows)).toEqual({
      oscarWins: 2,
      oscarNominations: 3,
      festivalPrizes: [{ festival: "Cannes", prize: "Palme d'Or" }],
    });
  });

  it("keeps films with an Oscar record or a prize, and drops the others", () => {
    const rows: AwardRow[] = [
      { ...row(PICTURE, false), tmdb: "10" },
      { ...row(PALME, true), tmdb: "20" },
      { ...row(HONORARY, true), tmdb: "30" }, // nothing competitive
      { ...row(PALME, false), tmdb: "40" }, // only nominated for a festival prize
    ];
    const films = summarizeFilms(rows);
    expect([...films.keys()]).toEqual([10, 20]);
    expect(films.get(20)).toEqual({
      oscarWins: 0,
      oscarNominations: 0,
      festivalPrizes: [{ festival: "Cannes", prize: "Palme d'Or" }],
    });
  });

  it("gives each film its own release year when ruling out songs", () => {
    const rows: AwardRow[] = [
      { ...row(BEST_ORIGINAL_SONG, true, "song", "Qwish", 1941), tmdb: "1940" },
      { ...row(BEST_ORIGINAL_SONG, true, "song", "Qwish", 1941), tmdb: "2022" },
    ];
    const films = summarizeFilms(rows, new Map([[1940, 1940], [2022, 2022]]));
    expect([...films.keys()]).toEqual([1940]);
  });

  it("is empty for no rows", () => {
    expect(summarizeFilms([]).size).toBe(0);
  });
});

describe("parseAwardRows", () => {
  const lit = (value: string) => ({ type: "literal", value });
  const uri = (q: string) => ({ type: "uri", value: `http://www.wikidata.org/entity/${q}` });

  it("reads the bindings of the query", () => {
    const rows = parseAwardRows([
      { tmdb: lit("238"), cat: uri("Q102427"), w: lit("1"), kind: lit("film") },
      { tmdb: lit("238"), cat: uri("Q106291"), w: lit("0"), kind: lit("person"), who: uri("Q41163") },
      { tmdb: lit("10193"), cat: uri("Q112243"), w: lit("1"), kind: lit("song"), who: uri("Q3566905"), pit: lit("2011-02-27T00:00:00Z") },
    ]);
    expect(rows).toEqual([
      { tmdb: "238", cat: "Q102427", won: true, kind: "film", who: undefined, year: undefined },
      { tmdb: "238", cat: "Q106291", won: false, kind: "person", who: "Q41163", year: undefined },
      { tmdb: "10193", cat: "Q112243", won: true, kind: "song", who: "Q3566905", year: 2011 },
    ]);
  });

  it("skips bindings that lack a field or carry an unknown one", () => {
    expect(
      parseAwardRows([
        { cat: uri("Q1"), w: lit("1"), kind: lit("film") },
        { tmdb: lit("1"), w: lit("1"), kind: lit("film") },
        { tmdb: lit("1"), cat: uri("Q1"), kind: lit("film") },
        { tmdb: lit("1"), cat: uri("Q1"), w: lit("1") },
        { tmdb: lit("1"), cat: uri("Q1"), w: lit("2"), kind: lit("film") },
        { tmdb: lit("1"), cat: uri("Q1"), w: lit("1"), kind: lit("studio") },
      ]),
    ).toEqual([]);
  });

  it("ignores a point in time that is not a plain year", () => {
    const [parsed] = parseAwardRows([
      { tmdb: lit("1"), cat: uri("Q1"), w: lit("1"), kind: lit("song"), pit: lit("-0300-01-01T00:00:00Z") },
    ]);
    expect(parsed.year).toBeUndefined();
  });
});

describe("awardsQuery", () => {
  it("binds the films first, by TMDB id, and stays plain SPARQL with no label service", () => {
    const query = awardsQuery([238, 240]);
    expect(query).toContain('VALUES ?tmdb { "238" "240" }');
    expect(query.indexOf("wdt:P4947")).toBeGreaterThan(query.indexOf("VALUES ?tmdb"));
    expect(query).not.toMatch(/SERVICE|wikibase:label|bd:serviceParam/);
    expect(query).toContain("wd:Q19020");
    expect(query).toContain("wd:Q179808 wd:Q209459 wd:Q154590");
  });

  it("skips withdrawn nominations by their deprecated rank on every kind of person statement", () => {
    const query = awardsQuery([238]);
    expect(query.match(/!= wikibase:DeprecatedRank/g)).toHaveLength(6);
  });

  it("only includes manual song links for films in the batch", () => {
    const aladdin = SONG_LINK_OVERRIDES.find((o) => o.tmdb === 812)!;
    expect(awardsQuery([812, 550])).toContain(`(wd:${aladdin.song} "812")`);
    expect(awardsQuery([550])).not.toContain("VALUES (?song ?tmdb)");
  });

  it("only ever puts whole positive numbers into the VALUES list", () => {
    expect(awardsQuery([Number.NaN, 12.7, -3, 5]).match(/VALUES \?tmdb \{[^}]*\}/)?.[0]).toBe('VALUES ?tmdb { "5" }');
  });
});

describe("SONG_LINK_OVERRIDES", () => {
  it("has well-formed, unique entries", () => {
    for (const o of SONG_LINK_OVERRIDES) {
      expect(o.song).toMatch(/^Q\d+$/);
      expect(Number.isInteger(o.tmdb) && o.tmdb > 0).toBe(true);
      expect(o.note.length).toBeGreaterThan(0);
    }
    expect(new Set(SONG_LINK_OVERRIDES.map((o) => o.song)).size).toBe(SONG_LINK_OVERRIDES.length);
  });
});
