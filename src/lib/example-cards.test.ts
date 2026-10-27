import { describe, expect, it } from "vitest";
import { buildGenreSections } from "@/lib/example-cards";
import { EXAMPLE_PAIRINGS, GENRES, type GeneratedExamples } from "@/lib/examples";

// Classic, Horror, and Comedy (no pairings below).
const genres = GENRES.filter((g) => ["classic", "horror", "comedy"].includes(g.id));

const pairings = [
  { genre: "classic", people: [{ id: 1, name: "Ada Lovelace" }, { id: 2, name: "Bo Peep" }], blurb: "First pair" },
  { genre: "horror", people: [{ id: 3, name: "Cy Twombly" }, { id: 4, name: "Di Prince" }], blurb: "Second pair" },
  { genre: "classic", people: [{ id: 6, name: "Fay Wray" }, { id: 5, name: "Ed Wood" }], blurb: "Third pair" },
];

const data: GeneratedExamples = {
  "1+2": {
    sharedCount: 7,
    people: [
      { id: 1, name: "Ada Lovelace", profilePath: "/a.jpg" },
      { id: 2, name: "Bo Peep", profilePath: "/b.jpg" },
    ],
  },
  "3+4": {
    sharedCount: 3,
    people: [
      { id: 3, name: "Cy Twombly", profilePath: "/c.jpg" },
      { id: 4, name: "Di Prince", profilePath: "/d.jpg" },
    ],
  },
  "5+6": {
    sharedCount: 1,
    people: [
      { id: 6, name: "Fay Wray", profilePath: "/f.jpg" },
      { id: 5, name: "Ed Wood", profilePath: "/e.jpg" },
    ],
  },
};

describe("buildGenreSections", () => {
  it("groups cards by genre in genre order and leaves out empty genres", () => {
    const sections = buildGenreSections(pairings, data, genres);
    expect(sections.map((s) => s.genre.id)).toEqual(["classic", "horror"]);
    expect(sections[0].cards.map((c) => c.blurb)).toEqual(["First pair", "Third pair"]);
    expect(sections[1].cards.map((c) => c.blurb)).toEqual(["Second pair"]);
  });

  it("takes names, photos and the count from the generated data and links to the slug", () => {
    const [first] = buildGenreSections(pairings, data, genres)[0].cards;
    expect(first).toEqual({
      genre: "classic",
      href: "/p/1-ada-lovelace+2-bo-peep",
      blurb: "First pair",
      sharedCount: 7,
      people: data["1+2"].people,
    });
  });

  it("keeps the pairing's order of people when matching its entry", () => {
    const [, third] = buildGenreSections(pairings, data, genres)[0].cards;
    expect(third.href).toBe("/p/6-fay-wray+5-ed-wood");
    expect(third.sharedCount).toBe(1);
  });

  it("throws when the generated data has no entry for a pairing", () => {
    const stale = { ...data };
    delete stale["3+4"];
    expect(() => buildGenreSections(pairings, stale, genres)).toThrow(/examples:refresh/);
  });

  it("throws when an entry is for different people", () => {
    const stale: GeneratedExamples = {
      ...data,
      "1+2": { ...data["1+2"], people: [data["1+2"].people[0], { id: 9, name: "Zed", profilePath: "/z.jpg" }] },
    };
    expect(() => buildGenreSections(pairings, stale, genres)).toThrow(/out of date/);
  });

  it("builds a card for every real pairing, in every real genre", () => {
    const sections = buildGenreSections();
    expect(sections.map((s) => s.genre.id)).toEqual(GENRES.map((g) => g.id));
    expect(sections.flatMap((s) => s.cards)).toHaveLength(EXAMPLE_PAIRINGS.length);
  });
});
