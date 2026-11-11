import { describe, expect, it } from "vitest";
import {
  buildClippingCards,
  clippingCountLabel,
  excerpt,
  pickTeaser,
  TEASER_MAX_CHARS,
} from "@/lib/clipping-cards";
import type { Clipping, ClippingsData } from "@/lib/clippings";
import type { CriticsData } from "@/lib/critics";
import type { GeneratedExamples } from "@/lib/examples";

const clipping = (overrides: Partial<Clipping> = {}): Clipping => ({
  id: "placeholder-quote",
  speaker: "Ada Lovelace",
  about: "Bo Peep",
  quote: "Placeholder quote.",
  film: null,
  said_year: null,
  publication: "Example Times",
  title: "Placeholder headline",
  date: "2000-01-01",
  url: "https://example.com/a",
  via: null,
  context: "Placeholder context.",
  secondhand: false,
  ...overrides,
});

const PEOPLE = [
  { id: 1, name: "Ada Lovelace" },
  { id: 2, name: "Bo Peep" },
] as const;

describe("excerpt", () => {
  it("returns a quote that fits as it is, whitespace folded", () => {
    expect(excerpt("  One.\n  Two. ", 40)).toBe("One. Two.");
  });

  it("keeps as many leading sentences as fit", () => {
    const quote =
      "It was the first picture we made together and it changed everything. " +
      "Nobody had asked for it. We simply went and did it, and it worked out fine.";
    expect(excerpt(quote, 100)).toBe(
      "It was the first picture we made together and it changed everything. Nobody had asked for it.",
    );
  });

  it("keeps a closing quotation mark with its sentence", () => {
    const quote = "He looked at me and said, ‘Hello, girls.’ I told him what we had just done, and I said no more.";
    expect(excerpt(quote, 50)).toBe("He looked at me and said, ‘Hello, girls.’");
  });

  it("cuts at a word with an ellipsis when the first sentence is too long", () => {
    const quote = "one two three four five six seven eight nine ten eleven twelve. Short.";
    const cut = excerpt(quote, 30);
    expect(cut.endsWith("…")).toBe(true);
    expect(Array.from(cut).length).toBeLessThanOrEqual(30);
    expect(cut).not.toMatch(/\s…$/);
  });

  it("cuts at a word when the only sentence that fits is too short to show", () => {
    const cut = excerpt("No! We bandy things around and it really is a collaboration, we go back and forth.", 60);
    expect(cut.startsWith("No! We bandy")).toBe(true);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("pickTeaser", () => {
  it("picks the shortest quote one of the pair said", () => {
    const teaser = pickTeaser(
      [
        clipping({ id: "a", quote: "A fairly long remark about the other one." }),
        clipping({ id: "b", speaker: "Bo Peep", quote: "Short one." }),
        clipping({ id: "c", quote: "Medium length remark." }),
      ],
      PEOPLE,
    );
    expect(teaser).toEqual({ quote: "Short one.", speaker: "Peep" });
  });

  it("names the speaker by family name, with the particles and overrides of shortName", () => {
    const people = [
      { id: 380, name: "Robert De Niro" },
      { id: 21684, name: "Bong Joon Ho" },
    ] as const;
    expect(pickTeaser([clipping({ speaker: "Robert De Niro" })], people)?.speaker).toBe("De Niro");
    expect(pickTeaser([clipping({ speaker: "Bong Joon Ho" })], people)?.speaker).toBe("Bong");
  });

  it("matches the speaker to the pair ignoring accents and case", () => {
    const people = [
      { id: 309, name: "Pedro Almodóvar" },
      { id: 955, name: "Penélope Cruz" },
    ] as const;
    expect(pickTeaser([clipping({ speaker: "PEDRO ALMODOVAR" })], people)?.speaker).toBe("Almodóvar");
  });

  it("keeps the order of the data when two quotes are as short", () => {
    const teaser = pickTeaser(
      [clipping({ id: "a", quote: "Same size A." }), clipping({ id: "b", speaker: "Bo Peep", quote: "Same size B." })],
      PEOPLE,
    );
    expect(teaser?.quote).toBe("Same size A.");
  });

  it("is the same on every call", () => {
    const clippings = [
      clipping({ quote: "First remark of some length." }),
      clipping({ speaker: "Bo Peep", quote: "Second remark of some length." }),
    ];
    expect(pickTeaser(clippings, PEOPLE)).toEqual(pickTeaser([...clippings], PEOPLE));
  });

  it("passes over a quote reported by someone else, and over a speaker outside the pair", () => {
    const teaser = pickTeaser(
      [
        clipping({ quote: "Reported.", secondhand: true }),
        clipping({ speaker: "Someone Else", quote: "Not them." }),
        clipping({ quote: "Their own words, which are longer." }),
      ],
      PEOPLE,
    );
    expect(teaser?.quote).toBe("Their own words, which are longer.");
  });

  it("falls back to a reported quote when every quote is", () => {
    const teaser = pickTeaser(
      [clipping({ quote: "Reported, longer remark.", secondhand: true }), clipping({ quote: "Reported.", secondhand: true })],
      PEOPLE,
    );
    expect(teaser?.quote).toBe("Reported.");
  });

  it("cuts the shortest quote short when none fits the limit", () => {
    const long = `${"A sentence that goes on for a while. ".repeat(6)}The end.`;
    const teaser = pickTeaser([clipping({ quote: long })], PEOPLE);
    expect(teaser).not.toBeNull();
    expect(Array.from(teaser!.quote).length).toBeLessThanOrEqual(TEASER_MAX_CHARS);
    expect(teaser!.quote.endsWith("while.")).toBe(true);
  });

  it("returns null when nobody in the pair has a quote", () => {
    expect(pickTeaser([], PEOPLE)).toBeNull();
    expect(pickTeaser([clipping({ speaker: "Someone Else" })], PEOPLE)).toBeNull();
  });
});

const person = (id: number, name: string) => ({ id, name, profilePath: `/${id}.jpg` });

const EXAMPLES: GeneratedExamples = {
  "1+2": { sharedCount: 3, people: [person(1, "Ada Lovelace"), person(2, "Bo Peep")], posters: [] },
  "3+4": { sharedCount: 3, people: [person(3, "Cy Twombly"), person(4, "Éva Zola")], posters: [] },
  "5+6": { sharedCount: 3, people: [person(5, "Álvaro Aalto"), person(6, "Di Prince")], posters: [] },
  "7+8": { sharedCount: 3, people: [person(7, "Fay Wray"), person(8, "Ed Wood")], posters: [] },
  "9+10": { sharedCount: 3, people: [person(9, "Gus Green"), person(10, "Hal Hill")], posters: [] },
  "1+3+4": {
    sharedCount: 3,
    people: [person(1, "Ada Lovelace"), person(3, "Cy Twombly"), person(4, "Éva Zola")],
    posters: [],
  },
};

const CLIPPINGS: ClippingsData = {
  "1+2": {
    pair: ["Ada Lovelace", "Bo Peep"],
    tmdb_ids: [1, 2],
    clippings: [clipping({ id: "q1" }), clipping({ id: "q2", speaker: "Bo Peep", quote: "Hi." })],
  },
  "3+4": { pair: ["Cy Twombly", "Éva Zola"], tmdb_ids: [3, 4], clippings: [clipping({ speaker: "Cy Twombly" })] },
  "5+6": { pair: ["Álvaro Aalto", "Di Prince"], tmdb_ids: [5, 6], clippings: [clipping({ speaker: "Di Prince" })] },
  "7+8": { pair: ["Fay Wray", "Ed Wood"], tmdb_ids: [7, 8], clippings: [] },
  // Not in the examples: left out.
  "11+12": { pair: ["Nobody Known", "Nobody Else"], tmdb_ids: [11, 12], clippings: [clipping()] },
};

const CRITICS: CriticsData = {
  "9+10": {
    pair: ["Gus Green", "Hal Hill"],
    tmdb_ids: [9, 10],
    critics: [],
    reading: [
      { title: "A long read", author: null, publication: "Review", date: "2020", url: "https://example.com/r", paywalled: false },
    ],
  },
  "3+4": {
    pair: ["Cy Twombly", "Éva Zola"],
    tmdb_ids: [3, 4],
    critics: [
      {
        id: "critic-a",
        critic: "Someone",
        publication: "Review",
        via: null,
        title: "Essay",
        date: "2020",
        url: "https://example.com/e",
        kind: "essay",
        quote: "A line.",
      },
    ],
    reading: [],
  },
};

describe("buildClippingCards", () => {
  const cards = buildClippingCards(CLIPPINGS, CRITICS, EXAMPLES);

  it("lists every two-person pairing that has something for the Clippings tab, and nothing else", () => {
    // 7+8 has no clippings, 11+12 is not in the examples, 1+3+4 is not a pair.
    expect(cards.map((card) => card.people.map((p) => p.id))).toEqual([
      [5, 6], // Aalto (the accent does not sort it apart)
      [9, 10], // Green: reading only
      [1, 2], // Lovelace
      [3, 4], // Twombly
    ]);
  });

  it("is alphabetical by the first person's family name", () => {
    expect(cards.map((card) => card.people[0].name)).toEqual(["Álvaro Aalto", "Gus Green", "Ada Lovelace", "Cy Twombly"]);
  });

  it("breaks a tie on the first family name with the second person's", () => {
    const examples: GeneratedExamples = {
      "1+2": { sharedCount: 1, people: [person(1, "Ann Same"), person(2, "Zed Zulu")], posters: [] },
      "1+3": { sharedCount: 1, people: [person(1, "Ann Same"), person(3, "Bea Bravo")], posters: [] },
    };
    const clippings: ClippingsData = {
      "1+2": { pair: ["Ann Same", "Zed Zulu"], tmdb_ids: [1, 2], clippings: [clipping({ speaker: "Ann Same" })] },
      "1+3": { pair: ["Ann Same", "Bea Bravo"], tmdb_ids: [1, 3], clippings: [clipping({ speaker: "Ann Same" })] },
    };
    expect(buildClippingCards(clippings, {}, examples).map((card) => card.people[1].name)).toEqual(["Bea Bravo", "Zed Zulu"]);
  });

  it("links to the pair's canonical slug, opened on the Clippings tab", () => {
    const lovelace = cards.find((card) => card.people[0].id === 1)!;
    expect(lovelace.href).toBe("/p/1-ada-lovelace+2-bo-peep?view=clippings");
    const aalto = cards.find((card) => card.people[0].id === 5)!;
    expect(aalto.href).toBe("/p/5-alvaro-aalto+6-di-prince?view=clippings");
  });

  it("carries the pairing's names and photos in the pairing's order", () => {
    expect(cards.find((card) => card.people[0].id === 1)!.people).toEqual([
      { id: 1, name: "Ada Lovelace", profilePath: "/1.jpg" },
      { id: 2, name: "Bo Peep", profilePath: "/2.jpg" },
    ]);
  });

  it("gives each pair the shortest quote its people said, by family name", () => {
    const lovelace = cards.find((card) => card.people[0].id === 1)!;
    expect(lovelace.teaser).toEqual({ quote: "Hi.", speaker: "Peep" });
  });

  it("counts the pair's clippings and the critics' quotes", () => {
    expect(cards.find((card) => card.people[0].id === 1)!.count).toBe(2);
    expect(cards.find((card) => card.people[0].id === 3)!.count).toBe(2); // 1 clipping + 1 critic's quote
  });

  it("gives a pair with only reading no teaser and no count", () => {
    const green = cards.find((card) => card.people[0].id === 9)!;
    expect(green.teaser).toBeNull();
    expect(green.count).toBe(0);
  });

  it("builds the same list every time", () => {
    expect(buildClippingCards(CLIPPINGS, CRITICS, EXAMPLES)).toEqual(cards);
  });
});

describe("buildClippingCards with the real data", () => {
  const cards = buildClippingCards();

  it("has a card with a teaser and a count for every pair that has clippings", () => {
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.href).toMatch(/^\/p\/\d+-[a-z0-9-]+\+\d+-[a-z0-9-]+\?view=clippings$/);
      expect(card.count).toBeGreaterThan(0);
      expect(card.teaser?.quote.length).toBeGreaterThan(0);
      expect(Array.from(card.teaser!.quote).length).toBeLessThanOrEqual(TEASER_MAX_CHARS);
      expect(card.teaser!.speaker.length).toBeGreaterThan(0);
    }
  });

  it("lists each pair once", () => {
    expect(new Set(cards.map((card) => card.href)).size).toBe(cards.length);
  });
});

describe("clippingCountLabel", () => {
  it("counts quotes", () => {
    expect(clippingCountLabel(1)).toBe("1 quote");
    expect(clippingCountLabel(10)).toBe("10 quotes");
  });

  it("falls back to reading for a pair with only pieces to read", () => {
    expect(clippingCountLabel(0)).toBe("Further reading");
  });
});
