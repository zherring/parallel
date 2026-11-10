import { describe, expect, it } from "vitest";
import type { Clipping, ClippingsPerson } from "@/lib/clippings";
import { getPairClippingSet } from "@/lib/clippings";
import { EXAMPLE_PAIRINGS, pairingKey } from "@/lib/examples";
import {
  CHIP_LIMIT,
  COLLAPSE_PX,
  featuredClipping,
  heroCollapsed,
  heroSubtitle,
  mainRole,
  mainRoleLabels,
  orderChips,
  pickHeroNote,
  quoteHref,
  visibleChips,
  type HeroChip,
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

  it("works on the real data: a pair with clippings gets its quote, a curated pair without gets its blurb, any other pair gets nothing", () => {
    const blurbOf = new Map(EXAMPLE_PAIRINGS.map((entry) => [pairingKey(entry), entry.blurb]));
    const withQuotes = EXAMPLE_PAIRINGS.find((entry) => getPairClippingSet(entry.people.map((p) => p.id)));
    const withoutQuotes = EXAMPLE_PAIRINGS.find(
      (entry) => entry.people.length === 2 && !getPairClippingSet(entry.people.map((p) => p.id)),
    );
    expect(withQuotes).toBeDefined();
    expect(withoutQuotes).toBeDefined();
    const noteFor = (ids: number[]) =>
      pickHeroNote({ clippings: getPairClippingSet(ids), description: null, blurb: blurbOf.get(pairingKey({ people: ids.map((id) => ({ id, name: "" })) })) ?? null });
    expect(noteFor(withQuotes!.people.map((p) => p.id))?.kind).toBe("quote");
    expect(noteFor(withoutQuotes!.people.map((p) => p.id))).toEqual({ kind: "blurb", text: withoutQuotes!.blurb });
    expect(noteFor([1, 2])).toBeNull();
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

describe("visibleChips", () => {
  it("shows all of up to eight films, with no more chip", () => {
    for (const count of [0, 1, CHIP_LIMIT]) expect(visibleChips(chips(count), false)).toEqual({ shown: chips(count), hidden: 0 });
  });

  it("shows the first eight and counts the rest for '+N more'", () => {
    const all = chips(CHIP_LIMIT + 1);
    expect(visibleChips(all, false)).toEqual({ shown: all.slice(0, CHIP_LIMIT), hidden: 1 });
    expect(visibleChips(chips(30), false).hidden).toBe(22);
    expect(visibleChips(chips(30), false).shown).toHaveLength(8);
  });

  it("shows them all, in the same order, once expanded", () => {
    const all = chips(30);
    expect(visibleChips(all, true)).toEqual({ shown: all, hidden: 0 });
  });

  it("takes another limit", () => {
    expect(visibleChips(chips(5), false, 3)).toEqual({ shown: chips(5).slice(0, 3), hidden: 2 });
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
