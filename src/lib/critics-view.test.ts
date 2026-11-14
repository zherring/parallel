import { describe, expect, it } from "vitest";
import type { Clipping } from "@/lib/clippings";
import type { Critic } from "@/lib/critics";
import {
  criticAbout,
  criticAvatarName,
  criticById,
  criticName,
  criticYear,
  interleaveQuotes,
  readingByline,
} from "@/lib/critics-view";

const critic = (overrides: Partial<Critic> = {}): Critic => ({
  id: "critic-a",
  critic: "Rebecca Keegan",
  publication: "Los Angeles Times",
  via: null,
  title: "John Williams and Steven Spielberg: A 40-year collaboration",
  date: "2012-01",
  url: "https://example.com/a",
  kind: "feature",
  quote: "A quote.",
  ...overrides,
});

const people = [
  { id: 488, name: "Steven Spielberg" },
  { id: 491, name: "John Williams" },
];

describe("criticName", () => {
  it("is the writer", () => {
    expect(criticName(critic())).toBe("Rebecca Keegan");
    expect(criticName(critic({ critic: "  Neil Sinyard " }))).toBe("Neil Sinyard");
  });

  it("is the publication when the piece is not signed", () => {
    expect(criticName(critic({ critic: null, publication: "Kirkus Reviews" }))).toBe("Kirkus Reviews");
    expect(criticName(critic({ critic: "  ", publication: "Indie Outlook" }))).toBe("Indie Outlook");
  });
});

describe("criticAbout", () => {
  it("is the two family names, in the order given", () => {
    expect(criticAbout(people)).toBe("Spielberg & Williams");
    expect(criticAbout([...people].reverse())).toBe("Williams & Spielberg");
  });

  it("uses full names when the two share a family name", () => {
    expect(
      criticAbout([
        { id: 1, name: "Joel Coen" },
        { id: 2, name: "Ethan Coen" },
      ]),
    ).toBe("Joel Coen & Ethan Coen");
  });
});

describe("criticAvatarName", () => {
  it("is the writer's name", () => {
    expect(criticAvatarName(critic())).toBe("Rebecca Keegan");
    expect(criticAvatarName(critic({ critic: "Florence Scott-Anderton" }))).toBe("Florence Scott-Anderton");
  });

  it("is the first writer when there are several", () => {
    const duo = critic({ critic: "K. J. Donnelly and Steven Rawle" });
    expect(criticAvatarName(duo)).toBe("K. J. Donnelly");
    expect(criticAvatarName(critic({ critic: "Ann Lee & Bo Chan" }))).toBe("Ann Lee");
  });

  it("is the first letter of the publication when the piece is not signed", () => {
    expect(criticAvatarName(critic({ critic: null, publication: "Kirkus Reviews" }))).toBe("K");
    expect(criticAvatarName(critic({ critic: null, publication: "indie Outlook" }))).toBe("i");
  });
});

describe("criticYear", () => {
  it("reads the year of a year, a month or a day", () => {
    expect(criticYear({ date: "2013" })).toBe(2013);
    expect(criticYear({ date: "2017-01" })).toBe(2017);
    expect(criticYear({ date: "2024-02-10" })).toBe(2024);
  });

  it("is null for a date that is none of those", () => {
    expect(criticYear({ date: "" })).toBeNull();
    expect(criticYear({ date: "January 2017" })).toBeNull();
  });
});

describe("criticById", () => {
  const all = [critic({ id: "critic-one" }), critic({ id: "critic-two" })];

  it("finds the critic with that id", () => {
    expect(criticById(all, "critic-two")).toBe(all[1]);
  });

  it("is null for an id the pair does not have, an empty one or none", () => {
    expect(criticById(all, "critic-three")).toBeNull();
    expect(criticById(all, "")).toBeNull();
    expect(criticById(all, null)).toBeNull();
    expect(criticById(all, undefined)).toBeNull();
    expect(criticById([], "critic-one")).toBeNull();
  });

  it("compares the id exactly", () => {
    expect(criticById(all, "CRITIC-ONE")).toBeNull();
    expect(criticById(all, "critic-on")).toBeNull();
  });

  it("never answers to an id that is not a critic's, whatever the list holds", () => {
    expect(criticById([critic({ id: "a-clipping-id" })], "a-clipping-id")).toBeNull();
  });
});

describe("interleaveQuotes", () => {
  const clipping = (id: string, said_year: number | null, date: string): Clipping => ({
    id,
    speaker: "Steven Spielberg",
    about: "John Williams",
    quote: id,
    film: null,
    said_year,
    publication: "Example Times",
    title: "Placeholder headline",
    date,
    url: "https://example.com/a",
    via: null,
    context: "",
    secondhand: false,
  });
  const idOf = (entry: ReturnType<typeof interleaveQuotes>[number]) => (entry.kind === "critic" ? entry.critic.id : entry.clipping.id);
  const ids = (clippings: Clipping[], critics: Critic[]) => interleaveQuotes(clippings, critics).map(idOf);

  it("puts the artists' quotes and the critics' in one list, oldest first", () => {
    expect(
      ids(
        [clipping("a-1980", 1980, "1981"), clipping("a-2010", 2010, "2012")],
        [critic({ id: "critic-1999", date: "1999-10-19" }), critic({ id: "critic-2024", date: "2024" })],
      ),
    ).toEqual(["a-1980", "critic-1999", "a-2010", "critic-2024"]);
  });

  it("goes by the year of a critic's date, however precise, and by the older year of an artist's quote", () => {
    expect(
      ids(
        // said in 2005, printed in 2001: 2001
        [clipping("a-2001", 2005, "2001-03-04")],
        [critic({ id: "critic-2003", date: "2003-12" }), critic({ id: "critic-2000", date: "2000" })],
      ),
    ).toEqual(["critic-2000", "a-2001", "critic-2003"]);
  });

  it("puts an artist's quote before a critic's of the same year, whatever the months", () => {
    expect(
      ids([clipping("a-2012", null, "2012-12-31")], [critic({ id: "critic-2012", date: "2012-01-01" })]),
    ).toEqual(["a-2012", "critic-2012"]);
  });

  it("keeps quotes of the same kind and year in the order they were given in", () => {
    expect(
      ids(
        [clipping("a-first", null, "2000"), clipping("a-second", null, "2000")],
        [critic({ id: "critic-first", date: "2000" }), critic({ id: "critic-second", date: "2000" })],
      ),
    ).toEqual(["a-first", "a-second", "critic-first", "critic-second"]);
  });

  it("sorts the critics by year too, though they come curated best first", () => {
    expect(
      ids([], [critic({ id: "critic-new", date: "2025" }), critic({ id: "critic-old", date: "1999" }), critic({ id: "critic-mid", date: "2012" })]),
    ).toEqual(["critic-old", "critic-mid", "critic-new"]);
  });

  it("puts a quote with no year last, an artist's before a critic's", () => {
    expect(
      ids(
        [clipping("a-none", null, ""), clipping("a-1990", 1990, "1990")],
        [critic({ id: "critic-none", date: "n.d." }), critic({ id: "critic-1980", date: "1980" })],
      ),
    ).toEqual(["critic-1980", "a-1990", "a-none", "critic-none"]);
  });

  it("is the artists' alone, or the critics' alone, when the other is empty, and a copy", () => {
    const only = [clipping("a-1", 1990, "1990"), clipping("a-2", 2000, "2000")];
    expect(ids(only, [])).toEqual(["a-1", "a-2"]);
    expect(ids([], [critic({ id: "critic-1" })])).toEqual(["critic-1"]);
    expect(interleaveQuotes([], [])).toEqual([]);
    expect(only.map((c) => c.id)).toEqual(["a-1", "a-2"]);
  });

  it("tags each entry with its kind", () => {
    const [first, second] = interleaveQuotes([clipping("a", 1990, "1990")], [critic({ id: "critic-x", date: "2000" })]);
    expect(first).toMatchObject({ kind: "clipping", clipping: { id: "a" } });
    expect(second).toMatchObject({ kind: "critic", critic: { id: "critic-x" } });
  });
});

describe("readingByline", () => {
  it("is the author, the publication and the year, the year alone of the date", () => {
    expect(readingByline({ author: "Jack Sullivan", publication: "A Companion", date: "2017-01" })).toEqual([
      "Jack Sullivan",
      "A Companion",
      "2017",
    ]);
  });

  it("leaves out what is missing", () => {
    expect(readingByline({ author: null, publication: "Kirkus Reviews", date: "2025" })).toEqual(["Kirkus Reviews", "2025"]);
    expect(readingByline({ author: "A. Writer", publication: "Prospect", date: "" })).toEqual(["A. Writer", "Prospect"]);
    expect(readingByline({ author: "  ", publication: "Prospect", date: "n.d." })).toEqual(["Prospect"]);
  });
});
