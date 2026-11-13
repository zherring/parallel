import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  criticQuoteDescription,
  criticQuoteTitle,
  embedQuoteText,
  peopleDescription,
  peopleSocial,
  peopleTitle,
  periodImagePath,
  periodTitle,
  quoteDescription,
  quoteImagePath,
  quoteTitle,
} from "@/lib/seo";
import { sharedFilms } from "@/lib/shared";
import type { Film, PersonTimeline, SharedFilm } from "@/lib/types";

const film = (id: number, year: number, minor = false): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${year}-01-01`,
  year,
  posterPath: null,
  voteCount: 0,
  credits: [],
  minor,
});

const timeline = (id: number, name: string, films: Film[]): PersonTimeline => ({
  person: { id, name, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

const shared = (n: number): SharedFilm[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    title: `Film ${i + 1}`,
    year: 2000 + i,
    releaseDate: `${2000 + i}-01-01`,
    posterPath: null,
    byPerson: {},
  }));

describe("peopleTitle", () => {
  it("titles a single person and a group", () => {
    expect(peopleTitle(["David Fincher"])).toBe("David Fincher: filmography timeline");
    expect(peopleTitle(["David Fincher", "Jeff Cronenweth"])).toBe(
      "David Fincher & Jeff Cronenweth: films made together",
    );
  });
});

describe("peopleDescription", () => {
  const pair = [timeline(1, "A", []), timeline(2, "B", [])];

  it("lists shared titles", () => {
    expect(peopleDescription(pair, shared(2))).toBe("Films made together by A & B: Film 1, Film 2.");
  });

  it("caps the list at six titles", () => {
    expect(peopleDescription(pair, shared(8))).toBe(
      "Films made together by A & B: Film 1, Film 2, Film 3, Film 4, Film 5, Film 6 and 2 more.",
    );
  });

  it("says so when nothing is shared", () => {
    expect(peopleDescription(pair, [])).toBe("No films made together by A & B found on TMDB.");
  });

  it("names only released films when the list comes from sharedFilms", () => {
    const credit = { role: "director" as const, job: "Director", minor: false };
    const dated = (id: number, title: string, releaseDate: string): Film => ({
      ...film(id, Number(releaseDate.slice(0, 4))),
      title,
      releaseDate,
      credits: [credit],
    });
    const films = [dated(1, "Aliens", "1986-07-18"), dated(2, "Avatar 4", "2029-12-21")];
    const people = [timeline(1, "A", films), timeline(2, "B", films)];
    const description = peopleDescription(people, sharedFilms(people, { includeMinor: false, today: "2026-06-01" }));
    expect(description).toBe("Films made together by A & B: Aliens.");
    // And once the other one is out it is named too.
    const later = peopleDescription(people, sharedFilms(people, { includeMinor: false, today: "2029-12-21" }));
    expect(later).toBe("Films made together by A & B: Aliens, Avatar 4.");
  });

  it("says nothing is shared when the only shared film is announced", () => {
    const upcoming = { ...film(1, 2031), credits: [{ role: "actor" as const, job: "Actor", minor: false }] };
    const people = [timeline(1, "A", [upcoming]), timeline(2, "B", [upcoming])];
    expect(peopleDescription(people, sharedFilms(people, { includeMinor: false, today: "2026-06-01" }))).toBe(
      "No films made together by A & B found on TMDB.",
    );
  });

  it("summarizes a single person, ignoring minor films", () => {
    const solo = timeline(1, "A", [film(1, 1995), film(2, 2003, true), film(3, 2014)]);
    expect(peopleDescription([solo], [])).toBe("A: 2 films from 1995 to 2014 on a timeline.");
  });

  it("handles a single person with no films", () => {
    expect(peopleDescription([timeline(1, "A", [])], [])).toBe("A: filmography timeline.");
  });
});

describe("peopleSocial", () => {
  const social = peopleSocial("A & B: films made together", "Films made together by A & B: Film 1.", "/p/1-a+2-b");

  it("asks for the large image card, so the generated image is shown big", () => {
    expect(social.twitter).toMatchObject({ card: "summary_large_image", title: "A & B: films made together" });
  });

  it("describes the page for Open Graph", () => {
    expect(social.openGraph).toMatchObject({
      title: "A & B: films made together",
      description: "Films made together by A & B: Film 1.",
      url: "/p/1-a+2-b",
      type: "website",
      siteName: "Parallel",
    });
  });

  it("sets no image of its own, leaving og:image and twitter:image to the generated card", () => {
    expect(social.openGraph).not.toHaveProperty("images");
    expect(social.twitter).not.toHaveProperty("images");
  });
});

describe("period metadata", () => {
  const period = { from: 1990, to: 2001 };
  const credit = { role: "actor" as const, job: "Actor", minor: false };
  const dated = (id: number, year: number): Film => ({ ...film(id, year), credits: [credit] });
  const people = [timeline(1, "A", [dated(1, 1985), dated(2, 1995), dated(3, 2000)]), timeline(2, "B", [dated(1, 1985), dated(2, 1995), dated(3, 2000)])];
  const sharedAll = sharedFilms(people, { includeMinor: false, today: "2026-06-01" });

  it("titles the period after the usual title", () => {
    expect(periodTitle("A & B: films made together", period)).toBe("A & B: films made together, 1990–2001");
    expect(periodTitle("A & B: films made together", { from: 1995, to: 1995 })).toBe("A & B: films made together, 1995");
  });

  it("names only the films of the period, and says which years", () => {
    expect(peopleDescription(people, sharedAll, period)).toBe("Films made together by A & B in 1990–2001: Film 2, Film 3.");
  });

  it("says so when the period holds nothing they made together", () => {
    expect(peopleDescription(people, sharedAll, { from: 1986, to: 1994 })).toBe(
      "No films made together by A & B in 1986–1994 found on TMDB.",
    );
  });

  it("leaves the description alone without a period", () => {
    expect(peopleDescription(people, sharedAll, null)).toBe(peopleDescription(people, sharedAll));
    expect(peopleDescription(people, sharedAll)).toBe("Films made together by A & B: Film 1, Film 2, Film 3.");
  });

  it("describes a person's films of the period", () => {
    const solo = timeline(1, "A", [film(1, 1985), film(2, 1995), film(3, 2000), film(4, 2010)]);
    expect(peopleDescription([solo], [], period)).toBe("A: 2 films from 1995 to 2000 on a timeline.");
    expect(peopleDescription([solo], [], { from: 1995, to: 1995 })).toBe("A: 1 film from 1995 to 1995 on a timeline.");
    expect(peopleDescription([solo], [], { from: 1950, to: 1960 })).toBe("A: no films in 1950–1960 found on TMDB.");
  });

  it("points the image at the period route, in the canonical spelling", () => {
    expect(periodImagePath("3151-jack-lemmon+6837-walter-matthau", { from: 1966, to: 1981 })).toBe(
      "/p/3151-jack-lemmon+6837-walter-matthau/og?from=1966&to=1981",
    );
  });

  const social = peopleSocial("T, 1990–2001", "D", "/p/1-a+2-b?from=1990&to=2001", {
    path: "/p/1-a+2-b/og?from=1990&to=2001",
    alt: "T: films from 1990–2001",
  });

  it("sets the image on Open Graph and Twitter when given one", () => {
    const image = { url: "/p/1-a+2-b/og?from=1990&to=2001", width: 1200, height: 630, alt: "T: films from 1990–2001" };
    expect(social.openGraph).toMatchObject({ url: "/p/1-a+2-b?from=1990&to=2001", images: [image] });
    expect(social.twitter).toMatchObject({ card: "summary_large_image", images: [image] });
  });
});

describe("quote metadata", () => {
  const clipping = {
    speaker: "Steven Spielberg",
    about: "John Williams",
    publication: "Variety",
    said_year: 2023,
    date: "2023-01-13",
    quote: "God knows the shark never worked, but Johnny did.",
  };

  it("titles the link with the quote in curly quotes and who said it", () => {
    expect(quoteTitle(clipping)).toBe("\u201cGod knows the shark never worked, but Johnny did.\u201d \u2014 Steven Spielberg");
  });

  it("cuts a long quote to about 90 characters of it, ending in an ellipsis", () => {
    const title = quoteTitle({ ...clipping, quote: "word ".repeat(60) });
    const quote = title.slice(1, title.indexOf("\u201d"));
    expect(quote.endsWith("\u2026")).toBe(true);
    expect(Array.from(quote).length).toBeLessThanOrEqual(90);
    expect(Array.from(quote).length).toBeGreaterThan(80);
    expect(title.endsWith("\u201d \u2014 Steven Spielberg")).toBe(true);
  });

  it("describes who said it about whom, and where and when: the year of the original or of the remark, whichever is older", () => {
    expect(quoteDescription(clipping)).toBe("Steven Spielberg on John Williams \u00b7 Variety, 2023");
    expect(quoteDescription({ ...clipping, said_year: 2011, date: "2012-01-27" })).toBe("Steven Spielberg on John Williams \u00b7 Variety, 2011");
    expect(quoteDescription({ ...clipping, said_year: 2023, date: "2006-07" })).toBe("Steven Spielberg on John Williams \u00b7 Variety, 2006");
  });

  it("leaves the year out when there is none", () => {
    expect(quoteDescription({ ...clipping, said_year: null, date: "" })).toBe("Steven Spielberg on John Williams \u00b7 Variety");
  });

  it("points the image at the card route, asked for the quote by its id", () => {
    expect(quoteImagePath("488-steven-spielberg+491-john-williams", "john-is-much-more-of-a")).toBe(
      "/p/488-steven-spielberg+491-john-williams/og?quote=john-is-much-more-of-a",
    );
  });
});

describe("critic quote metadata", () => {
  const critic = {
    critic: "Rebecca Keegan",
    publication: "Los Angeles Times",
    date: "2012-01",
    quote: "That stylistic versatility has been the foundation of their partnership.",
  };
  const people = [
    { id: 488, name: "Steven Spielberg" },
    { id: 491, name: "John Williams" },
  ];

  it("titles the link with the quote in curly quotes and the critic", () => {
    expect(criticQuoteTitle(critic)).toBe(
      "\u201cThat stylistic versatility has been the foundation of their partnership.\u201d \u2014 Rebecca Keegan",
    );
  });

  it("credits the publication when the piece is not signed, and cuts a long quote as an artist's is cut", () => {
    expect(criticQuoteTitle({ ...critic, critic: null }).endsWith("\u201d \u2014 Los Angeles Times")).toBe(true);
    const title = criticQuoteTitle({ ...critic, quote: "word ".repeat(60) });
    expect(title.slice(1, title.indexOf("\u201d")).endsWith("\u2026")).toBe(true);
  });

  it("describes who wrote it about the pair, in family names, and where and when", () => {
    expect(criticQuoteDescription(critic, people)).toBe("Rebecca Keegan on Spielberg & Williams \u00b7 Los Angeles Times, 2012");
    expect(criticQuoteDescription({ ...critic, critic: null }, people)).toBe("Los Angeles Times on Spielberg & Williams \u00b7 Los Angeles Times, 2012");
  });

  it("leaves the year out when the date is not one", () => {
    expect(criticQuoteDescription({ ...critic, date: "" }, people)).toBe("Rebecca Keegan on Spielberg & Williams \u00b7 Los Angeles Times");
  });
});

describe("player card metadata", () => {
  const image = { path: "/p/1-a+2-b/og?quote=q", alt: "alt" };
  const player = { path: "/embed/q/1-a+2-b/q", width: 1200, height: 630 };
  const social = peopleSocial("T", "D", "/p/1-a+2-b/q/q", image, player);

  it("asks for the player card, with the quote's card image as the poster", () => {
    const poster = { url: "/p/1-a+2-b/og?quote=q", width: 1200, height: 630, alt: "alt" };
    expect(social.twitter).toMatchObject({ card: "player", title: "T", description: "D", images: [poster] });
  });

  it("names the page to frame with an absolute URL, and its size, as plain tags (Next's `players` would add a stream tag)", () => {
    expect(social.other).toEqual({
      "twitter:player": "https://parallel.zachherring.com/embed/q/1-a+2-b/q",
      "twitter:player:width": "1200",
      "twitter:player:height": "630",
    });
    expect(social.twitter).toMatchObject({ players: [] });
  });

  it("keeps the Open Graph tags as they are for any other site that unfurls the link", () => {
    expect(social.openGraph).toMatchObject({
      title: "T",
      description: "D",
      url: "/p/1-a+2-b/q/q",
      type: "website",
      siteName: "Parallel",
      images: [{ url: "/p/1-a+2-b/og?quote=q", width: 1200, height: 630, alt: "alt" }],
    });
  });

  it("adds nothing to a link with no player: the large image card and no extra tags", () => {
    const plain = peopleSocial("T", "D", "/p/1-a+2-b", image);
    expect(plain.twitter).toMatchObject({ card: "summary_large_image" });
    expect(plain).not.toHaveProperty("other");
  });

  it("makes a path absolute on the site's origin", () => {
    expect(absoluteUrl("/embed/q/1-a+2-b/q")).toBe("https://parallel.zachherring.com/embed/q/1-a+2-b/q");
  });

  it("words the share URL as the Clippings link to the quote is worded", () => {
    const quote = { quote: "God knows the shark never worked, but Johnny did.", speaker: "Steven Spielberg", about: "John Williams", publication: "Variety", year: 2023 };
    expect(embedQuoteText(quote)).toEqual({
      title: "\u201cGod knows the shark never worked, but Johnny did.\u201d \u2014 Steven Spielberg",
      description: "Steven Spielberg on John Williams \u00b7 Variety, 2023",
    });
    expect(embedQuoteText({ ...quote, year: null }).description).toBe("Steven Spielberg on John Williams \u00b7 Variety");
  });
});
