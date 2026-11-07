import { describe, expect, it } from "vitest";
import type { Clipping, ClippingsPerson } from "@/lib/clippings";
import {
  clippingById,
  clippingsCountMessage,
  clippingYear,
  dateYear,
  filterClippings,
  filterOptions,
  parseQuoteId,
  quoteCardSearch,
  quoteLinkSearch,
  speakerIndex,
  truncateQuote,
} from "@/lib/clippings-view";

const people = [
  { id: 488, name: "Steven Spielberg" },
  { id: 491, name: "John Williams" },
] as const satisfies readonly [ClippingsPerson, ClippingsPerson];

const clipping = (speaker: string, about: string, quote = `${speaker} on ${about}`): Clipping => ({
  id: quote.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  speaker,
  about,
  quote,
  film: null,
  said_year: null,
  publication: "Example Times",
  title: "Placeholder headline",
  date: "2000",
  url: "https://example.com/a",
  via: null,
  context: "Placeholder context.",
  secondhand: false,
});

const aOnB = clipping("Steven Spielberg", "John Williams", "a1");
const aOnB2 = clipping("Steven Spielberg", "John Williams", "a2");
const bOnA = clipping("John Williams", "Steven Spielberg", "b1");

describe("speakerIndex", () => {
  it("is 0 for the first of the pair and 1 for the second", () => {
    expect(speakerIndex(aOnB, people)).toBe(0);
    expect(speakerIndex(bOnA, people)).toBe(1);
  });

  it("ignores case, extra spaces and accents", () => {
    expect(speakerIndex({ speaker: "  steven  SPIELBERG " }, people)).toBe(0);
    expect(speakerIndex({ speaker: "John Willíams" }, people)).toBe(1);
  });

  it("is null for someone else", () => {
    expect(speakerIndex({ speaker: "Somebody Else" }, people)).toBeNull();
  });
});

describe("filterClippings", () => {
  const all = [aOnB, bOnA, aOnB2, clipping("Somebody Else", "John Williams", "x")];

  it("shows everything for all, in order", () => {
    expect(filterClippings(all, people, "all").map((c) => c.quote)).toEqual(["a1", "b1", "a2", "x"]);
  });

  it("shows what the first, or the second, person said", () => {
    expect(filterClippings(all, people, "first").map((c) => c.quote)).toEqual(["a1", "a2"]);
    expect(filterClippings(all, people, "second").map((c) => c.quote)).toEqual(["b1"]);
  });
});

describe("filterOptions", () => {
  it("offers All and both directions, with family names for the buttons and full names for the tooltips", () => {
    expect(filterOptions([aOnB, aOnB2, bOnA], people)).toEqual([
      { id: "all", label: "All", title: "All clippings", count: 3 },
      { id: "first", label: "Spielberg on Williams", title: "Steven Spielberg on John Williams", count: 2 },
      { id: "second", label: "Williams on Spielberg", title: "John Williams on Steven Spielberg", count: 1 },
    ]);
  });

  it("has no filter when only one direction has clippings", () => {
    expect(filterOptions([aOnB, aOnB2], people)).toEqual([]);
    expect(filterOptions([bOnA], people)).toEqual([]);
    expect(filterOptions([], people)).toEqual([]);
  });

  it("uses full names when the two share a family name", () => {
    const coens = [
      { id: 1, name: "Joel Coen" },
      { id: 2, name: "Ethan Coen" },
    ] as const;
    const options = filterOptions([clipping("Joel Coen", "Ethan Coen"), clipping("Ethan Coen", "Joel Coen")], coens);
    expect(options.map((o) => o.label)).toEqual(["All", "Joel Coen on Ethan Coen", "Ethan Coen on Joel Coen"]);
  });
});

describe("clippingsCountMessage", () => {
  it("counts the clippings shown", () => {
    expect(clippingsCountMessage(3)).toBe("Showing 3 clippings");
    expect(clippingsCountMessage(1)).toBe("Showing 1 clipping");
    expect(clippingsCountMessage(0)).toBe("Showing 0 clippings");
  });
});

describe("dateYear", () => {
  it("reads the year of a day, a month or a year", () => {
    expect(dateYear("2012-05-01")).toBe(2012);
    expect(dateYear("2012-05")).toBe(2012);
    expect(dateYear("2012")).toBe(2012);
    expect(dateYear(" 1984-12 ")).toBe(1984);
  });

  it("is null for anything else", () => {
    for (const date of ["", "n.d.", "spring 2012", "12", "20125", "2012-5", "2012-05-1", "2012/05/01", "2012-05-01T10:00"]) {
      expect(dateYear(date), date).toBeNull();
    }
  });
});

describe("clippingYear", () => {
  it("is the year it was said when that is the older", () => {
    expect(clippingYear({ said_year: 1977, date: "2012-05-01" })).toBe(1977);
    expect(clippingYear({ said_year: 2011, date: "2012-01-27" })).toBe(2011);
  });

  it("is the year of the original when that is the older, whatever the precision of its date", () => {
    expect(clippingYear({ said_year: 2023, date: "2006-07" })).toBe(2006);
    expect(clippingYear({ said_year: 2023, date: "1984-12-25" })).toBe(1984);
    expect(clippingYear({ said_year: 2023, date: "1999" })).toBe(1999);
  });

  it("is that year when both are the same", () => {
    expect(clippingYear({ said_year: 2012, date: "2012-11-10" })).toBe(2012);
  });

  it("falls back to the year of the original when no year was said, written in full, as a month or as a year", () => {
    expect(clippingYear({ said_year: null, date: "2012-05-01" })).toBe(2012);
    expect(clippingYear({ said_year: null, date: "2017-07" })).toBe(2017);
    expect(clippingYear({ said_year: null, date: "2012" })).toBe(2012);
  });

  it("falls back to the year said when the date is not a date", () => {
    expect(clippingYear({ said_year: 1990, date: "" })).toBe(1990);
    expect(clippingYear({ said_year: 1990, date: "n.d." })).toBe(1990);
  });

  it("is null when neither is a year", () => {
    expect(clippingYear({ said_year: null, date: "" })).toBeNull();
    expect(clippingYear({ said_year: null, date: "n.d." })).toBeNull();
    expect(clippingYear({ said_year: Number.NaN, date: "n.d." })).toBeNull();
  });
});

describe("clippingById", () => {
  const all = [aOnB, bOnA, aOnB2];

  it("finds the clipping with that id", () => {
    expect(clippingById(all, aOnB2.id)).toBe(aOnB2);
    expect(clippingById(all, bOnA.id)).toBe(bOnA);
  });

  it("is null for an id the pair does not have, an empty one or none", () => {
    expect(clippingById(all, "nope")).toBeNull();
    expect(clippingById(all, "")).toBeNull();
    expect(clippingById(all, null)).toBeNull();
    expect(clippingById(all, undefined)).toBeNull();
    expect(clippingById([], aOnB.id)).toBeNull();
  });

  it("compares the id exactly, not case-insensitively or as a prefix", () => {
    expect(clippingById(all, aOnB.id.toUpperCase())).toBeNull();
    expect(clippingById(all, aOnB.id.slice(0, -1))).toBeNull();
  });
});

describe("parseQuoteId", () => {
  it("reads quote from a query string, with or without its question mark, and from a URLSearchParams", () => {
    expect(parseQuoteId("?view=clippings&quote=jaws-theme")).toBe("jaws-theme");
    expect(parseQuoteId("quote=jaws-theme")).toBe("jaws-theme");
    expect(parseQuoteId(new URLSearchParams("quote=jaws-theme"))).toBe("jaws-theme");
  });

  it("reads quote from the search params a page is given, taking the first of a repeated one", () => {
    expect(parseQuoteId({ quote: "a" })).toBe("a");
    expect(parseQuoteId({ quote: ["a", "b"] })).toBe("a");
  });

  it("is null when there is none or it is empty", () => {
    expect(parseQuoteId("")).toBeNull();
    expect(parseQuoteId("?view=clippings")).toBeNull();
    expect(parseQuoteId("?quote=")).toBeNull();
    expect(parseQuoteId("?quote=%20")).toBeNull();
    expect(parseQuoteId({})).toBeNull();
    expect(parseQuoteId({ quote: "" })).toBeNull();
    expect(parseQuoteId({ quote: [] })).toBeNull();
  });
});

describe("the link to a quote", () => {
  it("opens the Clippings tab on it", () => {
    expect(quoteLinkSearch("jaws-theme")).toBe("?view=clippings&quote=jaws-theme");
  });

  it("escapes an id that needs it, and reads back as the same id", () => {
    expect(quoteLinkSearch("a&b c")).toBe("?view=clippings&quote=a%26b+c");
    expect(parseQuoteId(quoteLinkSearch("a&b c"))).toBe("a&b c");
  });

  it("is written one way for the quote's card, with nothing else in the query", () => {
    expect(quoteCardSearch("jaws-theme")).toBe("?quote=jaws-theme");
  });
});

describe("truncateQuote", () => {
  it("leaves a quote that fits as it is", () => {
    expect(truncateQuote("Short.", 90)).toBe("Short.");
    expect(truncateQuote("x".repeat(90), 90)).toBe("x".repeat(90));
  });

  it("folds whitespace, so a line break does not show on a card or in a title", () => {
    expect(truncateQuote("One\n\n  two   three", 90)).toBe("One two three");
  });

  it("cuts at a word and ends in an ellipsis, within the limit", () => {
    const text = "The quick brown fox jumps over the lazy dog and keeps running far away";
    const cut = truncateQuote(text, 30);
    expect(Array.from(cut).length).toBeLessThanOrEqual(30);
    expect(cut.endsWith("\u2026")).toBe(true);
    expect(text.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut).toBe("The quick brown fox jumps\u2026");
  });

  it("takes the punctuation a cut leaves dangling off before the ellipsis", () => {
    expect(truncateQuote("Well, he said, and then it went on and on and on.", 16)).toBe("Well, he said\u2026");
    expect(truncateQuote("First sentence. Second sentence goes on.", 18)).toBe("First sentence\u2026");
    expect(truncateQuote("One \u2014 two three four five six seven", 8)).toBe("One\u2026");
  });

  it("cuts a long word where it stands when there is no space to cut at that would not lose most of the text", () => {
    expect(truncateQuote("Supercalifragilisticexpialidocious", 10)).toBe("Supercali\u2026");
  });

  it("counts characters, not UTF-16 units", () => {
    expect(Array.from(truncateQuote("\u{1F3AC}".repeat(20), 10)).length).toBe(10);
  });
});
