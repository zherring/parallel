import { describe, expect, it } from "vitest";
import { MAX_LANES, canAddPerson, initials, laneFacts, peopleHref, removePersonHref, yearSpan } from "@/lib/lanes";
import { parsePeopleSlug } from "@/lib/slug";

const fincher = { id: 7467, name: "David Fincher" };
const cronenweth = { id: 7479, name: "Jeff Cronenweth" };
const pitt = { id: 287, name: "Brad Pitt" };

describe("peopleHref / removePersonHref", () => {
  it("builds the /p/ url for the people in order", () => {
    expect(peopleHref([fincher, cronenweth])).toBe("/p/7467-david-fincher+7479-jeff-cronenweth");
  });

  it("goes home when there is nobody left", () => {
    expect(peopleHref([])).toBe("/");
    expect(removePersonHref([fincher], 7467)).toBe("/");
  });

  it("drops only the removed person and keeps the order of the rest", () => {
    expect(removePersonHref([fincher, cronenweth, pitt], 7479)).toBe("/p/7467-david-fincher+287-brad-pitt");
    expect(removePersonHref([fincher, cronenweth], 7467)).toBe("/p/7479-jeff-cronenweth");
  });

  it("returns the same list when the id is not in view", () => {
    expect(removePersonHref([fincher], 1)).toBe("/p/7467-david-fincher");
  });

  it("round-trips through parsePeopleSlug", () => {
    const href = removePersonHref([fincher, cronenweth, pitt], 7467);
    expect(parsePeopleSlug(href.replace("/p/", ""))?.ids).toEqual([7479, 287]);
  });

  it("copes with names that slugify to nothing", () => {
    expect(peopleHref([{ id: 5, name: "???" }])).toBe("/p/5");
  });
});

describe("canAddPerson", () => {
  it("allows adding until the cap", () => {
    expect(MAX_LANES).toBe(4);
    expect(canAddPerson(1)).toBe(true);
    expect(canAddPerson(3)).toBe(true);
    expect(canAddPerson(4)).toBe(false);
  });
});

describe("initials", () => {
  it("uses first and last initial", () => {
    expect(initials("David Fincher")).toBe("DF");
    expect(initials("Philip Seymour Hoffman")).toBe("PH");
  });

  it("handles single names, accents and empties", () => {
    expect(initials("Zendaya")).toBe("Z");
    expect(initials("Éric Rohmer")).toBe("ÉR");
    expect(initials("  ")).toBe("?");
    expect(initials("")).toBe("?");
  });
});

describe("laneFacts", () => {
  const person = { birthday: "1962-08-28", deathday: null };

  it("joins born, first and latest", () => {
    expect(laneFacts(person, [1992, 1999, 2026])).toBe("Born 1962 · first film 1992 · latest 2026");
  });

  it("adds died when there is a death date", () => {
    expect(laneFacts({ birthday: "1930-01-01", deathday: "2021-05-04" }, [1960, 2000])).toBe(
      "Born 1930 · died 2021 · first film 1960 · latest 2000",
    );
  });

  it("omits whatever is missing", () => {
    expect(laneFacts({ birthday: null, deathday: null }, [2001, 2005])).toBe("first film 2001 · latest 2005");
    expect(laneFacts(person, [])).toBe("Born 1962");
    expect(laneFacts({ birthday: null, deathday: null }, [])).toBe("");
  });

  it("does not repeat the year for a single film", () => {
    expect(laneFacts({ birthday: null, deathday: null }, [1999, 1999])).toBe("first film 1999");
  });

  it("ignores unparseable dates", () => {
    expect(laneFacts({ birthday: "n/a", deathday: "" }, [2000])).toBe("first film 2000");
  });
});

describe("yearSpan", () => {
  it("formats ranges", () => {
    expect(yearSpan([])).toBe("");
    expect(yearSpan([2001])).toBe("2001");
    expect(yearSpan([2010, 1992, 2026])).toBe("1992–2026");
  });
});
