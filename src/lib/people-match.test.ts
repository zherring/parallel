import { describe, expect, it } from "vitest";
import {
  buildMatchIndex,
  normalizeName,
  scoreName,
  searchIndex,
  type MatchablePerson,
} from "@/lib/people-match";

let nextId = 1000;
const person = (name: string, popularity: number, id = nextId++, credits = 0): MatchablePerson => ({
  id,
  name,
  profilePath: null,
  knownFor: null,
  knownForTitles: [],
  popularity,
  credits,
});

// Real names with popularities of the order TMDB reports, including the obscure namesakes that
// TMDB's own search puts first.
const FIXTURE = buildMatchIndex([
  person("Steven Spielberg", 12.4, 488),
  person("Steven Soderbergh", 6.1, 1884),
  person("Steve Carell", 15.3),
  person("Stellan Skarsgård", 14.8),
  person("Stephen King", 6.5),
  person("Gavin Speiller", 0.4),
  person("Andrew Speiler", 0.3),
  person("David Speilberg", 0.2),
  person("Hilde Spiel", 0.7),
  person("Max Spiel", 0.4),
  person("Ludwig Spiel", 0.3),
  person("Anna Spiel", 0.3),
  person("Pia Spiel", 0.2),
  person("George Lucas", 8.6, 1),
  person("George Clooney", 18.2, 1461),
  person("George Miller", 9.3),
  person("Georg Friedrich", 2.1),
  person("Georgia Hirst", 6.4),
  person("Georges Méliès", 3.1),
  person("Martin Scorsese", 14.2, 1032),
  person("Quentin Tarantino", 20.3, 138),
  person("Quentin Dupieux", 2.2),
  person("Jordan Cronenweth", 1.6, 5001),
  person("Jeff Cronenweth", 2.4, 5002),
  person("David Cronenberg", 9.7),
  person("Penélope Cruz", 17.9, 955),
  person("Tom Cruise", 40.1),
  person("Daniel Day-Lewis", 12.6, 11856),
  person("Daniel Craig", 30.4),
  person("Day Lewis", 0.2),
  person("J.J. Abrams", 8.9, 1341),
  person("Tom Hanks", 33.2, 31),
  person("Tom Hardy", 42.7),
  person("Thomas Haden Church", 7.2),
  person("Pedro Almodóvar", 5.2, 3),
  person("Øyvind Stein", 0.4),
  person("Patrick O'Brien", 0.5),
  person("Spencer Tracy", 4.2),
]);

const names = (query: string, limit?: number) =>
  searchIndex(FIXTURE, query, limit).map((m) => m.person.name);

describe("normalizeName", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeName("Penélope Cruz")).toBe("penelope cruz");
    expect(normalizeName("Stellan Skarsgård")).toBe("stellan skarsgard");
  });

  it("folds letters that do not decompose", () => {
    expect(normalizeName("Øyvind")).toBe("oyvind");
    expect(normalizeName("Strauß")).toBe("strauss");
  });

  it("turns hyphens and punctuation into spaces and drops apostrophes", () => {
    expect(normalizeName("Daniel Day-Lewis")).toBe("daniel day lewis");
    expect(normalizeName("I. A. L. Diamond")).toBe("i a l diamond");
    expect(normalizeName("Patrick O'Brien")).toBe("patrick obrien");
    expect(normalizeName("Patrick O’Brien")).toBe("patrick obrien");
    expect(normalizeName("  Tom   Hanks! ")).toBe("tom hanks");
  });

  it("keeps non-Latin letters", () => {
    expect(normalizeName("봉준호")).toBe("봉준호");
  });
});

describe("searchIndex: required cases", () => {
  it("finds Steven Spielberg from the typo 'speil', ahead of the obscure Speil- names", () => {
    const result = names("speil");
    expect(result.slice(0, 3)).toContain("Steven Spielberg");
    expect(result[0]).toBe("Steven Spielberg");
  });

  it("ranks Steven Spielberg above the obscure Spiels for 'spiel'", () => {
    const result = names("spiel");
    expect(result[0]).toBe("Steven Spielberg");
    expect(result).toContain("Hilde Spiel");
  });

  it("puts George Lucas and George Clooney ahead of Georg Friedrich for 'georg'", () => {
    const result = names("georg");
    expect(result.indexOf("George Clooney")).toBeLessThan(result.indexOf("Georg Friedrich"));
    expect(result.indexOf("George Lucas")).toBeLessThan(result.indexOf("Georg Friedrich"));
    expect(result.slice(0, 3)).toEqual(
      expect.arrayContaining(["George Clooney", "George Lucas"]),
    );
  });

  it("ranks 'ste' by notability among the Ste- names", () => {
    const result = names("ste");
    expect(result.slice(0, 4)).toEqual(
      expect.arrayContaining(["Steven Spielberg", "Steve Carell", "Stellan Skarsgård"]),
    );
    expect(result.indexOf("Steven Spielberg")).toBeLessThan(result.indexOf("Steven Soderbergh"));
    expect(result.indexOf("Steven Soderbergh")).toBeGreaterThan(-1);
  });

  it("completes 'steven spie' and 'george luc' from the start of the full name", () => {
    expect(names("steven spie")[0]).toBe("Steven Spielberg");
    expect(names("george luc")[0]).toBe("George Lucas");
    const [first] = searchIndex(FIXTURE, "george luc");
    expect(first.kind).toBe("prefix");
  });

  it("corrects typos: scorcese, tarantno, cronenwet", () => {
    expect(names("scorcese")[0]).toBe("Martin Scorsese");
    expect(names("tarantno")[0]).toBe("Quentin Tarantino");
    expect(names("cronenwet").slice(0, 2).sort()).toEqual(["Jeff Cronenweth", "Jordan Cronenweth"]);
    expect(searchIndex(FIXTURE, "scorcese")[0].kind).toBe("fuzzy");
  });

  it("matches 'penelope cruz' to Penélope Cruz and calls it exact", () => {
    const [first] = searchIndex(FIXTURE, "penelope cruz");
    expect(first.person.name).toBe("Penélope Cruz");
    expect(first.kind).toBe("exact");
    expect(names("PENÉLOPE")[0]).toBe("Penélope Cruz");
  });

  it("finds hyphenated names from either end", () => {
    expect(names("day lew")[0]).toBe("Daniel Day-Lewis");
    expect(names("daniel day")[0]).toBe("Daniel Day-Lewis");
    expect(names("daniel day-lew")[0]).toBe("Daniel Day-Lewis");
    expect(names("lewis")[0]).toBe("Daniel Day-Lewis");
  });

  it("accepts the words in reversed order, below the straight order", () => {
    const result = searchIndex(FIXTURE, "spielberg steven");
    expect(result[0].person.name).toBe("Steven Spielberg");
    expect(result[0].kind).toBe("token");
    const straight = searchIndex(FIXTURE, "steven spielberg")[0];
    expect(straight.kind).toBe("exact");
    expect(straight.score).toBeGreaterThan(result[0].score);
  });

  it("returns nothing for a query that matches nobody", () => {
    expect(names("zzzzqqqq")).toEqual([]);
    expect(names("xyz abc")).toEqual([]);
  });

  it("returns nothing under two characters", () => {
    expect(names("")).toEqual([]);
    expect(names("s")).toEqual([]);
    expect(names("  ")).toEqual([]);
    expect(names("-")).toEqual([]);
    expect(names("sp").length).toBeGreaterThan(0);
  });
});

describe("searchIndex: ranking", () => {
  it("lets a typo of a famous name beat an exact match of an obscure one only by a wide margin", () => {
    const index = buildMatchIndex([person("Clooney Smith", 0.2), person("George Clooney", 18)]);
    expect(searchIndex(index, "clooney").map((m) => m.person.name)).toEqual([
      "George Clooney",
      "Clooney Smith",
    ]);
    // 'clooney' typed correctly must still find the obscure exact word over a famous near-miss.
    const near = buildMatchIndex([person("Colin Clooney", 1), person("Frank Clooner", 3)]);
    expect(searchIndex(near, "clooney")[0].person.name).toBe("Colin Clooney");
  });

  it("an exact full name beats a more famous person whose name merely starts with it", () => {
    const index = buildMatchIndex([person("Tom Hanks", 5), person("Tom Hanksworth", 40)]);
    expect(searchIndex(index, "tom hanks")[0].person.name).toBe("Tom Hanks");
  });

  it("does not let a stray obscure exact name beat a famous person while the name is still being typed", () => {
    const index = buildMatchIndex([person("Ste", 0.4), person("Steven Spielberg", 12, 488, 15)]);
    expect(searchIndex(index, "ste").map((m) => m.person.name)).toEqual(["Steven Spielberg", "Ste"]);
    expect(searchIndex(index, "ste")[1].kind).toBe("exact");
  });

  it("steadies trending popularity with notable-film credits", () => {
    const index = buildMatchIndex([
      person("Sam Trending", 6.3, 1, 0),
      person("Sam Director", 2.2, 2, 30),
    ]);
    expect(searchIndex(index, "sam").map((m) => m.person.name)).toEqual(["Sam Director", "Sam Trending"]);
  });

  it("breaks equal scores by popularity, then by id, so the order never changes", () => {
    const index = buildMatchIndex([
      person("Alex Rowe", 1, 30),
      person("Alex Rowe", 1, 10),
      person("Alex Rowe", 1, 20),
    ]);
    expect(searchIndex(index, "alex rowe").map((m) => m.person.id)).toEqual([10, 20, 30]);
  });

  it("returns at most `limit` results, defaulting to 8", () => {
    const crowd = buildMatchIndex(Array.from({ length: 20 }, (_, i) => person(`Alex Stone ${i}`, i)));
    expect(searchIndex(crowd, "alex")).toHaveLength(8);
    expect(searchIndex(crowd, "alex", 3)).toHaveLength(3);
    expect(searchIndex(crowd, "alex", 0)).toEqual([]);
    // The most notable come first.
    expect(searchIndex(crowd, "alex", 2).map((m) => m.person.name)).toEqual([
      "Alex Stone 19",
      "Alex Stone 18",
    ]);
  });

  it("treats the last word as still being typed and earlier words as finished", () => {
    // 'han' is still being typed, so it completes to Hanks; it does not match Hardy.
    expect(names("tom han")).toEqual(["Tom Hanks"]);
    // 'tom' is finished: it is a whole word (or the start of one), not a typo of 'thomas'.
    expect(names("tom haden")).toEqual([]);
    expect(names("thomas haden")).toEqual(["Thomas Haden Church"]);
  });

  it("lets a finished word be the start of a longer one, but scores it below the whole word", () => {
    const index = buildMatchIndex([person("Steven Spielberg", 5), person("Steve Spielberg", 5)]);
    const result = searchIndex(index, "steve spielberg");
    expect(result.map((m) => m.person.name)).toEqual(["Steve Spielberg", "Steven Spielberg"]);
  });

  it("matches the middle and last words, not just the first", () => {
    expect(names("skarsgard")[0]).toBe("Stellan Skarsgård");
    expect(names("haden")[0]).toBe("Thomas Haden Church");
  });

  it("applies no typo tolerance to words under four letters", () => {
    expect(names("tpm")).toEqual([]);
    // Four letters allow one edit: 'hanx' is Hanks with one letter swapped for another.
    expect(names("hankz")[0]).toBe("Tom Hanks");
  });

  it("allows two edits only from seven letters", () => {
    expect(names("scorsesi")[0]).toBe("Martin Scorsese");
    expect(names("scrosesi")[0]).toBe("Martin Scorsese");
    // Six letters, two edits away from 'hanks' (one wrong letter, one extra): too far.
    expect(names("hxnkzs")).toEqual([]);
    expect(names("spelbrg")[0]).toBe("Steven Spielberg");
  });

  it("counts an edit in the first two letters double, so 'speil' is not 'Sheila'", () => {
    const index = buildMatchIndex([person("Sheila Hancock", 9), person("Steven Spielberg", 5)]);
    expect(searchIndex(index, "speil").map((m) => m.person.name)).toEqual(["Steven Spielberg"]);
    expect(searchIndex(index, "sheil").map((m) => m.person.name)).toEqual(["Sheila Hancock"]);
  });

  it("drops typo guesses that score far below the best result", () => {
    const index = buildMatchIndex([
      person("Steven Spielberg", 12),
      person("Alejandro Speitzer", 0.1),
    ]);
    expect(searchIndex(index, "speil").map((m) => m.person.name)).toEqual(["Steven Spielberg"]);
    // With nothing better around, the same weak guess is shown.
    expect(searchIndex(buildMatchIndex([person("Alejandro Speitzer", 0.1)]), "speil")).toHaveLength(1);
  });

  it("matches initials written either way", () => {
    expect(names("jj abrams")[0]).toBe("J.J. Abrams");
    expect(names("j j abrams")[0]).toBe("J.J. Abrams");
    expect(names("j.j.")[0]).toBe("J.J. Abrams");
  });

  it("matches folded letters and apostrophes the way people type them", () => {
    expect(names("oyvind")[0]).toBe("Øyvind Stein");
    expect(names("o'brien")[0]).toBe("Patrick O'Brien");
    expect(names("obrien")[0]).toBe("Patrick O'Brien");
  });

  it("tags how each result matched", () => {
    const kinds = Object.fromEntries(
      searchIndex(FIXTURE, "steven spielberg").map((m) => [m.person.name, m.kind]),
    );
    expect(kinds["Steven Spielberg"]).toBe("exact");
    expect(searchIndex(FIXTURE, "steven spie")[0].kind).toBe("prefix");
    expect(searchIndex(FIXTURE, "spielberg")[0].kind).toBe("token");
    expect(searchIndex(FIXTURE, "speilberg")[0].kind).toBe("fuzzy");
  });

  it("never fuzzy-matches a word that starts with a different letter", () => {
    expect(names("pielberg")).toEqual([]);
  });

  it("does not choke on very long or odd input", () => {
    expect(names("a".repeat(500))).toEqual([]);
    expect(names("a b c d e f g h i j k l m n o p")).toEqual([]);
    expect(names("(((")).toEqual([]);
  });
});

describe("scoreName", () => {
  it("scores a single name the same way the index does", () => {
    const scored = scoreName("Steven Spielberg", 12.4, "steven spiel");
    const [first] = searchIndex(FIXTURE, "steven spiel");
    expect(scored).toEqual({ score: first.score, kind: first.kind });
  });

  it("is null when the name does not match or the query is too short", () => {
    expect(scoreName("Tom Hanks", 30, "spielberg")).toBeNull();
    expect(scoreName("Tom Hanks", 30, "t")).toBeNull();
  });
});
