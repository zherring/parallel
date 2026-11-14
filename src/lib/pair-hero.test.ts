import { describe, expect, it } from "vitest";
import type { Clipping, ClippingsPerson } from "@/lib/clippings";
import { getPairClippingSet } from "@/lib/clippings";
import { EXAMPLE_PAIRINGS } from "@/lib/examples";
import { getHeroNote } from "@/lib/pair-hero-note";
import { getPairDescription } from "@/lib/pair-descriptions";
import {
  CHIP_LIMIT,
  CHIP_MIN_WIDTH,
  COLLAPSE_PX,
  QUOTE_CHARS,
  SOLO_ROLE_LIMIT,
  activeYears,
  bestKnownChips,
  featuredClipping,
  fitChipCount,
  fitsHero,
  heroBioText,
  heroCollapsed,
  heroSubtitle,
  mainRole,
  mainRoleLabels,
  mainRoles,
  orderChips,
  pickHeroNote,
  quoteHref,
  soloRolesLabel,
  splitLastWord,
  visibleChips,
  type HeroChip,
  type RankedFilm,
} from "@/lib/pair-hero";
import type { Credit, Film, PersonSummary, PersonTimeline, RoleKey } from "@/lib/types";

const pair = [
  { id: 309, name: "Pedro Almodóvar" },
  { id: 955, name: "Penélope Cruz" },
] as const satisfies readonly [ClippingsPerson, ClippingsPerson];

const clipping = (id: string, speaker: string, about: string, extra: Partial<Clipping> = {}): Clipping => ({
  id,
  speaker,
  about,
  quote: `${speaker} on ${about}`,
  film: null,
  said_year: 2000,
  publication: "Paper",
  title: "Headline",
  date: "2000",
  url: "https://example.com",
  via: null,
  context: "",
  secondhand: false,
  ...extra,
});

describe("featuredClipping", () => {
  it("is the first quote of one of the pair on the other, in the order the clippings come in", () => {
    const set = {
      people: pair,
      clippings: [clipping("a", "Penélope Cruz", "Pedro Almodóvar"), clipping("b", "Pedro Almodóvar", "Penélope Cruz")],
    };
    expect(featuredClipping(set)?.id).toBe("a");
  });

  it("passes over a quote whose speaker is neither of the pair", () => {
    const set = {
      people: pair,
      clippings: [clipping("a", "Someone Else", "Penélope Cruz"), clipping("b", "Pedro Almodóvar", "Penélope Cruz")],
    };
    expect(featuredClipping(set)?.id).toBe("b");
  });

  it("is null without a pair, without clippings, or with none by the pair", () => {
    expect(featuredClipping(null)).toBeNull();
    expect(featuredClipping({ people: pair, clippings: [] })).toBeNull();
    expect(featuredClipping({ people: pair, clippings: [clipping("a", "Someone Else", "Penélope Cruz")] })).toBeNull();
  });

  const sentence = (length: number) => `${"word ".repeat(Math.ceil(length / 5))}`.trim().slice(0, length - 1) + ".";

  it("skips a quote too long to be set whole (more than QUOTE_CHARS) for the next one that fits", () => {
    const set = {
      people: pair,
      clippings: [
        clipping("long", "Penélope Cruz", "Pedro Almodóvar", { quote: sentence(QUOTE_CHARS + 1) }),
        clipping("short", "Pedro Almodóvar", "Penélope Cruz", { quote: "She is my muse." }),
      ],
    };
    expect(featuredClipping(set)?.id).toBe("short");
  });

  it("takes a quote of exactly QUOTE_CHARS, counting characters (not UTF-16 units) with the whitespace folded as the quote is set", () => {
    const exact = sentence(QUOTE_CHARS);
    expect(Array.from(exact)).toHaveLength(QUOTE_CHARS);
    expect(featuredClipping({ people: pair, clippings: [clipping("exact", "Penélope Cruz", "Pedro Almodóvar", { quote: exact })] })?.id).toBe("exact");
    // Runs of whitespace and the ends are not counted: this is QUOTE_CHARS once folded.
    expect(fitsHero(`  ${exact.replace(" ", "   ")}\n`)).toBe(true);
    // An emoji is one character, though two UTF-16 units.
    expect(fitsHero(`${"a".repeat(QUOTE_CHARS - 1)}\u{1F3AC}`)).toBe(true);
    expect(fitsHero(`${"a".repeat(QUOTE_CHARS)}\u{1F3AC}`)).toBe(false);
  });

  it("skips a quote that ends in an ellipsis in the data (an excerpt that trails off), in either spelling", () => {
    for (const ending of ["...", "\u2026", "\u2026\u201D", "\u2026\"", ".... ", "...)"]) {
      const set = {
        people: pair,
        clippings: [
          clipping("excerpt", "Penélope Cruz", "Pedro Almodóvar", { quote: `He gave me everything${ending}` }),
          clipping("whole", "Pedro Almodóvar", "Penélope Cruz", { quote: "She is my muse." }),
        ],
      };
      expect(featuredClipping(set)?.id).toBe("whole");
    }
    // An ellipsis inside a quote is not an excerpt that stops there.
    expect(fitsHero("Well... she is my muse.")).toBe(true);
  });

  it("is null when no quote of the pair fits whole", () => {
    const set = {
      people: pair,
      clippings: [
        clipping("long", "Penélope Cruz", "Pedro Almodóvar", { quote: sentence(QUOTE_CHARS + 50) }),
        clipping("excerpt", "Pedro Almodóvar", "Penélope Cruz", { quote: "He gave me everything\u2026" }),
      ],
    };
    expect(featuredClipping(set)).toBeNull();
  });
});

describe("pickHeroNote: the fallback chain", () => {
  const set = { people: pair, clippings: [clipping("q1", "Pedro Almodóvar", "Penélope Cruz", { quote: "She is my muse." })] };
  const description = { text: "Eight films together.", sources: [{ title: "Interview", url: "https://example.com/i" }] };
  const blurb = "A director and an actor.";

  it("shows the featured quote first, whatever else the pair has", () => {
    expect(pickHeroNote({ clippings: set, description, blurb })).toEqual({
      kind: "quote",
      id: "q1",
      quote: "She is my muse.",
      speaker: "Pedro Almodóvar",
      about: "Penélope Cruz",
    });
  });

  it("falls back to the curated description, with its sources, when there is no quote", () => {
    expect(pickHeroNote({ clippings: null, description, blurb })).toEqual({ kind: "description", ...description });
    // Clippings that are all by someone else are no quote of the pair's.
    const strangers = { people: pair, clippings: [clipping("x", "Someone Else", "Penélope Cruz")] };
    expect(pickHeroNote({ clippings: strangers, description, blurb })?.kind).toBe("description");
  });

  it("falls back to the blurb of a curated pair when there is neither", () => {
    expect(pickHeroNote({ clippings: null, description: null, blurb })).toEqual({ kind: "blurb", text: blurb });
  });

  it("shows nothing when the pair has none of the three, and nothing is made up from a blank blurb", () => {
    expect(pickHeroNote({ clippings: null, description: null, blurb: null })).toBeNull();
    expect(pickHeroNote({ clippings: null, description: null, blurb: "   " })).toBeNull();
  });

  it("shows the first quote that fits whole, and the link under it is that quote's", () => {
    const quotes = {
      people: pair,
      clippings: [
        clipping("too-long", "Pedro Almodóvar", "Penélope Cruz", { quote: "x".repeat(QUOTE_CHARS + 1) }),
        clipping("trails-off", "Penélope Cruz", "Pedro Almodóvar", { quote: "He taught me everything..." }),
        clipping("whole", "Pedro Almodóvar", "Penélope Cruz", { quote: "She is my muse." }),
        clipping("later", "Penélope Cruz", "Pedro Almodóvar", { quote: "He is my director." }),
      ],
    };
    expect(pickHeroNote({ clippings: quotes, description, blurb })).toEqual({
      kind: "quote",
      id: "whole",
      quote: "She is my muse.",
      speaker: "Pedro Almodóvar",
      about: "Penélope Cruz",
    });
    expect(quoteHref("/p/x", "", "whole")).toContain("quote=whole");
  });

  it("falls back to the description, then the blurb, then nothing, when no artist quote fits whole", () => {
    const unfit = {
      people: pair,
      clippings: [
        clipping("too-long", "Pedro Almodóvar", "Penélope Cruz", { quote: "x".repeat(QUOTE_CHARS + 1) }),
        clipping("trails-off", "Penélope Cruz", "Pedro Almodóvar", { quote: "He taught me everything\u2026" }),
      ],
    };
    expect(pickHeroNote({ clippings: unfit, description, blurb })).toEqual({ kind: "description", ...description });
    expect(pickHeroNote({ clippings: unfit, description: null, blurb })).toEqual({ kind: "blurb", text: blurb });
    expect(pickHeroNote({ clippings: unfit, description: null, blurb: null })).toBeNull();
  });

  it("never shows a quote cut short, on the real data: a quote note is whole, and any pair left without one has none that fits", () => {
    for (const entry of EXAMPLE_PAIRINGS) {
      const ids = entry.people.map((p) => p.id);
      const note = getHeroNote(ids);
      if (note?.kind === "quote") expect(fitsHero(note.quote)).toBe(true);
      const set = getPairClippingSet(ids);
      if (set && note?.kind !== "quote") {
        expect(set.clippings.filter((c) => c.speaker === set.people[0].name || c.speaker === set.people[1].name).some((c) => fitsHero(c.quote))).toBe(false);
      }
    }
  });

  it("works on the real data (getHeroNote): a pair with clippings gets its quote, a curated pair without gets its blurb, any other pair gets nothing", () => {
    const withQuotes = EXAMPLE_PAIRINGS.find((entry) => getPairClippingSet(entry.people.map((p) => p.id)));
    const ids = (entry: (typeof EXAMPLE_PAIRINGS)[number]) => entry.people.map((p) => p.id);
    const withDescription = EXAMPLE_PAIRINGS.find((entry) => entry.people.length === 2 && !getPairClippingSet(ids(entry)) && getPairDescription(ids(entry)));
    const withoutQuotes = EXAMPLE_PAIRINGS.find(
      (entry) => entry.people.length === 2 && !getPairClippingSet(ids(entry)) && !getPairDescription(ids(entry)),
    );
    expect(withQuotes).toBeDefined();
    expect(withDescription).toBeDefined();
    // Once every pair has quotes or a description there is no real pair left that falls back to its blurb; that path is
    // covered by pickHeroNote above, so it is only checked here while such a pair exists.
    // A curated pair with a description and no quote shows the description (not the blurb it also has).
    expect(getHeroNote(ids(withDescription!))).toMatchObject({ kind: "description", text: getPairDescription(ids(withDescription!))!.text });
    const quoted = getHeroNote(withQuotes!.people.map((p) => p.id));
    expect(quoted?.kind).toBe("quote");
    // The id is the first artist quote of the pair as the Quotes view lists it.
    const set = getPairClippingSet(withQuotes!.people.map((p) => p.id));
    expect(quoted).toMatchObject({ id: featuredClipping(set)!.id });
    if (withoutQuotes) {
      expect(getHeroNote(ids(withoutQuotes))).toEqual({ kind: "blurb", text: withoutQuotes.blurb });
    }
    // The order the ids come in does not matter.
    expect(getHeroNote(ids(withDescription!).reverse())).toEqual(getHeroNote(ids(withDescription!)));
    expect(getHeroNote([1, 2])).toBeNull();
    expect(getHeroNote([])).toBeNull();
  });
});

describe("heroBioText", () => {
  const sentence = (words: number, seed = "word") => `${Array.from({ length: words }, (_, index) => `${seed}${index}`).join(" ")}.`;

  it("is whole sentences from the start, as many as fit within QUOTE_CHARS, and the text as it is when all of it fits", () => {
    const short = "Gene Wilder was an American actor. He began on the stage.";
    expect(heroBioText(short)).toBe(short);
    const first = `Jerome Silberman, known as Gene Wilder, was an American actor, director and author. ${sentence(8)}`;
    const second = "Second Sentence is here and it is a little longer than the first one was.";
    const third = `Third ${"filler ".repeat(40)}ends here.`;
    const text = `${first} ${second} ${third}`;
    expect(first.length + second.length + 1).toBeLessThanOrEqual(QUOTE_CHARS);
    expect(first.length + second.length + third.length).toBeGreaterThan(QUOTE_CHARS);
    const note = heroBioText(text)!;
    // The first two sentences, whole, and none of the third: no ellipsis, never a sentence cut.
    expect(note).toBe(`${first} ${second}`);
    expect(note.length).toBeLessThanOrEqual(QUOTE_CHARS);
    expect(note).not.toContain("\u2026");
    expect(note.endsWith(".")).toBe(true);
  });

  it("never runs over QUOTE_CHARS, and keeps to the limit it is given", () => {
    const text = Array.from({ length: 30 }, (_, index) => `Sentence number ${index + 1} says something quite ordinary about the career.`).join(" ");
    // Each sentence is under 70 characters, so every limit here holds at least one whole one.
    for (const limit of [80, 120, QUOTE_CHARS, 400]) {
      const note = heroBioText(text, limit)!;
      expect(note.length).toBeLessThanOrEqual(limit);
      expect(note.endsWith(".")).toBe(true);
    }
    expect(heroBioText(text)!.length).toBeLessThanOrEqual(QUOTE_CHARS);
  });

  it("folds the paragraphs and the non-breaking spaces TMDB sends into single spaces", () => {
    expect(heroBioText("Melvin Brooks\u00a0(n\u00e9\u00a0Kaminsky) is an American actor.\n\nHe is a comedian.")).toBe("Melvin Brooks (n\u00e9 Kaminsky) is an American actor. He is a comedian.");
  });

  it("does not take an abbreviation or an initial for the end of a sentence", () => {
    const note = heroBioText("Dr. J. R. Smith was born in Ohio. He later moved to Paris where he made seven films that were all very well received by the critics of the day.", 60);
    expect(note).toBe("Dr. J. R. Smith was born in Ohio.");
  });

  it("cuts a first sentence that is longer than the limit at a word, with an ellipsis: the only time it does", () => {
    const long = `${"Alphabetically ".repeat(30)}ordered.`;
    const note = heroBioText(long)!;
    expect(note.endsWith("\u2026")).toBe(true);
    expect(note.length).toBeLessThanOrEqual(QUOTE_CHARS);
    // At a word: what is before the ellipsis is whole words of the text.
    expect(long.startsWith(note.slice(0, -1))).toBe(true);
    expect(note.slice(0, -1).split(" ").every((word) => word === "Alphabetically")).toBe(true);
    // Nothing else in the note is an ellipsis.
    expect(note.slice(0, -1)).not.toContain("\u2026");
  });

  it("leaves no dangling comma or dash before the ellipsis", () => {
    const text = `${"word, ".repeat(60)}and so on.`;
    const note = heroBioText(text)!;
    expect(note).toMatch(/[a-z]\u2026$/);
  });

  it("is null for no biography, an empty or blank one", () => {
    expect(heroBioText(null)).toBeNull();
    expect(heroBioText(undefined)).toBeNull();
    expect(heroBioText("")).toBeNull();
    expect(heroBioText("   \n\n  ")).toBeNull();
  });

  it("takes off the credit TMDB copies from Wikipedia, at the end and at the start, and is null when that is all there is", () => {
    const credit = "Description above from the Wikipedia article\u00a0Christopher Guest, licensed under CC-BY-SA, full list of contributors on Wikipedia.";
    expect(heroBioText(`Christopher Guest is an American actor.\n\n${credit}`)).toBe("Christopher Guest is an American actor.");
    expect(heroBioText(`Christopher Guest is an American actor. ${credit}`)).toBe("Christopher Guest is an American actor.");
    expect(heroBioText("From Wikipedia, the free encyclopedia\n\nChristopher Guest is an American actor.")).toBe("Christopher Guest is an American actor.");
    expect(heroBioText("From Wikipedia. Christopher Guest is an American actor. (Source: Wikipedia)")).toBe("Christopher Guest is an American actor.");
    expect(heroBioText(credit)).toBeNull();
    expect(heroBioText(`From Wikipedia, the free encyclopedia\n\n${credit}`)).toBeNull();
  });

  it("leaves a mention of Wikipedia in the sentences themselves", () => {
    const text = "She worked on Wikipedia, the encyclopedia, as an editor before she made films.";
    expect(heroBioText(text)).toBe(text);
  });
});

describe("pickHeroNote: the biography of one person", () => {
  const bio = "Gene Wilder was an American actor. He began on the stage.";

  it("is the note when there is no quote, description or blurb: the start of the biography, whole", () => {
    expect(pickHeroNote({ clippings: null, description: null, blurb: null, biography: bio })).toEqual({ kind: "bio", text: bio });
  });

  it("is cut as heroBioText cuts it, and trails no credit line", () => {
    const long = `${bio} ${"More sentences follow here and say nothing special. ".repeat(10)}`;
    const note = pickHeroNote({ clippings: null, description: null, blurb: null, biography: `${long}\n\nDescription above from the Wikipedia article Gene Wilder, licensed under CC-BY-SA, full list of contributors on Wikipedia.` });
    expect(note).toEqual({ kind: "bio", text: heroBioText(long) });
    expect(note?.kind === "bio" && note.text.length).toBeLessThanOrEqual(QUOTE_CHARS);
  });

  it("comes after every note a pair can have", () => {
    const quotes = { people: pair, clippings: [clipping("a", "Penélope Cruz", "Pedro Almodóvar")] };
    const description = { text: "A description.", sources: [] };
    expect(pickHeroNote({ clippings: quotes, description, blurb: "A blurb.", biography: bio })?.kind).toBe("quote");
    expect(pickHeroNote({ clippings: null, description, blurb: "A blurb.", biography: bio })?.kind).toBe("description");
    expect(pickHeroNote({ clippings: null, description: null, blurb: "A blurb.", biography: bio })?.kind).toBe("blurb");
  });

  it("is nothing without a biography, and without one that says more than a credit line", () => {
    expect(pickHeroNote({ clippings: null, description: null, blurb: null })).toBeNull();
    expect(pickHeroNote({ clippings: null, description: null, blurb: null, biography: null })).toBeNull();
    expect(pickHeroNote({ clippings: null, description: null, blurb: null, biography: "" })).toBeNull();
    expect(pickHeroNote({ clippings: null, description: null, blurb: null, biography: "Description above from the Wikipedia article X, licensed under CC-BY-SA." })).toBeNull();
  });

  it("is what getHeroNote gives a page of one person, and nobody else: two or more people have no one biography", () => {
    expect(getHeroNote([3460], bio)).toEqual({ kind: "bio", text: bio });
    expect(getHeroNote([3460])).toBeNull();
    expect(getHeroNote([3460, 14639], bio)).toEqual(getHeroNote([3460, 14639]));
    expect(getHeroNote([1, 2, 3], bio)).toBeNull();
  });
});

describe("quoteHref", () => {
  it("opens the Quotes on the quote, and keeps the period", () => {
    expect(quoteHref("/p/a+b", "", "q1")).toBe("/p/a+b?view=clippings&quote=q1");
    expect(quoteHref("/p/a+b", "?from=1990&to=2000", "q1")).toBe("/p/a+b?from=1990&to=2000&view=clippings&quote=q1");
  });

  it("leaves the view it comes from behind, and another quote", () => {
    expect(quoteHref("/p/a+b", "?view=depth&quote=old", "q2")).toBe("/p/a+b?view=clippings&quote=q2");
    expect(quoteHref("/p/a+b", "view=table&sort=year&dir=asc", "q2")).toBe("/p/a+b?view=clippings&sort=year&dir=asc&quote=q2");
  });
});

const credit = (role: RoleKey, minor = false): Credit => ({ role, job: role, minor });
const film = (id: number, roles: (RoleKey | [RoleKey, boolean])[]): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${2000 + id}-01-01`,
  year: 2000 + id,
  posterPath: null,
  voteCount: 0,
  credits: roles.map((entry) => (Array.isArray(entry) ? credit(entry[0], entry[1]) : credit(entry))),
  minor: false,
});
const person = (id: number, name: string): PersonSummary => ({ id, name, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null });
const timeline = (id: number, films: Film[]): PersonTimeline => ({ person: person(id, `Person ${id}`), films });

describe("mainRole", () => {
  it("is the role on the most films", () => {
    expect(mainRole([["actor"], ["actor"], ["actor"], ["editor"]])).toBe("actor");
    expect(mainRole([["writer"], ["writer"], ["editor"]])).toBe("editor");
  });

  it("prefers the director when another role is nearly as common", () => {
    // Directed 12, produced 15 (producing films they did not direct): still the director.
    const films: RoleKey[][] = [...Array(12).fill(["director", "producer"]), ...Array(3).fill(["producer"])];
    expect(mainRole(films)).toBe("director");
  });

  it("does not make a rare role the main one, however high it ranks", () => {
    const films: RoleKey[][] = [...Array(10).fill(["actor"]), ["director"]];
    expect(mainRole(films)).toBe("actor");
  });

  it("counts a film once for a role it credits twice", () => {
    expect(mainRole([["writer", "writer", "writer"], ["editor"], ["editor"]])).toBe("editor");
  });

  it("breaks a tie by the priority a visitor would name them in", () => {
    expect(mainRole([["director", "writer", "producer", "actor"]])).toBe("director");
    expect(mainRole([["writer", "producer", "actor"]])).toBe("actor");
    expect(mainRole([["writer", "producer"]])).toBe("writer");
    expect(mainRole([["cinematographer", "writer"]])).toBe("cinematographer");
  });

  it("is null without a credit", () => {
    expect(mainRole([])).toBeNull();
    expect(mainRole([[], []])).toBeNull();
  });
});

describe("mainRoles", () => {
  it("is every role on at least half as many films as the most common, the one a visitor would name first leading", () => {
    // Actor on 10 films, director on 6, writer on 4, producer on 5: the half of 10 is 5.
    const films = [
      ...Array.from({ length: 6 }, () => ["actor", "director"] as RoleKey[]),
      ...Array.from({ length: 4 }, () => ["actor", "writer"] as RoleKey[]),
      ...Array.from({ length: 5 }, () => ["producer"] as RoleKey[]),
    ];
    expect(mainRoles(films, 4)).toEqual(["director", "actor", "producer"]);
    expect(mainRoles(films, 2)).toEqual(["director", "actor"]);
    expect(mainRoles(films)).toEqual(["director"]);
    expect(mainRole(films)).toBe("director");
  });

  it("is one role for a person who has one, and nothing for a person with no credit", () => {
    expect(mainRoles([["actor"], ["actor"], ["actor"], ["writer"]], 2)).toEqual(["actor"]);
    expect(mainRoles([], 2)).toEqual([]);
    expect(mainRoles([[], []], 2)).toEqual([]);
  });
});

describe("soloRolesLabel", () => {
  it("names a person's main roles over the films shown, as the people pill words them", () => {
    const wilder = [film(1, ["actor"]), film(2, ["actor"]), film(3, ["actor", "writer"]), film(4, ["actor"])];
    expect(soloRolesLabel(wilder, false)).toBe("Actor");
    const brooks = [film(1, ["director", "writer", "actor"]), film(2, ["director", "writer", "actor"]), film(3, ["actor"])];
    // Director, then the actor ahead of the writer (the order a visitor would name them in): the writer is on as many films as the director, and is the third.
    expect(soloRolesLabel(brooks, false)).toBe("Director, Actor");
    expect(SOLO_ROLE_LIMIT).toBe(2);
    expect(soloRolesLabel(brooks, false, 3)).toBe("Director, Actor, Writer");
  });

  it("counts minor credits only when asked to, and is empty for no credit to go by", () => {
    const cameos = [film(1, [["actor", true]]), film(2, [["actor", true]])];
    expect(soloRolesLabel(cameos, false)).toBe("");
    expect(soloRolesLabel(cameos, true)).toBe("Actor");
    expect(soloRolesLabel([], false)).toBe("");
  });
});

describe("activeYears", () => {
  const year = (value: number, date = `${value}-06-01`) => ({ year: value, releaseDate: date });

  it("is the first film's year to the last one's", () => {
    expect(activeYears([year(2005), year(1966), year(1984)], "2026-11-11")).toBe("1966–2005");
  });

  it("is just the year for one year", () => {
    expect(activeYears([year(1999), year(1999, "1999-12-31")], "2026-11-11")).toBe("1999");
  });

  it("stops at the last film that is out: an announced one is not a year of work yet", () => {
    expect(activeYears([year(1990), year(2010), year(2030)], "2026-11-11")).toBe("1990–2010");
    // A film out today counts.
    expect(activeYears([year(1990), year(2026, "2026-11-11")], "2026-11-11")).toBe("1990–2026");
  });

  it("is the span of the films there are when none is out yet, and empty for none", () => {
    expect(activeYears([year(2030), year(2031)], "2026-11-11")).toBe("2030–2031");
    expect(activeYears([], "2026-11-11")).toBe("");
  });
});

describe("mainRoleLabels", () => {
  const nolan = timeline(1, [film(1, ["director", "writer", "producer"]), film(2, ["director", "writer"]), film(3, ["producer"])]);
  const hoytema = timeline(2, [film(1, ["cinematographer"]), film(2, ["cinematographer"]), film(4, ["editor"])]);

  it("names each person's main role over the films they made together, in the order of the people", () => {
    expect(mainRoleLabels([nolan, hoytema], new Set([1, 2]), false)).toEqual(["Director", "Cinematographer"]);
  });

  it("looks only at the films together, not at the rest of a career", () => {
    // Film 4 (an editor credit of Hoytema's) and film 3 (a producer credit of Nolan's) are not made together.
    const apart = timeline(3, [film(1, ["actor"]), ...Array.from({ length: 5 }, (_, index) => film(10 + index, ["director"]))]);
    expect(mainRoleLabels([apart, nolan], new Set([1]), false)).toEqual(["Actor", "Director"]);
  });

  it("counts minor credits only when asked to", () => {
    const cameo = timeline(4, [film(1, [["actor", true]]), film(2, [["actor", true]])]);
    expect(mainRoleLabels([cameo], new Set([1, 2]), false)).toEqual([""]);
    expect(mainRoleLabels([cameo], new Set([1, 2]), true)).toEqual(["Actor"]);
  });

  it("goes by all of a person's films for a page of one person, and for a pair with no film together", () => {
    expect(mainRoleLabels([nolan], null, false)).toEqual(["Director"]);
    expect(mainRoleLabels([nolan, hoytema], new Set(), false)).toEqual(["Director", "Cinematographer"]);
  });
});

describe("heroSubtitle", () => {
  it("joins the two roles of a pair with × and ends with the films together", () => {
    expect(heroSubtitle(["Director", "Cinematographer"], 5, true)).toBe("Director × Cinematographer · 5 films");
    expect(heroSubtitle(["Director", "Editor"], 1, true)).toBe("Director × Editor · 1 film");
  });

  it("is the role and the films for one person", () => {
    expect(heroSubtitle(["Director"], 30, false)).toBe("Director · 30 films");
    expect(heroSubtitle(["Actor"], 1, false)).toBe("Actor · 1 film");
  });

  it("puts the years a person has been active between the roles and the films", () => {
    expect(heroSubtitle(["Actor"], 31, false, "1966–2005")).toBe("Actor · 1966–2005 · 31 films");
    expect(heroSubtitle(["Director, Actor"], 12, false, "1999")).toBe("Director, Actor · 1999 · 12 films");
    expect(heroSubtitle([""], 3, false, "1999–2004")).toBe("1999–2004 · 3 films");
    expect(heroSubtitle([], 0, false, "")).toBe("0 films");
  });

  it("joins three people, and four, the same way", () => {
    expect(heroSubtitle(["Director", "Writer", "Actor"], 4, true)).toBe("Director × Writer × Actor · 4 films");
    expect(heroSubtitle(["Director", "Writer", "Actor", "Composer"], 2, true)).toBe("Director × Writer × Actor × Composer · 2 films");
  });

  it("keeps the same role twice, in the order of the names: Actor × Actor", () => {
    expect(heroSubtitle(["Actor", "Actor"], 4, true)).toBe("Actor × Actor · 4 films");
  });

  it("says so when a pair has no film together, but not for one person", () => {
    expect(heroSubtitle(["Director", "Editor"], 0, true)).toBe("Director × Editor · No films together");
    expect(heroSubtitle(["Director"], 0, false)).toBe("Director · 0 films");
  });

  it("leaves out a person with no role to name, and is just the films when nobody has one", () => {
    expect(heroSubtitle(["Director", ""], 3, true)).toBe("Director · 3 films");
    expect(heroSubtitle(["", ""], 3, true)).toBe("3 films");
    expect(heroSubtitle([], 3, false)).toBe("3 films");
  });
});

const chip = (id: number, releaseDate: string, title = `Film ${id}`): HeroChip => ({ id, title, year: Number(releaseDate.slice(0, 4)), releaseDate });
const chips = (count: number): HeroChip[] => Array.from({ length: count }, (_, index) => chip(index + 1, `${1990 + index}-06-01`));

describe("orderChips", () => {
  it("puts the earliest release first", () => {
    const ordered = orderChips([chip(3, "2005-01-01"), chip(1, "1990-05-05"), chip(2, "1999-12-31")]);
    expect(ordered.map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it("orders films of the same day by title, then by id, so that the order never wobbles", () => {
    const day = "2001-03-03";
    const ordered = orderChips([chip(9, day, "B"), chip(8, day, "A"), chip(7, day, "B")]);
    expect(ordered.map((c) => c.id)).toEqual([8, 7, 9]);
  });

  it("is a copy that keeps only what a chip needs", () => {
    const input = [{ ...chip(1, "2000-01-01"), posterPath: "/x.jpg", credits: [] }];
    const [first] = orderChips(input);
    expect(first).toEqual(chip(1, "2000-01-01"));
    expect(Object.keys(first)).toEqual(["id", "title", "year", "releaseDate"]);
  });
});

describe("bestKnownChips", () => {
  const ranked = (id: number, voteCount: number, releaseDate: string, title = `Film ${id}`): RankedFilm => ({ ...chip(id, releaseDate, title), voteCount });

  it("puts the film with the most TMDB votes first", () => {
    const films = [ranked(1, 120, "1990-01-01"), ranked(2, 9000, "2004-01-01"), ranked(3, 560, "1975-01-01"), ranked(4, 40, "2010-01-01")];
    expect(bestKnownChips(films).map((c) => c.id)).toEqual([2, 3, 1, 4]);
  });

  it("shows the three best known first, then the rest still in the order of their fame", () => {
    const films = Array.from({ length: 8 }, (_, index) => ranked(index + 1, (index * 37) % 11 * 100, `${1980 + index}-06-01`));
    const { shown, hidden } = visibleChips(bestKnownChips(films), false);
    const byVotes = [...films].sort((a, b) => b.voteCount - a.voteCount || a.id - b.id);
    expect(shown.map((c) => c.id)).toEqual(byVotes.slice(0, 3).map((c) => c.id));
    expect(hidden).toBe(5);
  });

  it("puts films with as many votes in release order, then by title and id, so that the order never wobbles", () => {
    const films = [ranked(9, 100, "2001-03-03", "B"), ranked(8, 100, "2001-03-03", "A"), ranked(7, 100, "2001-03-03", "B"), ranked(6, 100, "1999-01-01", "Z")];
    expect(bestKnownChips(films).map((c) => c.id)).toEqual([6, 8, 7, 9]);
    // Films with no votes at all (the data has none) fall back to release order.
    expect(bestKnownChips([ranked(1, 0, "2005-01-01"), ranked(2, 0, "1990-01-01"), ranked(3, 0, "1999-01-01")]).map((c) => c.id)).toEqual([2, 3, 1]);
  });

  it("is a copy that keeps only what a chip needs, and empty for no films", () => {
    const input = [ranked(1, 500, "2000-01-01")];
    const [first] = bestKnownChips(input);
    expect(first).toEqual(chip(1, "2000-01-01"));
    expect(Object.keys(first)).toEqual(["id", "title", "year", "releaseDate"]);
    expect(input[0].voteCount).toBe(500);
    expect(bestKnownChips([])).toEqual([]);
  });
});

describe("visibleChips", () => {
  it("shows all of up to three films, with no more chip", () => {
    for (const count of [0, 1, CHIP_LIMIT]) expect(visibleChips(chips(count), false)).toEqual({ shown: chips(count), hidden: 0 });
  });

  it("shows the first three and counts the rest for '+N more'", () => {
    const all = chips(CHIP_LIMIT + 1);
    expect(visibleChips(all, false)).toEqual({ shown: all.slice(0, CHIP_LIMIT), hidden: 1 });
    expect(visibleChips(chips(30), false).hidden).toBe(27);
    expect(visibleChips(chips(30), false).shown).toHaveLength(CHIP_LIMIT);
  });

  it("shows them all, in the same order, once expanded", () => {
    const all = chips(30);
    expect(visibleChips(all, true)).toEqual({ shown: all, hidden: 0 });
  });

  it("takes another limit", () => {
    expect(visibleChips(chips(10), false, 5)).toEqual({ shown: chips(10).slice(0, 5), hidden: 5 });
  });
});

describe("fitChipCount", () => {
  const MORE = 88;
  const GAP = 6;
  /** A 358px line (a 390px phone): the three chips are as wide as the numbers say. */
  const fit = (widths: number[], available: number, extra: Partial<Parameters<typeof fitChipCount>[0]> = {}) =>
    fitChipCount({ widths, moreWidth: MORE, available, gap: GAP, ...extra });

  it("is the cap where three fit whole, with room to spare", () => {
    expect(fit([180, 180, 180], 1200, { films: 31 })).toBe(CHIP_LIMIT);
    expect(fit([256, 256, 256], 1200, { films: 31 })).toBe(CHIP_LIMIT);
    // Never more than the cap, however much room there is: the chips beyond it are not measured.
    expect(fit([100, 100, 100, 100, 100], 4000, { films: 5 })).toBe(CHIP_LIMIT);
  });

  it("is two on a phone with short titles, and one with long ones", () => {
    expect(fit([100, 110, 100], 358, { films: 31 })).toBe(2);
    expect(fit([256, 256, 256], 358, { films: 31 })).toBe(1);
    // The second chip may give up the end of its title, but not below the minimum: 256 + 6 + 150 + 6 + 88 = 506.
    expect(fit([256, 256, 256], 505, { films: 31 })).toBe(1);
    expect(fit([256, 256, 256], 507, { films: 31 })).toBe(2);
  });

  it("lets the last chip give up the end of its title, down to the minimum, and never lets a short title give up anything", () => {
    // 100 whole, then 300 (cut at the chip's own maximum in reality; here just wide) squeezed to 150: 100 + 6 + 150 + 6 + 88 = 350, a hair of slack.
    expect(fit([100, 300, 300], 351, { films: 31 })).toBe(2);
    expect(fit([100, 300, 300], 349, { films: 31 })).toBe(1);
    // A chip narrower than the minimum is its own width: 100 + 6 + 90 + 6 + 88 = 290.
    expect(fit([100, 90, 300], 291, { films: 31 })).toBe(2);
    expect(fit([100, 90, 300], 289, { films: 31 })).toBe(1);
    expect(CHIP_MIN_WIDTH).toBeGreaterThanOrEqual(130);
  });

  it("needs no '+N more' chip when every film is on the line", () => {
    // Two films, both fit with no more chip: 100 + 6 + 100 + 1 = 207, but 207 + 6 + 88 for a "+N more" chip would not be.
    expect(fit([100, 100], 210)).toBe(2);
    expect(fit([100, 100], 210, { films: 3 })).toBe(1);
    // Three films that fit exactly, no more chip: 100 + 6 + 100 + 6 + 100 + 1 = 313.
    expect(fit([100, 100, 100], 313)).toBe(3);
    expect(fit([100, 100, 100], 312)).toBe(2);
  });

  it("is always at least one chip with any film, and none with none", () => {
    expect(fit([256], 40)).toBe(1);
    expect(fit([256, 256, 256], 40, { films: 31 })).toBe(1);
    expect(fit([], 358)).toBe(0);
  });

  it("takes another limit and another minimum", () => {
    expect(fit([100, 100, 100], 1200, { films: 31, limit: 2 })).toBe(2);
    expect(fit([100, 300], 280, { films: 31, minWidth: 40 })).toBe(2);
    expect(fit([100, 300], 280, { films: 31, minWidth: 150 })).toBe(1);
  });

  it("counts the films left out against every film, not only the measured ones", () => {
    // Three measured chips of 31 films: with all three on the line, 28 are left out, so the "+N more" chip is on it.
    expect(fit([100, 100, 100], 310, { films: 31 })).toBe(2);
    expect(fit([100, 100, 100], 313, { films: 3 })).toBe(3);
  });
});

describe("splitLastWord", () => {
  it("cuts a text before its last word", () => {
    expect(splitLastWord("He began on the stage in Chicago.")).toEqual(["He began on the stage in", "Chicago."]);
    expect(splitLastWord("Born in 1933 \u2026")).toEqual(["Born in 1933", "\u2026"]);
  });

  it("is the whole text as the last word when it is one word, and nothing for nothing", () => {
    expect(splitLastWord("Director")).toEqual(["", "Director"]);
    expect(splitLastWord("")).toEqual(["", ""]);
  });

  it("ignores space at the end, and keeps the spaces inside", () => {
    expect(splitLastWord("An actor.  \n")).toEqual(["An", "actor."]);
    expect(splitLastWord("Two  spaces here")).toEqual(["Two  spaces", "here"]);
  });

  it("joins back into the text it was cut from", () => {
    const text = "Gene Wilder (born Jerome Silberman; June 11, 1933 \u2013 August 29, 2016) was an American actor.";
    const [lead, last] = splitLastWord(text);
    expect(`${lead} ${last}`).toBe(text);
  });
});

describe("heroCollapsed", () => {
  it("is expanded at the landing, and until the scroller has moved the threshold", () => {
    expect(COLLAPSE_PX).toBe(48);
    expect(heroCollapsed(0, 0)).toBe(false);
    expect(heroCollapsed(47, 0)).toBe(false);
    expect(heroCollapsed(47.9, 0)).toBe(false);
  });

  it("collapses at 48px exactly and beyond", () => {
    expect(heroCollapsed(48, 0)).toBe(true);
    expect(heroCollapsed(400, 0)).toBe(true);
  });

  it("measures from where the scroller landed, not from 0: Focus lands mid-career", () => {
    expect(heroCollapsed(1200, 1200)).toBe(false);
    expect(heroCollapsed(1247, 1200)).toBe(false);
    expect(heroCollapsed(1248, 1200)).toBe(true);
  });

  it("collapses on the way back up too, and expands again within the threshold of the landing", () => {
    expect(heroCollapsed(1152, 1200)).toBe(true);
    expect(heroCollapsed(1153, 1200)).toBe(false);
    expect(heroCollapsed(1200 + 60, 1200)).toBe(true);
    expect(heroCollapsed(1200 + 10, 1200)).toBe(false);
  });

  it("takes another threshold", () => {
    expect(heroCollapsed(10, 0, 10)).toBe(true);
    expect(heroCollapsed(9, 0, 10)).toBe(false);
  });
});
