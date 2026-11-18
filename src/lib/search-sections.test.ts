import { describe, expect, it } from "vitest";
import { searchSections } from "@/lib/search-sections";
import type { PairingSearchResult, PersonSearchResult } from "@/lib/types";

const person = (id: number, name: string): PersonSearchResult => ({ id, name, profilePath: null, knownFor: "Directing", knownForTitles: [] });
const pair = (a: PersonSearchResult, b: PersonSearchResult): PairingSearchResult => ({
  href: `/p/${a.id}+${b.id}`, people: [a, b], blurb: "A collaboration.", sharedCount: 3,
});
const greta = person(45400, "Greta Gerwig");
const noah = person(5656, "Noah Baumbach");
const james = person(2710, "James Cameron");
const arnold = person(1100, "Arnold Schwarzenegger");

describe("searchSections", () => {
  it("shows the obvious surname match, their pairings, then every other artist", () => {
    const people = [greta, person(2, "Herbert Gerwig"), person(3, "Gerwig Lawitzky")];
    const pairing = pair(greta, noah);
    const sections = searchSections("gerwig", people, [pairing]);
    expect(sections.map((section) => [section.label, section.startIndex])).toEqual([[null, 0], ["Related pairings", 1], ["More artists", 2]]);
    expect(sections.flatMap((section) => section.options)).toEqual([greta, pairing, ...people.slice(1)]);
  });

  it.each(["james cameron", " JAMES   CAMERON ", "james cam", "cameron james"])(
    "puts the top James Cameron's pairings above all namesakes for %j", (query) => {
      const people = [james, ...Array.from({ length: 7 }, (_, i) => person(100 + i, "James Cameron"))];
      const pairing = pair(james, arnold);
      const sections = searchSections(query, people, [pairing]);
      expect(sections.flatMap((section) => section.options)).toEqual([james, pairing, ...people.slice(1)]);
      expect(sections[2].options).toHaveLength(7);
    },
  );

  it("shows only the obvious artist's pairings, not unrelated lower-ranked matches' pairings", () => {
    const gunn = person(15218, "James Gunn");
    const camerons = pair(james, arnold);
    const gunns = pair(gunn, person(9, "Michael Rooker"));
    expect(searchSections("james cameron", [james, gunn], [gunns, camerons]).flatMap((section) => section.options))
      .toEqual([james, camerons, gunn]);
  });

  it.each(["ja", "james", "unknown"])("keeps broad or mismatched query %j people-first", (query) => {
    const people = [james, person(15218, "James Gunn")];
    const pairing = pair(james, arnold);
    const sections = searchSections(query, people, [pairing]);
    expect(sections.map((section) => section.key)).toEqual(["matches", "pairings"]);
    expect(sections.flatMap((section) => section.options)).toEqual([...people, pairing]);
  });

  it("does not guess between two curated Andersons", () => {
    const wes = person(5655, "Wes Anderson");
    const paul = person(4762, "Paul Thomas Anderson");
    const pairings = [pair(wes, noah), pair(paul, arnold)];
    expect(searchSections("anderson", [wes, paul], pairings).flatMap((section) => section.options))
      .toEqual([wes, paul, ...pairings]);
  });

  it("normalizes accents and punctuation for full-name matches", () => {
    const artist = person(1, "Pedro Almodóvar");
    expect(searchSections("pedro almodovar", [artist, noah], [pair(artist, greta)])[2].label).toBe("More artists");
  });

  it("does not promote a lower-ranked person just because they have curated pairings", () => {
    const diaz = person(6941, "Cameron Diaz");
    const pairing = pair(james, arnold);
    expect(searchSections("cameron", [diaz, james], [pairing]).flatMap((section) => section.options)).toEqual([diaz, james, pairing]);
  });

  it("keeps all pairings for the obvious match, even beyond eight rows", () => {
    const pairings = Array.from({ length: 12 }, (_, i) => pair(greta, person(100 + i, `Artist ${i}`)));
    const sections = searchSections("gerwig", [greta, noah], pairings);
    expect(sections[1].options).toEqual(pairings);
    expect(sections[2].startIndex).toBe(13);
  });

  it("omits empty sections and keeps chips/contextual searches people-only when no pairings are supplied", () => {
    expect(searchSections("gerwig", [], [])).toEqual([]);
    expect(searchSections("gerwig", [greta, noah], []).map((section) => section.key)).toEqual(["matches"]);
    expect(searchSections("gerwig", [greta], [pair(greta, noah)]).map((section) => section.key)).toEqual(["matches", "pairings"]);
  });

  it("Artists shows all artists without pairings or secondary section headings", () => {
    const results = [greta, person(2, "Karen Gerwig")];
    const sections = searchSections("gerwig", results, [pair(greta, noah)], "artists");
    expect(sections).toEqual([{ key: "matches", label: null, options: results, startIndex: 0 }]);
  });

  it("Pairings shows just the obvious artist's pairings, with keyboard indices starting at zero", () => {
    const pairing = pair(greta, noah);
    const sections = searchSections("gerwig", [greta, james], [pairing, pair(james, arnold)], "pairings");
    expect(sections).toEqual([{ key: "pairings", label: "Related pairings", options: [pairing], startIndex: 0 }]);
  });

  it("Pairings shows all relevant pairs for a broad query, and no rows when none exist", () => {
    const pairings = [pair(james, arnold), pair(person(15218, "James Gunn"), noah)];
    expect(searchSections("james", [james], pairings, "pairings")[0].options).toEqual(pairings);
    expect(searchSections("gerwig", [greta], [], "pairings")).toEqual([]);
  });
});
