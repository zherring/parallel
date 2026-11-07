import { describe, expect, it } from "vitest";
import type { Clipping, ClippingsPerson } from "@/lib/clippings";
import {
  clippingsCountMessage,
  filterClippings,
  filterOptions,
  formatClippingDate,
  speakerIndex,
} from "@/lib/clippings-view";

const people = [
  { id: 488, name: "Steven Spielberg" },
  { id: 491, name: "John Williams" },
] as const satisfies readonly [ClippingsPerson, ClippingsPerson];

const clipping = (speaker: string, about: string, quote = `${speaker} on ${about}`): Clipping => ({
  speaker,
  about,
  quote,
  film: null,
  said_year: null,
  publication: "Example Times",
  title: "Placeholder headline",
  date: "2000",
  url: "https://example.com/a",
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

describe("formatClippingDate", () => {
  it("writes a full date as month, day and year", () => {
    expect(formatClippingDate("2012-05-01")).toBe("May 1, 2012");
    expect(formatClippingDate("1999-12-31")).toBe("December 31, 1999");
  });

  it("writes a month as month and year, and a year as it is", () => {
    expect(formatClippingDate("2012-05")).toBe("May 2012");
    expect(formatClippingDate("2012")).toBe("2012");
  });

  it("cuts back a month or day that is out of range, and leaves what is not a date alone", () => {
    expect(formatClippingDate("2012-13-01")).toBe("2012");
    expect(formatClippingDate("2012-05-00")).toBe("May 2012");
    expect(formatClippingDate("2012-05-45")).toBe("May 2012");
    expect(formatClippingDate("spring 2012")).toBe("spring 2012");
  });
});
