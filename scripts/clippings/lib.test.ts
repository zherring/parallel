import { describe, expect, it } from "vitest";
import {
  buildCriticsEntry,
  buildQuotesEntry,
  criticsFlags,
  hasUnbalancedStraightQuotes,
  isHttps,
  keyFromIds,
  nestQuotes,
  quotesFlags,
  slug,
  stringifyData,
  uniqueId,
  validateCriticsFile,
  validateIds,
  validateQuotesFile,
  type KnownPairings,
  type RawCriticsFile,
  type RawQuotesFile,
} from "./lib";

const KNOWN: KnownPairings = {
  "488+491": {
    people: [
      { id: 488, name: "Steven Spielberg" },
      { id: 491, name: "John Williams" },
    ],
  },
};

const quote = (over: Record<string, unknown> = {}) => ({
  speaker: "Steven Spielberg",
  about: "John Williams",
  quote: "John Williams has been the single most significant contributor to my success.",
  film: null,
  said_year: 2012,
  publication: "NPR",
  via: null,
  title: "John Williams' Inevitable Themes",
  date: "2012-11-10",
  url: "https://www.npr.org/transcripts/164615420",
  context: "Tribute at Tanglewood.",
  secondhand: false,
  ...over,
});

const quotesFile = (over: Record<string, unknown> = {}, clippings: Record<string, unknown>[] = [quote()]) => ({
  pair: ["Steven Spielberg", "John Williams"],
  tmdb_ids: [488, 491],
  clippings,
  ...over,
});

const critic = (over: Record<string, unknown> = {}) => ({
  critic: "A. Writer",
  publication: "Sight and Sound",
  via: null,
  title: "Fathers and sons",
  date: "2018-02",
  url: "https://example.com/essay",
  kind: "essay",
  quote: "Williams tells stories with his music, and Spielberg listens in awe.",
  why: "editor note",
  ...over,
});

const reading = (over: Record<string, unknown> = {}) => ({
  title: "A book chapter",
  author: null,
  publication: "OUP",
  date: "2020",
  url: "https://example.com/book",
  paywalled: true,
  ...over,
});

describe("slug", () => {
  it("takes the first six words, lowercased", () => {
    expect(slug("This year marks our 40th year of working together")).toBe("this-year-marks-our-40th-year");
  });
  it("drops apostrophes instead of splitting on them", () => {
    expect(slug("Leone's style isn't simple")).toBe("leones-style-isnt-simple");
    expect(slug("It’s John’s")).toBe("its-johns");
  });
  it("strips accents and drops non-ASCII characters", () => {
    expect(slug("Almodóvar and Penélope")).toBe("almodovar-and-penelope");
    expect(slug("‘Tintin’ — a score")).toBe("tintin-a-score");
  });
  it("is empty when nothing is alphanumeric", () => {
    expect(slug("… — ?")).toBe("");
  });
});

describe("uniqueId", () => {
  it("appends -2 for each repeat and records the id", () => {
    const seen = new Set<string>();
    expect(uniqueId("a-b", seen)).toBe("a-b");
    expect(uniqueId("a-b", seen)).toBe("a-b-2");
    expect(uniqueId("a-b", seen)).toBe("a-b-2-2");
    expect(seen.size).toBe(3);
  });
});

describe("nestQuotes", () => {
  it("maps curly doubles to curly singles", () => {
    expect(nestQuotes("He said “yes” twice")).toBe("He said ‘yes’ twice");
  });
  it("pairs straight doubles as open then close", () => {
    expect(nestQuotes('I asked, "Will you join me?" and he said, "Yes" w')).toBe("I asked, ‘Will you join me?’ and he said, ‘Yes’ w");
  });
  it("leaves apostrophes and existing single quotes alone", () => {
    expect(nestQuotes("Don't call it 'Tintin’s' score")).toBe("Don't call it 'Tintin’s' score");
  });
  it("detects an odd number of straight doubles", () => {
    expect(hasUnbalancedStraightQuotes('one " two')).toBe(true);
    expect(hasUnbalancedStraightQuotes('"a" "b"')).toBe(false);
    expect(hasUnbalancedStraightQuotes("none")).toBe(false);
  });
});

describe("keyFromIds", () => {
  it("sorts the ids and joins them with +", () => {
    expect(keyFromIds([491, 488])).toBe("488+491");
    expect(keyFromIds([1419631, 136495])).toBe("136495+1419631");
  });
});

describe("isHttps", () => {
  it("accepts https and rejects other schemes and junk", () => {
    expect(isHttps("https://example.com/a")).toBe(true);
    expect(isHttps("http://example.com/a")).toBe(false);
    expect(isHttps("ftp://example.com/a")).toBe(false);
    expect(isHttps("example.com")).toBe(false);
    expect(isHttps(null)).toBe(false);
  });
  it("lets the known http-only hosts through", () => {
    expect(isHttps("http://bernardherrmann.org/articles/x/")).toBe(true);
    expect(isHttps("http://www.bernardherrmann.org/articles/x/")).toBe(true);
  });
});

describe("validateQuotesFile", () => {
  it("accepts a good file", () => {
    expect(validateQuotesFile(quotesFile(), "488+491", KNOWN)).toEqual([]);
  });
  it("accepts a missing via, film, said_year and secondhand", () => {
    const c = { ...quote() } as Record<string, unknown>;
    delete c.via;
    delete c.film;
    delete c.said_year;
    delete c.secondhand;
    expect(validateQuotesFile(quotesFile({}, [c]), "488+491", KNOWN)).toEqual([]);
  });
  it("rejects a speaker or about outside the pair, and one person talking about themselves", () => {
    const errors = validateQuotesFile(quotesFile({}, [quote({ speaker: "Someone Else" }), quote({ about: "Steven Spielberg" })]), "488+491", KNOWN);
    expect(errors).toEqual([
      'clippings[0]: speaker "Someone Else" is not in the pair',
      "clippings[1]: speaker and about are the same person",
    ]);
  });
  it("rejects names that differ from the generated people, and a key that does not match the ids", () => {
    const errors = validateQuotesFile(quotesFile({ pair: ["Steven Spielberg", "Jon Williams"] }), "488+491", KNOWN);
    expect(errors.join("\n")).toContain('pair[1] is "Jon Williams" but TMDB id 491 is "John Williams"');
    const wrongKey = validateQuotesFile(quotesFile(), "1+2", KNOWN);
    expect(wrongKey.join("\n")).toContain("make the key 488+491, not 1+2");
  });
  it("accepts the pair in either order as long as names and ids line up", () => {
    const flipped = quotesFile({ pair: ["John Williams", "Steven Spielberg"], tmdb_ids: [491, 488] });
    expect(validateQuotesFile(flipped, "488+491", KNOWN)).toEqual([]);
    const crossed = quotesFile({ pair: ["John Williams", "Steven Spielberg"], tmdb_ids: [488, 491] });
    expect(validateQuotesFile(crossed, "488+491", KNOWN)).toHaveLength(2);
  });
  it("rejects a pairing that is not in examples.generated.json", () => {
    const errors = validateQuotesFile(quotesFile({ tmdb_ids: [1, 2] }), "1+2", KNOWN);
    expect(errors.join("\n")).toContain("not a pairing in examples.generated.json");
  });
  it("rejects bad dates, http urls, missing fields and unbalanced quotes", () => {
    const bad = quote({ date: "2012-13", url: "http://example.com/x", title: "", context: undefined, quote: 'one " two' });
    const errors = validateQuotesFile(quotesFile({}, [bad]), "488+491", KNOWN).join("\n");
    expect(errors).toContain('date "2012-13"');
    expect(errors).toContain("not an https URL");
    expect(errors).toContain('"title" is missing');
    expect(errors).toContain('"context" is missing');
    expect(errors).toContain("odd number of straight double quotes");
  });
  it("takes years, months and days as dates", () => {
    for (const date of ["1999", "1999-05", "1999-05-31"]) {
      expect(validateQuotesFile(quotesFile({}, [quote({ date })]), "488+491", KNOWN)).toEqual([]);
    }
    for (const date of ["99", "1999-5", "1999-02-32", "May 1999"]) {
      expect(validateQuotesFile(quotesFile({}, [quote({ date })]), "488+491", KNOWN)).not.toEqual([]);
    }
  });
  it("needs at least one clipping", () => {
    expect(validateQuotesFile(quotesFile({}, []), "488+491", KNOWN)).toEqual(['"clippings" must be a non-empty array']);
    expect(validateQuotesFile("nope", "488+491", KNOWN)).toEqual(["not a JSON object"]);
  });
});

describe("buildQuotesEntry", () => {
  it("whitelists fields in file order, nests quotes, adds stable ids and nulls the missing", () => {
    const src = quotesFile({}, [
      { ...quote({ quote: 'He told me "keep going" that day.', extra: "dropped", secondhand: undefined }), via: undefined },
    ]) as unknown as RawQuotesFile;
    const entry = buildQuotesEntry(src);
    expect(entry.pair).toEqual(["Steven Spielberg", "John Williams"]);
    expect(entry.tmdb_ids).toEqual([488, 491]);
    const [c] = entry.clippings;
    expect(Object.keys(c)).toEqual([
      "id",
      "speaker",
      "about",
      "quote",
      "film",
      "said_year",
      "publication",
      "via",
      "title",
      "date",
      "url",
      "context",
      "secondhand",
    ]);
    expect(c.id).toBe("he-told-me-keep-going-that");
    expect(c.quote).toBe("He told me ‘keep going’ that day.");
    expect(c.via).toBeNull();
    expect(c.secondhand).toBe(false);
  });
  it("gives repeated openings distinct ids", () => {
    const same = quote();
    const entry = buildQuotesEntry(quotesFile({}, [same, { ...same }]) as unknown as RawQuotesFile);
    expect(entry.clippings.map((c) => c.id)).toEqual(["john-williams-has-been-the-single", "john-williams-has-been-the-single-2"]);
  });
});

describe("validateCriticsFile / buildCriticsEntry", () => {
  const file = (over: Record<string, unknown> = {}) => ({
    pair: ["Steven Spielberg", "John Williams"],
    tmdb_ids: [488, 491],
    critics: [critic()],
    reading: [reading()],
    ...over,
  });

  it("accepts a good file", () => {
    expect(validateCriticsFile(file(), "488+491", KNOWN)).toEqual([]);
  });
  it("rejects an unknown kind, a bad url, a missing paywalled flag and an empty file", () => {
    const errors = validateCriticsFile(file({ critics: [critic({ kind: "tweet", url: "nope" })], reading: [reading({ paywalled: undefined })] }), "488+491", KNOWN).join("\n");
    expect(errors).toContain('kind "tweet"');
    expect(errors).toContain("not an https URL");
    expect(errors).toContain('"paywalled" must be true or false');
    expect(validateCriticsFile(file({ critics: [], reading: [] }), "488+491", KNOWN)).toContain('"critics" and "reading" are both empty');
  });
  it("allows links only", () => {
    expect(validateCriticsFile(file({ critics: [] }), "488+491", KNOWN)).toEqual([]);
  });
  it("prefixes ids with critic-, drops the editor-only fields and keeps the reading list", () => {
    const entry = buildCriticsEntry(file({ critics: [critic({ quote: 'He calls it "the sound of home".' })] }) as unknown as RawCriticsFile);
    const [c] = entry.critics;
    expect(c.id).toBe("critic-he-calls-it-the-sound-of");
    expect(c.quote).toBe("He calls it ‘the sound of home’.");
    expect(Object.keys(c)).toEqual(["id", "critic", "publication", "via", "title", "date", "url", "kind", "quote"]);
    expect(entry.reading).toEqual([reading()]);
  });
});

describe("validateIds", () => {
  it("passes distinct ids and fails duplicates, a missing prefix and a clipping that takes the prefix", () => {
    expect(validateIds({ a: { clippings: [{ id: "x" }] }, b: { clippings: [{ id: "x" }] } }, { a: { critics: [{ id: "critic-y" }] } })).toEqual([]);
    const errors = validateIds(
      { a: { clippings: [{ id: "x" }, { id: "x" }, { id: "critic-z" }] } },
      { a: { critics: [{ id: "critic-y" }, { id: "plain" }] }, b: { critics: [{ id: "critic-y" }] } },
    );
    expect(errors).toEqual([
      'clippings.json a: duplicate id "x"',
      'clippings.json a: id "critic-z" uses the critic- prefix',
      'essays.json a: id "plain" must start with "critic-"',
      'essays.json b: duplicate id "critic-y"',
    ]);
  });
});

describe("flags", () => {
  const entry = buildQuotesEntry(quotesFile({}, [quote({ secondhand: true })]) as unknown as RawQuotesFile);
  it("notes a thin or one-sided set and secondhand quotes", () => {
    expect(quotesFlags(entry)).toEqual(["only 1 quotes", "nothing from John Williams", "1 secondhand"]);
  });
  it("notes critic quotes of an odd length", () => {
    const c = buildCriticsEntry({ pair: ["A", "B"], tmdb_ids: [1, 2], critics: [critic({ quote: "Too short." })], reading: [] });
    expect(criticsFlags(c)).toEqual(["1 quotes outside 15-80 words"]);
  });
});

describe("stringifyData", () => {
  it("is 2-space JSON with a trailing newline and non-ASCII left as written", () => {
    expect(stringifyData({ a: ["é"] })).toBe('{\n  "a": [\n    "é"\n  ]\n}\n');
  });
});
