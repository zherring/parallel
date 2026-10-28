import { describe, expect, it } from "vitest";
import {
  BLUESKY_POST_LIMIT,
  X_POST_LIMIT,
  X_TEXT_BUDGET,
  blueskyIntentUrl,
  blueskyTextBudget,
  shareLinks,
  shareText,
  xIntentUrl,
  xLength,
  xPostLength,
} from "@/lib/share";
import { sharedFilms } from "@/lib/shared";
import type { Film, PersonTimeline } from "@/lib/types";

const person = (id: number, name: string) => ({ id, name });
const linklater = person(564, "Richard Linklater");
const hawke = person(569, "Ethan Hawke");
const fincher = person(7467, "David Fincher");
const cronenweth = person(7479, "Jeff Cronenweth");
const pitt = person(287, "Brad Pitt");
const norton = person(819, "Edward Norton");

describe("xLength", () => {
  it("counts Latin text one per character", () => {
    expect(xLength("Ethan Hawke")).toBe(11);
    expect(xLength("Kieślowski")).toBe(10);
  });

  it("counts CJK characters and emoji double, as X does", () => {
    expect(xLength("봉준호")).toBe(6);
    expect(xLength("a🎬")).toBe(3);
  });

  it("counts typographic punctuation once", () => {
    expect(xLength("1995–2024 “quoted”")).toBe(18);
  });

  it("composes characters before counting", () => {
    expect(xLength("é")).toBe(1);
  });

  it("adds a space and a 23 character link to a post", () => {
    expect(xPostLength("hello")).toBe(5 + 1 + 23);
  });
});

describe("shareText", () => {
  it("names two people in full", () => {
    expect(shareText({ people: [linklater, hawke], count: 9 })).toBe(
      "My favorite film collaborations: Richard Linklater & Ethan Hawke, 9 films together",
    );
  });

  it("uses family names with the Oxford comma for three people", () => {
    expect(shareText({ people: [fincher, cronenweth, pitt], count: 3 })).toBe(
      "My favorite film collaborations: Fincher, Cronenweth, & Pitt, 3 films together",
    );
  });

  it("uses family names for four people", () => {
    expect(shareText({ people: [fincher, cronenweth, pitt, norton], count: 1 })).toBe(
      "My favorite film collaborations: Fincher, Cronenweth, Pitt, & Norton, 1 film together",
    );
  });

  it("is singular for one film", () => {
    expect(shareText({ people: [linklater, hawke], count: 1 })).toBe(
      "My favorite film collaborations: Richard Linklater & Ethan Hawke, 1 film together",
    );
  });

  it("does not claim a favorite when the people share nothing", () => {
    expect(shareText({ people: [linklater, hawke], count: 0 })).toBe(
      "Film careers side by side: Richard Linklater & Ethan Hawke",
    );
  });

  it("counts only released films together when the count comes from sharedFilms", () => {
    const credit = { role: "director" as const, job: "Director", minor: false };
    const made = (id: number, releaseDate: string): Film => ({
      id,
      title: `Film ${id}`,
      releaseDate,
      year: Number(releaseDate.slice(0, 4)),
      posterPath: null,
      voteCount: 0,
      credits: [credit],
      minor: false,
    });
    const films = [made(1, "1986-07-18"), made(2, "2029-12-21"), made(3, "2031-12-19")];
    const summary = { profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null };
    const timelines: PersonTimeline[] = [
      { person: { id: 564, name: "Richard Linklater", ...summary }, films },
      { person: { id: 569, name: "Ethan Hawke", ...summary }, films },
    ];
    const count = sharedFilms(timelines, { includeMinor: false, today: "2026-06-01" }).length;
    expect(shareText({ people: [linklater, hawke], count })).toBe(
      "My favorite film collaborations: Richard Linklater & Ethan Hawke, 1 film together",
    );
  });

  it("describes a single person", () => {
    expect(shareText({ people: [fincher], count: 12 })).toBe("David Fincher: a career in film, 12 films on a timeline");
    expect(shareText({ people: [fincher], count: 1 })).toBe("David Fincher: a career in film, 1 film on a timeline");
    expect(shareText({ people: [fincher], count: 0 })).toBe("David Fincher: a career in film");
  });

  it("uses full names when family names would be ambiguous", () => {
    const coens = [person(1, "Joel Coen"), person(2, "Ethan Coen"), person(3, "Frances McDormand")];
    expect(shareText({ people: coens, count: 2 })).toBe(
      "My favorite film collaborations: Joel Coen, Ethan Coen, & McDormand, 2 films together",
    );
  });

  it("has no hashtags, emoji or links", () => {
    for (const people of [[fincher], [linklater, hawke], [fincher, cronenweth, pitt, norton]]) {
      const text = shareText({ people, count: 5 });
      expect(text).not.toMatch(/[#@]|https?:|[\u{1F300}-\u{1FAFF}]/u);
    }
  });

  it("fits X with its link for two, three and four people", () => {
    for (const people of [[linklater, hawke], [fincher, cronenweth, pitt], [fincher, cronenweth, pitt, norton]]) {
      expect(xPostLength(shareText({ people, count: 12 }))).toBeLessThanOrEqual(X_POST_LIMIT);
    }
  });

  describe("when the names are too long", () => {
    it("falls back to family names for two people", () => {
      const a = person(1, `${"A".repeat(110)} Stone`);
      const b = person(2, `${"B".repeat(110)} Hardy`);
      expect(shareText({ people: [a, b], count: 4 })).toBe(
        "My favorite film collaborations: Stone & Hardy, 4 films together",
      );
    });

    it("falls back to first, second and a count for three or more", () => {
      const family = (letter: string) => `${letter}${"x".repeat(69)}`;
      const people = ["A", "B", "C", "D"].map((letter, i) => person(100 + i, `Given ${family(letter)}`));
      // The four family names alone are 4 x 70 characters, over the budget.
      const text = shareText({ people, count: 7 });
      expect(text).toBe(
        `My favorite film collaborations: ${family("A")}, ${family("B")} & 2 more, 7 films together`,
      );
      expect(xPostLength(text)).toBeLessThanOrEqual(X_POST_LIMIT);
    });

    it("cuts an absurdly long name with an ellipsis", () => {
      const text = shareText({ people: [person(1, "Q".repeat(500))], count: 3 });
      expect(text.startsWith("QQQ")).toBe(true);
      expect(text).toContain("…: a career in film, 3 films on a timeline");
      expect(xLength(text)).toBeLessThanOrEqual(X_TEXT_BUDGET);
    });

    it("cuts two absurdly long single-word names too", () => {
      const text = shareText({ people: [person(1, "Q".repeat(300)), person(2, "Z".repeat(300))], count: 2 });
      expect(xLength(text)).toBeLessThanOrEqual(X_TEXT_BUDGET);
      expect(text).toContain("…");
      expect(text.endsWith(", 2 films together")).toBe(true);
    });

    it("counts wide characters double when fitting", () => {
      const wide = person(1, "봉".repeat(90));
      const text = shareText({ people: [wide, person(2, "송".repeat(90))], count: 2 });
      expect(xLength(text)).toBeLessThanOrEqual(X_TEXT_BUDGET);
    });
  });

  it("honours a smaller budget, as on Bluesky with a long link", () => {
    const people = [linklater, hawke];
    const roomy = shareText({ people, count: 9 });
    const tight = shareText({ people, count: 9 }, 70);
    expect(roomy).toBe("My favorite film collaborations: Richard Linklater & Ethan Hawke, 9 films together");
    expect(tight).toBe("My favorite film collaborations: Linklater & Hawke, 9 films together");
    expect(xLength(tight)).toBeLessThanOrEqual(70);
  });

  it("returns nothing without people", () => {
    expect(shareText({ people: [], count: 3 })).toBe("");
  });
});

describe("intent links", () => {
  const url = "https://parallel.zachherring.com/p/564-richard-linklater+569-ethan-hawke";
  const text = "My favorite film collaborations: Richard Linklater & Ethan Hawke, 9 films together";

  it("builds an X post intent with the text and the link as separate parameters", () => {
    const link = new URL(xIntentUrl(text, url));
    expect(link.origin + link.pathname).toBe("https://x.com/intent/post");
    expect(link.searchParams.get("text")).toBe(text);
    expect(link.searchParams.get("url")).toBe(url);
    expect([...link.searchParams.keys()]).toEqual(["text", "url"]);
  });

  it("builds a Bluesky compose intent with the link at the end of the text", () => {
    const link = new URL(blueskyIntentUrl(text, url));
    expect(link.origin + link.pathname).toBe("https://bsky.app/intent/compose");
    expect(link.searchParams.get("text")).toBe(`${text} ${url}`);
    expect([...link.searchParams.keys()]).toEqual(["text"]);
  });

  it("percent-encodes with %20 and %2B rather than raw spaces or plus signs", () => {
    const href = xIntentUrl(text, url);
    expect(href).not.toMatch(/\s/);
    expect(href).toContain("%20");
    expect(href).toContain("%2B");
  });

  it("builds all three outputs for a page", () => {
    const links = shareLinks({ people: [linklater, hawke], count: 9 }, url);
    expect(links.text).toBe(text);
    expect(new URL(links.x).searchParams.get("text")).toBe(text);
    expect(new URL(links.bluesky).searchParams.get("text")).toBe(`${text} ${url}`);
  });

  it("keeps the Bluesky post under 300 even with a long link", () => {
    const longUrl = `https://parallel.zachherring.com/p/${"7467-david-fincher+".repeat(4)}`.slice(0, -1);
    const links = shareLinks({ people: [fincher, cronenweth, pitt, norton], count: 12 }, longUrl);
    const posted = new URL(links.bluesky).searchParams.get("text") as string;
    expect(Array.from(posted).length).toBeLessThanOrEqual(BLUESKY_POST_LIMIT);
  });

  it("budgets the Bluesky text from the link length", () => {
    expect(blueskyTextBudget("https://example.com/")).toBe(BLUESKY_POST_LIMIT - 1 - 20);
    expect(blueskyTextBudget("x".repeat(500))).toBe(60);
  });
});
