import { describe, expect, it } from "vitest";
import { EXAMPLE_PAIRINGS } from "@/lib/examples";
import { FAMILY_NAME_OVERRIDES, pageHeading, shortName } from "@/lib/short-name";

describe("shortName", () => {
  const cases: [string, string][] = [
    // plain western order
    ["Steven Spielberg", "Spielberg"],
    ["Harrison Ford", "Ford"],
    ["Francis Ford Coppola", "Coppola"],
    ["Samuel L. Jackson", "Jackson"],
    ["I. A. L. Diamond", "Diamond"],
    ["Philip Seymour Hoffman", "Hoffman"],
    ["Pedro Almodóvar", "Almodóvar"],
    ["Penélope Cruz", "Cruz"],
    ["Madonna", "Madonna"],
    ["  Tom   Hanks ", "Hanks"],
    // hyphenated and apostrophe surnames stay whole
    ["Daniel Day-Lewis", "Day-Lewis"],
    ["Hirokazu Kore-eda", "Kore-eda"],
    ["Peter O'Toole", "O'Toole"],
    ["Dean DeBlois", "DeBlois"],
    // generational suffixes
    ["Robert Downey Jr.", "Downey"],
    ["Robert Downey, Jr.", "Downey"],
    ["Sammy Davis Jr", "Davis"],
    ["Martin Luther King Sr.", "King"],
    ["Adrien Brody III", "Brody"],
    ["John Smith IV", "Smith"],
    ["Michael Jackson (I)", "Jackson"],
    // particles stay attached
    ["Hoyte van Hoytema", "van Hoytema"],
    ["Guillermo del Toro", "del Toro"],
    ["Robert De Niro", "De Niro"],
    ["Brian De Palma", "De Palma"],
    ["Lars von Trier", "von Trier"],
    ["Ana de Armas", "de Armas"],
    ["Jean-Claude Van Damme", "Van Damme"],
    ["Pedro de la Rosa", "de la Rosa"],
    ["Ludwig van der Rohe", "van der Rohe"],
    ["Mohamed El Baradei", "El Baradei"],
    ["Leonardo da Vinci", "da Vinci"],
    ["Robert De Niro Jr.", "De Niro"],
    // a lone particle-looking word is still the given name
    ["Al Pacino", "Pacino"],
    ["Le Corbusier", "Corbusier"],
  ];

  it.each(cases)("%s -> %s", (name, expected) => {
    expect(shortName(name)).toBe(expected);
  });

  it("does not need the id for western names", () => {
    expect(shortName("David Fincher", 7467)).toBe("Fincher");
  });

  describe("family-name-first overrides, by TMDB id", () => {
    const overrides: [string, number, string][] = [
      ["Bong Joon Ho", 21684, "Bong"],
      ["Song Kang-ho", 20738, "Song"],
      ["Park Chan-wook", 10099, "Park"],
      ["Chung Chung-hoon", 10107, "Chung"],
      ["Wong Kar-wai", 12453, "Wong"],
      ["Tony Leung Chiu-wai", 1337, "Leung"],
      ["Zhang Yimou", 607, "Zhang"],
      ["Gong Li", 643, "Gong"],
      ["Chow Yun-Fat", 1619, "Chow"],
      ["Hou Hsiao-hsien", 64992, "Hou"],
      ["Tsai Ming-liang", 71174, "Tsai"],
      ["Jia Zhangke", 24011, "Jia"],
      ["Zhang Ziyi", 1339, "Zhang"],
      ["Kim Ki-duk", 1188, "Kim"],
      ["Kim Jee-woon", 69081, "Kim"],
      ["Lee Chang-dong", 96657, "Lee"],
      ["Lee Byung-hun", 25002, "Lee"],
      ["Choi Min-sik", 64880, "Choi"],
      ["Park Hae-il", 21687, "Park"],
      ["Bae Doona", 21688, "Bae"],
    ];

    it.each(overrides)("%s (%i) -> %s", (name, id, expected) => {
      expect(shortName(name, id)).toBe(expected);
    });

    it("falls back to the last word without the id (which is why the table exists)", () => {
      expect(shortName("Bong Joon Ho")).toBe("Ho");
      expect(shortName("Song Kang-ho")).toBe("Kang-ho");
    });

    it("only applies to the listed ids", () => {
      expect(shortName("Some Person", 999_999_999)).toBe("Person");
      expect(shortName("Some Person", Number.NaN)).toBe("Person");
    });

    it("keeps every override id in step with the example people", () => {
      const examples = new Map(EXAMPLE_PAIRINGS.flatMap((pairing) => pairing.people.map((p) => [p.id, p.name] as const)));
      for (const [id, family] of Object.entries(FAMILY_NAME_OVERRIDES)) {
        // Ids that are not featured as an example are fine; those that are must agree on the name.
        const name = examples.get(Number(id));
        if (name) expect(name.split(/\s+/).map((word) => word.toLowerCase())).toContain(family.toLowerCase());
      }
    });
  });

  it("gives every example person a family name that is part of their name", () => {
    for (const pairing of EXAMPLE_PAIRINGS) {
      for (const { id, name } of pairing.people) {
        const family = shortName(name, id);
        expect(family.length, name).toBeGreaterThan(0);
        expect(name, name).toContain(family);
      }
    }
  });

  it("never returns an empty string for a non-empty name", () => {
    for (const name of ["Jr.", "III", "(I)", "de", "A"]) expect(shortName(name).length).toBeGreaterThan(0);
  });
});

describe("pageHeading", () => {
  const person = (id: number, name: string) => ({ id, name });

  it("uses the full name for one person", () => {
    expect(pageHeading([person(1, "David Fincher")])).toEqual({ text: "David Fincher", full: null });
  });

  it("uses full names for two people", () => {
    expect(pageHeading([person(5026, "Akira Kurosawa"), person(7450, "Toshirō Mifune")])).toEqual({
      text: "Akira Kurosawa & Toshirō Mifune",
      full: null,
    });
  });

  it("uses family names with an Oxford comma and ampersand for three", () => {
    expect(
      pageHeading([person(488, "Steven Spielberg"), person(3, "Harrison Ford"), person(491, "John Williams")]),
    ).toEqual({
      text: "Spielberg, Ford, & Williams",
      full: "Steven Spielberg, Harrison Ford & John Williams",
    });
  });

  it("uses family names for four, with particles and overrides", () => {
    const heading = pageHeading([
      person(21684, "Bong Joon Ho"),
      person(20738, "Song Kang-ho"),
      person(1, "Hoyte van Hoytema"),
      person(2, "Guillermo del Toro"),
    ]);
    expect(heading.text).toBe("Bong, Song, van Hoytema, & del Toro");
    expect(heading.full).toBe("Bong Joon Ho, Song Kang-ho, Hoyte van Hoytema & Guillermo del Toro");
  });

  it("keeps full names for people who would otherwise share a family name", () => {
    const heading = pageHeading([person(1, "Joel Coen"), person(2, "Ethan Coen"), person(3, "Frances McDormand")]);
    expect(heading.text).toBe("Joel Coen, Ethan Coen, & McDormand");
  });

  it("handles no people", () => {
    expect(pageHeading([])).toEqual({ text: "", full: null });
  });
});
