import { describe, expect, it } from "vitest";
import type { CardFilm } from "@/lib/card-films";
import {
  CHIP,
  COMPOSITION_BOTTOM,
  COMPOSITION_TOP,
  DOT_SPREAD,
  HEADSHOT,
  HEADSHOT_OVERHANG_RATIO,
  HEADSHOT_SCALE,
  MIN_BOTTOM_CLEARANCE,
  NODE_SIZE,
  OG_ACTIVE_CENTER,
  OG_ACTIVE_INSET,
  OG_ACTIVE_ZONE,
  OG_CENTER_X,
  OG_FAN_WIDTH,
  OG_FAN_ZONE,
  OG_HEIGHT,
  OG_LANE_SCOPE,
  OG_MAX_DIM_DOTS,
  OG_MAX_PX_PER_YEAR,
  OG_MIN_DOT_OPACITY,
  OG_POSTER,
  OG_POSTER_MAX,
  OG_POSTER_TARGET,
  OG_WIDTH,
  OVERLAY_FONT,
  OVERLAY_MAX_LINES,
  OVERLAY_PAD,
  POSTER_GAP,
  YEAR_LABEL_HALF,
  activeYearsLabel,
  axisDots,
  buildOgCard,
  captionText,
  clampLines,
  composition,
  dotPositions,
  filmsCaption,
  fitOverlayNames,
  headshotFan,
  headshotOverhang,
  laneFade,
  laneFilms,
  laneScale,
  pickTimelineFilms,
  placeDots,
  plainCaption,
  posterRow,
  sampleEvenly,
  textWidth,
  truncateName,
  truncateToFit,
  wrapWords,
  yearLabelXs,
  yearRange,
} from "@/lib/og-card";
import { periodLabel } from "@/lib/period";
import { yearFraction } from "@/lib/timeline-layout";
import type { Film, PersonTimeline } from "@/lib/types";

const TODAY = "2026-10-27";

const film = (id: number, year: number, over: Partial<Film> = {}): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${year}-06-01`,
  year,
  posterPath: `/poster-${id}.jpg`,
  voteCount: 100,
  credits: [{ role: "director", job: "Director", minor: false }],
  minor: false,
  ...over,
});

const timeline = (id: number, name: string, films: Film[], profilePath: string | null = `/face-${id}.jpg`): PersonTimeline => ({
  person: { id, name, profilePath, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

describe("truncateName", () => {
  it("keeps names that fit", () => {
    expect(truncateName("Ethan Hawke", 20)).toBe("Ethan Hawke");
    expect(truncateName("Ethan Hawke", 11)).toBe("Ethan Hawke");
  });

  it("cuts long names to the limit with an ellipsis", () => {
    const cut = truncateName("Christopher Nolan-Hawthorne", 12);
    expect(cut).toBe("Christopher…");
    expect(Array.from(cut)).toHaveLength(12);
  });

  it("does not leave a space before the ellipsis, or split a character", () => {
    expect(truncateName("Anna Maria Delvaux", 6)).toBe("Anna…");
    expect(truncateName("𝒜𝒷𝒸𝒹𝒺𝒻", 4)).toBe("𝒜𝒷𝒸…");
  });
});

describe("pickTimelineFilms", () => {
  const candidate = (id: number, year: number, voteCount: number, posterPath: string | null = `/p${id}.jpg`, releaseDate = `${year}-01-01`): CardFilm => ({
    id,
    title: `Film ${id}`,
    year,
    releaseDate,
    posterPath,
    voteCount,
  });
  /** Ten films, 1990 to 1999, whose votes are given by `votes`. */
  const decade = (votes: number[]) => votes.map((v, i) => candidate(i + 1, 1990 + i, v));

  it("always shows the first and the last film, then the best known in between, oldest first", () => {
    // 1990 is the first and 1999 the last; of the rest the four most voted are 1991 (900), 1993 (800), 1994 (700) and 1996 (600).
    const picked = pickTimelineFilms(decade([1, 900, 5, 800, 700, 10, 600, 3, 20, 2]));
    expect(picked.map((p) => p.id)).toEqual([1, 2, 4, 5, 7, 10]);
    expect(picked).toHaveLength(OG_POSTER_TARGET);
  });

  it("keeps the first and last film even when they are the least known", () => {
    const picked = pickTimelineFilms(decade([1, 9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 2]));
    // 1990 and 1999 first and last; the four most voted of the eight between are 1991 to 1994.
    expect(picked.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 10]);
  });

  it("shows every film when there are no more than the target", () => {
    for (let n = 1; n <= OG_POSTER_TARGET; n++) {
      const films = Array.from({ length: n }, (_, i) => candidate(i + 1, 2000 + i, 10 * (i + 1)));
      expect(pickTimelineFilms(films).map((poster) => poster.id)).toEqual(films.map((f) => f.id));
    }
  });

  it("takes as many as asked for, up to the layout's maximum, and never more", () => {
    const films = Array.from({ length: 12 }, (_, i) => candidate(i + 1, 1990 + i, 100 - i));
    expect(pickTimelineFilms(films, OG_POSTER_MAX)).toHaveLength(OG_POSTER_MAX);
    expect(pickTimelineFilms(films, 3)).toHaveLength(3);
    expect(pickTimelineFilms(films, 2).map((p) => p.id)).toEqual([1, 12]);
    expect(pickTimelineFilms(films, 1).map((p) => p.id)).toEqual([1]);
    expect(pickTimelineFilms(films, 0)).toEqual([]);
  });

  it("prefers films with a poster for the slots in between", () => {
    const picked = pickTimelineFilms(
      [
        candidate(1, 1990, 1),
        candidate(2, 1995, 9999, null),
        candidate(3, 2000, 5),
        candidate(4, 2005, 4),
        candidate(5, 2010, 1),
      ],
      4,
    );
    expect(picked.map((p) => p.id)).toEqual([1, 3, 4, 5]);
  });

  it("falls back to films without a poster when there are not enough with one", () => {
    const picked = pickTimelineFilms(
      [candidate(1, 1990, 1, null), candidate(2, 1995, 50, null), candidate(3, 2000, 5), candidate(4, 2010, 1, null)],
      4,
    );
    expect(picked.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(picked[0].posterPath).toBeNull();
  });

  it("breaks ties the same way every time: votes, then id", () => {
    const sameDay = [candidate(7, 1999, 10, "/a.jpg", "1999-05-05"), candidate(3, 1999, 10, "/b.jpg", "1999-05-05"), candidate(5, 1999, 30, "/c.jpg", "1999-05-05")];
    const other = [candidate(9, 2005, 1), candidate(8, 2005, 1)];
    const forward = pickTimelineFilms([...sameDay, ...other], 2);
    const backward = pickTimelineFilms([...other, ...sameDay].reverse(), 2);
    expect(forward).toEqual(backward);
    // First: the best known of the earliest day (id 5); last: the lower id among equally known (8).
    expect(forward.map((p) => p.id)).toEqual([5, 8]);
  });

  it("copes with every film released on one day", () => {
    const picked = pickTimelineFilms([candidate(1, 2001, 5), candidate(2, 2001, 9), candidate(3, 2001, 7)]);
    expect(picked.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it("does not change its input, and returns only what the card draws", () => {
    const input = [candidate(2, 2002, 5), candidate(1, 2001, 5), candidate(3, 2003, 5)];
    const copy = [...input];
    const picked = pickTimelineFilms(input);
    expect(input).toEqual(copy);
    expect(picked[0]).toEqual({ id: 1, title: "Film 1", year: 2001, posterPath: "/p1.jpg" });
  });

  it("has nothing for no films", () => {
    expect(pickTimelineFilms([])).toEqual([]);
  });

  describe("axisDots", () => {
    it("has a dot for every film, oldest first, the posters' films featured", () => {
      const films = decade([1, 900, 5, 800, 700, 10, 600, 3, 20, 2]);
      const dots = axisDots(films, pickTimelineFilms(films));
      expect(dots.map((d) => d.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(dots.filter((d) => d.featured).map((d) => d.id)).toEqual([1, 2, 4, 5, 7, 10]);
      expect(dots.filter((d) => !d.featured).map((d) => d.id)).toEqual([3, 6, 8, 9]);
      expect(dots[0]).toEqual({ id: 1, releaseDate: "1990-01-01", featured: true });
    });

    it("has only featured dots when every film has a poster, and none without films", () => {
      const films = decade([1, 2, 3]).slice(0, 3);
      expect(axisDots(films, pickTimelineFilms(films)).every((d) => d.featured)).toBe(true);
      expect(axisDots([], [])).toEqual([]);
    });

    it("lists a film that two people made once", () => {
      const films = [...decade([1, 2, 3]).slice(0, 3), ...decade([1, 2, 3]).slice(0, 3)];
      expect(axisDots(films, [])).toHaveLength(3);
    });

    it("does not thin: that is for `placeDots`, once the dots are placed", () => {
      const films = Array.from({ length: 200 }, (_, i) => candidate(i + 1, 1900 + Math.floor(i / 2), 100 - (i % 50)));
      expect(axisDots(films, pickTimelineFilms(films))).toHaveLength(200);
    });
  });

  describe("sampleEvenly", () => {
    it("takes everything when there is no more than the maximum", () => {
      expect(sampleEvenly([1, 2, 3], 3)).toEqual([1, 2, 3]);
      expect(sampleEvenly([1, 2, 3], 9)).toEqual([1, 2, 3]);
      expect(sampleEvenly([], 3)).toEqual([]);
    });

    it("spreads the sample evenly through the list, keeping the first and the last", () => {
      const sample = sampleEvenly(Array.from({ length: 101 }, (_, i) => i), 11);
      expect(sample).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    });

    it("copes with a maximum of one or none", () => {
      expect(sampleEvenly([5, 6, 7], 1)).toEqual([5]);
      expect(sampleEvenly([5, 6, 7], 0)).toEqual([]);
    });
  });
});

describe("filmsCaption", () => {
  const years = (...list: number[]) => list.map((year) => ({ year }));
  const text = (list: number[]) => captionText(filmsCaption(years(...list))!);

  it("counts the films over the years from the first to the last", () => {
    expect(text([1998, 2003, 2010, 2018, 2008, 2005, 2001, 2000, 2002, 2006, 2012])).toBe("11 films over 20 years");
  });

  it("is singular for one film, and says the year instead of a span", () => {
    expect(text([1994])).toBe("1 film in 1994");
  });

  it("names the year when every film is from one", () => {
    expect(text([1994, 1994, 1994])).toBe("3 films in 1994");
  });

  it("is singular for one year", () => {
    expect(text([1994, 1995])).toBe("2 films over 1 year");
  });

  it("never says 1 films or 0 years", () => {
    for (const list of [[2000], [2000, 2000], [2000, 2001], [2000, 2002], [1990, 2020]]) {
      expect(text(list)).not.toMatch(/\b1 films\b|\b0 years?\b/);
    }
  });

  it("accents both numbers, the count and the years, and nothing else", () => {
    expect(filmsCaption(years(1990, 2000))?.segments).toEqual([
      { text: "2", accent: true },
      { text: " films over ", accent: false },
      { text: "10", accent: true },
      { text: " years", accent: false },
    ]);
    expect(filmsCaption(years(1990, 1991))?.segments.filter((segment) => segment.accent).map((segment) => segment.text)).toEqual(["2", "1"]);
  });

  it("accents the count and the year of films in one year", () => {
    expect(filmsCaption(years(1994))?.segments).toEqual([
      { text: "1", accent: true },
      { text: " film in ", accent: false },
      { text: "1994", accent: true },
    ]);
    expect(filmsCaption(years(1994, 1994, 1994))?.segments.filter((segment) => segment.accent).map((segment) => segment.text)).toEqual(["3", "1994"]);
  });

  it("leaves plain words unaccented", () => {
    expect(plainCaption("Careers side by side")).toEqual({ segments: [{ text: "Careers side by side", accent: false }] });
    expect(captionText(plainCaption("Careers side by side"))).toBe("Careers side by side");
  });

  it("reads as one line of text", () => {
    expect(captionText(filmsCaption(years(2000, 2010))!)).toBe("2 films over 10 years");
  });

  it("has no caption without films", () => {
    expect(filmsCaption([])).toBeNull();
  });
});

describe("yearRange", () => {
  const years = (...list: number[]) => list.map((year) => ({ year }));

  it("runs from the first film's year to the last one's", () => {
    expect(yearRange(years(1998, 1966, 1981))).toEqual({ first: 1966, last: 1998 });
  });

  it("is one year when every film is from it", () => {
    expect(yearRange(years(1994))).toEqual({ first: 1994, last: 1994 });
    expect(yearRange(years(1994, 1994))).toEqual({ first: 1994, last: 1994 });
  });

  it("is nothing without films", () => {
    expect(yearRange([])).toBeNull();
  });
});

describe("buildOgCard", () => {
  const linklater = timeline(564, "Richard Linklater", [
    film(10, 1995, { voteCount: 5000 }),
    film(11, 2004, { voteCount: 4000 }),
    film(12, 2013, { voteCount: 3000 }),
    film(13, 2014, { voteCount: 6000 }),
    film(14, 2016, { voteCount: 100 }),
    film(99, 1990, { voteCount: 10 }),
  ]);
  const hawke = timeline(569, "Ethan Hawke", [
    film(10, 1995, { voteCount: 5100 }),
    film(11, 2004, { voteCount: 4000 }),
    film(12, 2013, { voteCount: 2900 }),
    film(13, 2014, { voteCount: 6000 }),
    film(14, 2016, { voteCount: 100 }),
    film(77, 2001, { voteCount: 9000 }),
  ]);

  it("describes a pair: both people, the shared films as posters and dots, the years and the caption", () => {
    const card = buildOgCard([linklater, hawke], TODAY);
    expect(card.kind).toBe("pair");
    expect(captionText(card.caption!)).toBe("5 films over 21 years");
    expect(card.years).toEqual({ first: 1995, last: 2016 });
    expect(card.people.map((p) => p.overlay.join(" "))).toEqual(["Richard Linklater", "Ethan Hawke"]);
    expect(card.people.map((p) => p.name)).toEqual(["Richard Linklater", "Ethan Hawke"]);
    expect(card.people.map((p) => p.initials)).toEqual(["RL", "EH"]);
    expect(card.people[0].profilePath).toBe("/face-564.jpg");
    expect(card.period).toBeNull();
    // Five shared films, fewer than the target: all of them have a poster and a green node, oldest first.
    expect(card.posters.map((p) => p.id)).toEqual([10, 11, 12, 13, 14]);
    // The lane also has a grey dot for the film each of them made alone (99 and 77), in date order.
    expect(card.dots.map((d) => [d.id, d.featured])).toEqual([[99, false], [10, true], [77, false], [11, true], [12, true], [13, true], [14, true]]);
  });

  it("shows the best known films as posters and the rest as dim dots, when there are more than fit", () => {
    const many = Array.from({ length: 12 }, (_, i) => film(i + 1, 1990 + i, { voteCount: i === 3 || i === 5 ? 9000 : 100 - i }));
    const card = buildOgCard([timeline(1, "A One", many), timeline(2, "B Two", many)], TODAY);
    expect(card.posters).toHaveLength(OG_POSTER_TARGET);
    // The first and last film, the two with 9000 votes (4 and 6), and the two best known of the rest (2 and 3).
    expect(card.posters.map((p) => p.id)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(card.dots).toHaveLength(12);
    expect(card.dots.filter((d) => d.featured)).toHaveLength(OG_POSTER_TARGET);
    expect(card.dots.filter((d) => !d.featured)).toHaveLength(12 - OG_POSTER_TARGET);
    expect(card.dots.map((d) => d.releaseDate)).toEqual([...card.dots.map((d) => d.releaseDate)].sort());
  });

  it("never gives a film only one of them made a poster or a green node, only a grey dot", () => {
    const card = buildOgCard([linklater, hawke], TODAY);
    expect(card.posters.map((p) => p.id)).not.toContain(77);
    expect(card.posters.map((p) => p.id)).not.toContain(99);
    expect(card.dots.filter((d) => d.featured).map((d) => d.id)).not.toContain(77);
    expect(card.dots.find((d) => d.id === 77)?.featured).toBe(false);
  });

  it("is singular for one shared film, with its year", () => {
    const a = timeline(1, "A One", [film(1, 2000)]);
    const b = timeline(2, "B Two", [film(1, 2000), film(2, 2005)]);
    const card = buildOgCard([a, b], TODAY);
    expect(captionText(card.caption!)).toBe("1 film in 2000");
    expect(card.years).toEqual({ first: 2000, last: 2000 });
    expect(card.posters.map((p) => p.id)).toEqual([1]);
    // The lane also has a grey dot for the film only B made.
    expect(card.dots.map((d) => [d.id, d.featured])).toEqual([[1, true], [2, false]]);
  });

  it("counts only released films together, and gives an announced one no poster or dot", () => {
    // 2027 is after TODAY (2026-10-27): both list it, but it is not a film made together yet.
    const a = timeline(1, "A One", [film(1, 2000), film(2, 2027, { voteCount: 99999 })]);
    const b = timeline(2, "B Two", [film(1, 2000), film(2, 2027, { voteCount: 99999 })]);
    const card = buildOgCard([a, b], TODAY);
    expect(captionText(card.caption!)).toBe("1 film in 2000");
    expect(card.posters.map((p) => p.id)).toEqual([1]);
    expect(card.dots.map((d) => d.id)).toEqual([1]);
  });

  it("counts a film released today", () => {
    const a = timeline(1, "A One", [film(1, 2000), film(2, 2026, { releaseDate: TODAY })]);
    const b = timeline(2, "B Two", [film(1, 2000), film(2, 2026, { releaseDate: TODAY })]);
    expect(captionText(buildOgCard([a, b], TODAY).caption!)).toBe("2 films over 26 years");
    expect(captionText(buildOgCard([a, b], "2026-10-26").caption!)).toBe("1 film in 2000");
  });

  it("falls back to the careers when the only shared film is announced", () => {
    const a = timeline(1, "A One", [film(1, 2000), film(2, 2028)]);
    const b = timeline(2, "B Two", [film(3, 2005), film(2, 2028)]);
    const card = buildOgCard([a, b], TODAY);
    expect(captionText(card.caption!)).toBe("Careers side by side");
    // Their own released films, once each, oldest first; the announced one is not among them.
    expect(card.posters.map((p) => p.id)).toEqual([1, 3]);
    expect(card.years).toEqual({ first: 2000, last: 2005 });
  });

  it("shows the careers side by side when nothing is shared", () => {
    const a = timeline(1, "A One", [film(1, 2000), film(4, 2010)]);
    const b = timeline(2, "B Two", [film(2, 2005), film(5, 2012), film(3, 1999)]);
    const card = buildOgCard([a, b], TODAY);
    expect(captionText(card.caption!)).toBe("Careers side by side");
    expect(card.posters.map((p) => p.id)).toEqual([3, 1, 2, 4, 5]);
    expect(card.years).toEqual({ first: 1999, last: 2012 });
  });

  it("counts films the way the page does: minor credits are left out", () => {
    const minorCredits = [{ role: "other" as const, job: "Thanks", minor: true }];
    const a = timeline(1, "A One", [film(1, 2000), film(2, 2001, { minor: true, credits: minorCredits })]);
    const b = timeline(2, "B Two", [film(1, 2000), film(2, 2001, { minor: true, credits: minorCredits })]);
    expect(captionText(buildOgCard([a, b], TODAY).caption!)).toBe("1 film in 2000");
  });

  it("writes each person's name over their headshot: the full name for one or two people", () => {
    const people = [timeline(7467, "David Fincher", [film(1, 1999)]), timeline(7479, "Jeff Cronenweth", [film(1, 1999)])];
    const one = buildOgCard(people.slice(0, 1), TODAY);
    expect(one.people[0].overlay).toEqual(["David Fincher"]);
    const two = buildOgCard(people, TODAY);
    // The second card shows 188px: its whole name fits on one line.
    expect(two.people.map((p) => p.overlay)).toEqual([["David Fincher"], ["Jeff Cronenweth"]]);
    expect(two.overlayFontSize).toBeGreaterThanOrEqual(OVERLAY_FONT.min);
    expect(two.overlayFontSize).toBeLessThanOrEqual(OVERLAY_FONT.max);
  });

  it("fits the names of three and four people over their cards, each in the part of its card that shows", () => {
    const people = [
      timeline(7467, "David Fincher", [film(1, 1999)]),
      timeline(7479, "Jeff Cronenweth", [film(1, 1999)]),
      timeline(287, "Brad Pitt", [film(1, 1999)]),
      timeline(819, "Edward Norton", [film(1, 1999)]),
    ];
    const three = buildOgCard(people.slice(0, 3), TODAY);
    // Cards 158px wide, the covered ones showing 109px: every full name fits (at 15px, for "Cronenweth"), so full names are kept.
    expect(three.people.map((p) => p.overlay.join(" "))).toEqual(["David Fincher", "Jeff Cronenweth", "Brad Pitt"]);
    expect(three.overlayFontSize).toBe(15);
    const four = buildOgCard(people, TODAY);
    // The covered cards show 104px: "Cronenweth" fits that at 14px (which is why 14 is the smallest size), not cut.
    expect(four.people.map((p) => p.overlay)).toEqual([["David Fincher"], ["Jeff", "Cronenweth"], ["Brad Pitt"], ["Edward", "Norton"]]);
    expect(four.overlayFontSize).toBe(OVERLAY_FONT.min);
  });

  it("switches to the family name when only that fits", () => {
    const people = [
      timeline(1, "Alexander Brandenburg", [film(1, 1999)]),
      timeline(2, "Maximilian Li", [film(1, 1999)]),
      timeline(3, "Cy Wu", [film(1, 1999)]),
      timeline(4, "Di Wang", [film(1, 1999)]),
    ];
    const card = buildOgCard(people, TODAY);
    // The first card shows 180px, so "Alexander Brandenburg" fits whole; the covered cards show 96px, too narrow for "Maximilian".
    expect(card.people[0].overlay).toEqual(["Alexander", "Brandenburg"]);
    expect(card.people[1].overlay).toEqual(["Li"]);
    expect(card.people[2].overlay.join(" ")).toBe("Cy Wu");
  });

  it("keeps every name to three lines at the smallest, cutting names that are far too long with an ellipsis", () => {
    const people = [1, 2, 3, 4].map((i) => timeline(i, `Some ${"Wolfeschlegelsteinhausenbergerdorff"}${i}`, [film(1, 1999)]));
    const card = buildOgCard(people, TODAY);
    expect(card.overlayFontSize).toBe(OVERLAY_FONT.min);
    for (const person of card.people) {
      expect(person.overlay.length).toBeLessThanOrEqual(OVERLAY_MAX_LINES);
      expect(person.overlay[person.overlay.length - 1].endsWith("…")).toBe(true);
    }
  });

  it("falls back to the full name for one or two people, however long it is", () => {
    const long = buildOgCard([timeline(1, "Florian Henckel von Donnersmarck", [film(1, 1999)])], TODAY);
    expect(long.people[0].overlay.join(" ")).toBe("Florian Henckel von Donnersmarck");
  });

  it("falls back to initials data when a person has no photo", () => {
    const card = buildOgCard([timeline(1, "Madonna", [film(1, 1985)], null), timeline(2, "Guy Ritchie", [film(1, 1985)])], TODAY);
    expect(card.people[0]).toMatchObject({ initials: "M", profilePath: null });
  });

  it("describes one person by their career: first film, best known ones, last film, every other film a dot", () => {
    const solo = timeline(7467, "David Fincher", [
      film(1, 1992, { voteCount: 3000 }),
      film(2, 1995, { voteCount: 20000 }),
      film(3, 1999, { voteCount: 25000 }),
      film(4, 2010, { voteCount: 11000 }),
      film(5, 2014, { voteCount: 15000 }),
      film(6, 2023, { voteCount: 5000, posterPath: null }),
      film(7, 2001, { minor: true, voteCount: 99999 }),
      film(8, 2030, { voteCount: 1, releaseDate: "2030-01-01" }),
    ]);
    const card = buildOgCard([solo], TODAY);
    expect(card.kind).toBe("solo");
    expect(card.people).toHaveLength(1);
    expect(card.people[0].overlay).toEqual(["David Fincher"]);
    // Not the minor one, not the announced one. Six films, so all six have a poster (the last, with none: a plain card).
    expect(card.posters.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(card.posters[5].posterPath).toBeNull();
    expect(card.dots.every((d) => d.featured)).toBe(true);
    expect(captionText(card.caption!)).toBe("6 films over 31 years");
    expect(card.years).toEqual({ first: 1992, last: 2023 });
  });

  it("uses a person's minor films only when they have no others", () => {
    const minor = { minor: true, credits: [{ role: "other" as const, job: "Thanks", minor: true }] };
    const onlyMinor = timeline(1, "Cameo King", [film(1, 2000, minor), film(2, 2003, minor)]);
    expect(buildOgCard([onlyMinor], TODAY).dots.map((d) => d.id)).toEqual([1, 2]);
    const mixed = timeline(1, "Cameo King", [film(1, 2000, minor), film(2, 2003)]);
    expect(buildOgCard([mixed], TODAY).dots.map((d) => d.id)).toEqual([2]);
  });

  it("handles a person with no films", () => {
    const card = buildOgCard([timeline(1, "Newcomer", [])], TODAY);
    expect(card.posters).toEqual([]);
    expect(card.dots).toEqual([]);
    expect(card.years).toBeNull();
    expect(captionText(card.caption!)).toBe("Filmography");
  });

  it("is singular for a person with one film", () => {
    expect(captionText(buildOgCard([timeline(1, "Solo Artist", [film(1, 2010)])], TODAY).caption!)).toBe("1 film in 2010");
  });

  describe("with a period", () => {
    const films = [1966, 1968, 1971, 1974, 1981, 1991, 1993, 1995, 1997, 1998].map((year, i) =>
      film(i + 1, year, { voteCount: 1000 - i * 10 }),
    );
    const a = timeline(1, "A One", films);
    const b = timeline(2, "B Two", films);

    it("draws only the films of those years: its own first and last, notable films, years and caption", () => {
      const card = buildOgCard([a, b], TODAY, { from: 1968, to: 1981 });
      expect(card.period).toBe("1968–1981");
      expect(card.dots.map((d) => d.releaseDate.slice(0, 4))).toEqual(["1968", "1971", "1974", "1981"]);
      expect(card.posters.map((p) => p.year)).toEqual([1968, 1971, 1974, 1981]);
      expect(card.years).toEqual({ first: 1968, last: 1981 });
      expect(captionText(card.caption!)).toBe("4 films over 13 years");
    });

    it("gives the years of the period's films, which can be inside the period itself", () => {
      const card = buildOgCard([a, b], TODAY, { from: 1967, to: 1990 });
      expect(card.period).toBe("1967–1990");
      expect(card.years).toEqual({ first: 1968, last: 1981 });
    });

    it("picks the notable films from the slice, not from the whole career", () => {
      const card = buildOgCard([a, b], TODAY, { from: 1991, to: 1998 });
      expect(card.posters.map((p) => p.year)).toEqual([1991, 1993, 1995, 1997, 1998]);
      expect(captionText(card.caption!)).toBe("5 films over 7 years");
    });

    it("captions a period of one film or one year plainly", () => {
      const one = buildOgCard([a, b], TODAY, { from: 1981, to: 1990 });
      expect(captionText(one.caption!)).toBe("1 film in 1981");
      expect(one.years).toEqual({ first: 1981, last: 1981 });
      const same = timeline(3, "C Three", [film(1, 2000), film(2, 2000), film(3, 2000), film(4, 2005)]);
      const other = timeline(4, "D Four", [film(1, 2000), film(2, 2000), film(3, 2000), film(4, 2005)]);
      const card = buildOgCard([same, other], TODAY, { from: 2000, to: 2000 });
      expect(card.period).toBe("2000");
      expect(captionText(card.caption!)).toBe("3 films in 2000");
    });

    it("says so when the period holds no films", () => {
      const card = buildOgCard([a, b], TODAY, { from: 1982, to: 1990 });
      expect(card.posters).toEqual([]);
      expect(card.dots).toEqual([]);
      expect(card.years).toBeNull();
      expect(captionText(card.caption!)).toBe("No films in 1982–1990");
    });

    it("cuts a person's career too", () => {
      const card = buildOgCard([a], TODAY, { from: 1991, to: 1993 });
      expect(card.kind).toBe("solo");
      expect(card.posters.map((p) => p.year)).toEqual([1991, 1993]);
    });

    it("is the whole card without one", () => {
      expect(buildOgCard([a, b], TODAY, null)).toEqual(buildOgCard([a, b], TODAY));
    });
  });
});

describe("textWidth", () => {
  it("measures a name by the width of its letters: narrow ones narrow, wide ones wide", () => {
    expect(textWidth("ill", 16)).toBeLessThan(textWidth("nnn", 16));
    expect(textWidth("www", 16)).toBeGreaterThan(textWidth("nnn", 16));
    expect(textWidth("Cronenweth", 15)).toBeGreaterThan(textWidth("Taylor", 15));
  });

  it("grows in proportion to the type size, and counts an accent as its letter", () => {
    expect(textWidth("Jack Lemmon", 20) / textWidth("Jack Lemmon", 10)).toBeCloseTo(2, 8);
    expect(textWidth("Frías", 16)).toBeCloseTo(textWidth("Frias", 16), 8);
    expect(textWidth("", 16)).toBe(0);
  });

  it("is close to what the renderer sets: 'Cronenweth' at 16px is about 95px wide, 'Taylor-Johns…' about 118", () => {
    expect(textWidth("Cronenweth", 16)).toBeGreaterThan(90);
    expect(textWidth("Cronenweth", 16)).toBeLessThan(102);
    expect(textWidth("Taylor-Johns…", 16)).toBeGreaterThan(112);
    expect(textWidth("Taylor-Johns…", 16)).toBeLessThan(126);
  });
});

describe("wrapWords, clampLines and truncateToFit", () => {
  /** A line fits when it has at most `n` characters. */
  const within = (n: number) => (line: string) => Array.from(line).length <= n;

  it("breaks text into lines at the spaces", () => {
    expect(wrapWords("Fincher, Cronenweth, & Pitt", within(30))).toEqual(["Fincher, Cronenweth, & Pitt"]);
    expect(wrapWords("Fincher, Cronenweth, & Pitt", within(20))).toEqual(["Fincher, Cronenweth,", "& Pitt"]);
    expect(wrapWords("", within(20))).toEqual([]);
  });

  it("gives up (null) when a word does not fit a line", () => {
    expect(wrapWords("Schwarzenegger, & Pitt", within(10))).toBeNull();
  });

  it("keeps text that fits as it is", () => {
    expect(clampLines("Fincher, Cronenweth, & Pitt", within(20), 2)).toEqual(["Fincher, Cronenweth,", "& Pitt"]);
  });

  it("cuts the last line with an ellipsis when the text runs on", () => {
    expect(clampLines("aaa bbb ccc ddd eee fff", within(7), 2)).toEqual(["aaa bbb", "ccc dd…"]);
  });

  it("cuts a word that does not fit a line, and never gives more lines than allowed", () => {
    const lines = clampLines("Wolfeschlegelsteinhausenberger, Smith, & Jones", within(12), 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("Wolfeschleg…");
    for (const line of lines) expect(Array.from(line).length).toBeLessThanOrEqual(12);
  });

  it("handles a single line and no text", () => {
    expect(clampLines("one two three", within(5), 1)).toEqual([truncateName("one two three", 5)]);
    expect(clampLines("", within(10), 2)).toEqual([]);
  });

  it("cuts text to the most that fits with an ellipsis, and leaves what fits alone", () => {
    expect(truncateToFit("Diamantopoulos", within(8))).toBe("Diamant…");
    expect(truncateToFit("Pitt", within(8))).toBe("Pitt");
    expect(truncateToFit("Anna Maria", within(6))).toBe("Anna…");
    expect(truncateToFit("anything", within(0))).toBe("…");
  });
});

describe("fitOverlayNames", () => {
  const room = (visible: number) => visible - OVERLAY_PAD.left - OVERLAY_PAD.right;
  const fits = (line: string, visible: number, fontSize: number) => textWidth(line, fontSize) <= room(visible);

  it("sets a name that fits one line as large as the type goes", () => {
    const names = fitOverlayNames([["Jack Lemmon"]], [180]);
    expect(names).toEqual({ lines: [["Jack Lemmon"]], fontSize: OVERLAY_FONT.max });
  });

  it("wraps a name that does not fit one line at the largest size that fits it in three lines, without cutting a word", () => {
    const names = fitOverlayNames([["Christopher Nolan"], ["Christian Bale"]], [150, 120]);
    expect(names.lines).toEqual([["Christopher", "Nolan"], ["Christian", "Bale"]]);
    expect(names.fontSize).toBeLessThanOrEqual(OVERLAY_FONT.max);
    expect(names.fontSize).toBeGreaterThanOrEqual(OVERLAY_FONT.min);
    names.lines.forEach((lines, i) => {
      for (const line of lines) expect(fits(line, [150, 120][i], names.fontSize)).toBe(true);
    });
  });

  it("gives the whole row one size: the largest every name fits at", () => {
    const loose = fitOverlayNames([["Al Li"], ["Bo Ng"]], [180, 140]);
    const tight = fitOverlayNames([["Al Li"], ["Bartholomew Montgomery"]], [180, 110]);
    expect(loose.fontSize).toBe(OVERLAY_FONT.max);
    expect(tight.fontSize).toBeLessThan(OVERLAY_FONT.max);
  });

  it("fits 'Cronenweth' into the 104px a covered card shows with four people, by using the smallest size", () => {
    const names = fitOverlayNames([["David Fincher"], ["Jeff Cronenweth"], ["Brad Pitt"], ["Edward Norton"]], [158, 104, 104, 104]);
    expect(names.fontSize).toBe(OVERLAY_FONT.min);
    expect(names.lines[1]).toEqual(["Jeff", "Cronenweth"]);
    expect(fits("Cronenweth", 104, OVERLAY_FONT.min)).toBe(true);
    expect(fits("Cronenweth", 104, OVERLAY_FONT.min + 1)).toBe(false);
    expect(OVERLAY_FONT.min).toBe(14);
  });

  it("takes the first candidate that fits, so the family name stands in only when the full one will not", () => {
    // 80px shows 64px of text: "Cronenweth" never fits (even at 14px it is 85px). 56px shows 40: "Wang" does not fit, so "Park" stands in.
    const names = fitOverlayNames([["Edward Norton", "Norton"], ["Jeff Cronenweth", "Cronenweth"], ["Jo Li Wang Kim Park", "Park"]], [96, 80, 56]);
    expect(names.lines[0]).toEqual(["Edward", "Norton"]);
    expect(names.lines[1].join(" ").endsWith("…")).toBe(true);
    expect(names.lines[2]).toEqual(["Park"]);
  });

  it("falls to the smallest size and cuts with an ellipsis when it still does not fit", () => {
    const names = fitOverlayNames([["Wolfeschlegelsteinhausenbergerdorff"]], [96]);
    expect(names.fontSize).toBe(OVERLAY_FONT.min);
    expect(names.lines[0]).toHaveLength(1);
    expect(names.lines[0][0].endsWith("…")).toBe(true);
    expect(fits(names.lines[0][0], 96, OVERLAY_FONT.min)).toBe(true);
  });

  it("never gives more lines than allowed", () => {
    for (const visible of [60, 96, 124, 180]) {
      const names = fitOverlayNames([["Mary Elizabeth Mastrantonio Delvaux Montgomery"]], [visible]);
      expect(names.lines[0].length).toBeLessThanOrEqual(OVERLAY_MAX_LINES);
    }
  });

  it("copes with no names, and with a person with nothing to write", () => {
    expect(fitOverlayNames([], [])).toEqual({ lines: [], fontSize: OVERLAY_FONT.max });
    expect(fitOverlayNames([[]], [100]).lines).toEqual([[]]);
  });
});

describe("the lane", () => {
  const cf = (id: number, year: number, over: Partial<CardFilm> = {}): CardFilm => ({
    id,
    title: `Film ${id}`,
    year,
    releaseDate: `${year}-06-01`,
    posterPath: `/p${id}.jpg`,
    voteCount: 10,
    ...over,
  });
  const careers = [cf(1, 1990), cf(2, 1995), cf(3, 2000), cf(4, 2005), cf(5, 2010)];
  const card = [cf(2, 1995), cf(4, 2005)];

  describe("laneFilms", () => {
    it("is the films of the people's careers, one per film, with every film of the card among them", () => {
      expect(laneFilms("all-films", card, careers).map((f) => f.id).sort()).toEqual([1, 2, 3, 4, 5]);
      // A film of the card that the careers lack is kept: a green node never goes missing.
      expect(laneFilms("all-films", [cf(9, 2001)], careers).map((f) => f.id)).toContain(9);
    });

    it("is only the films of the card when told to, the way the lane used to be", () => {
      expect(laneFilms("card-films", card, careers).map((f) => f.id)).toEqual([2, 4]);
    });

    it("lists a film that two people made once", () => {
      expect(laneFilms("all-films", card, [...careers, ...careers]).filter((f) => f.id === 2)).toHaveLength(1);
    });
  });

  describe("laneScale", () => {
    const time = (year: number) => yearFraction(`${year}-01-01`);

    it("centres the active years: the middle of the first and last green node is the middle of the zone", () => {
      const lane = laneScale([time(2000), time(2008), time(2004)])!;
      expect(lane.mid).toBeCloseTo(time(2004), 8);
      expect(OG_ACTIVE_CENTER + (time(2000) - lane.mid) * lane.pxPerYear).toBeCloseTo(OG_ACTIVE_CENTER - 4 * lane.pxPerYear, 6);
      expect(OG_ACTIVE_CENTER + (time(2008) - lane.mid) * lane.pxPerYear).toBeCloseTo(OG_ACTIVE_CENTER + 4 * lane.pxPerYear, 6);
    });

    it("does not stretch a short stretch of years: a year is never wider than the cap", () => {
      expect(laneScale([time(2000), time(2003)])!.pxPerYear).toBe(OG_MAX_PX_PER_YEAR);
      expect(laneScale([time(2000), time(2000) + 0.2])!.pxPerYear).toBe(OG_MAX_PX_PER_YEAR);
    });

    it("squeezes a long stretch of years into the zone, less the room for the year labels", () => {
      const lane = laneScale([time(1950), time(2020)])!;
      const room = OG_ACTIVE_ZONE.right - OG_ACTIVE_ZONE.left - 2 * OG_ACTIVE_INSET;
      expect(lane.pxPerYear).toBeCloseTo(room / 70, 6);
      expect(lane.pxPerYear).toBeLessThan(OG_MAX_PX_PER_YEAR);
      // The first and last nodes then sit exactly at the inset from the zone's edges.
      expect(OG_ACTIVE_CENTER + (time(1950) - lane.mid) * lane.pxPerYear).toBeCloseTo(OG_ACTIVE_ZONE.left + OG_ACTIVE_INSET, 6);
      expect(OG_ACTIVE_CENTER + (time(2020) - lane.mid) * lane.pxPerYear).toBeCloseTo(OG_ACTIVE_ZONE.right - OG_ACTIVE_INSET, 6);
    });

    it("puts a single green node, or green nodes all at one moment, at the middle of the zone", () => {
      const lane = laneScale([time(1991) + 0.4])!;
      expect(dotPositions([{ releaseDate: "1991-06-01" }], laneScale([yearFraction("1991-06-01")]))).toEqual([805]);
      expect(lane.mid).toBeCloseTo(time(1991) + 0.4, 8);
      expect(laneScale([5, 5, 5])!.mid).toBe(5);
    });

    it("has none without green nodes", () => {
      expect(laneScale([])).toBeNull();
    });

    it("has the zone the user marked, centred on 805", () => {
      expect(OG_ACTIVE_ZONE).toEqual({ left: 520, right: 1090 });
      expect(OG_ACTIVE_CENTER).toBe(805);
    });
  });

  describe("laneFade", () => {
    it("is fully opaque across the active zone", () => {
      for (const x of [520, 600, 805, 1000, 1090]) expect(laneFade(x)).toBe(1);
    });

    it("fades in a straight line to nothing at both edges of the card", () => {
      expect(laneFade(0)).toBe(0);
      expect(laneFade(OG_WIDTH)).toBe(0);
      expect(laneFade(260)).toBeCloseTo(0.5, 8);
      expect(laneFade(1090 + 55)).toBeCloseTo(0.5, 8);
    });

    it("never goes above one, or below zero, and only falls as it goes away from the zone", () => {
      let previous = 1;
      for (let x = OG_ACTIVE_ZONE.left; x >= 0; x -= 20) {
        const fade = laneFade(x);
        expect(fade).toBeLessThanOrEqual(previous);
        expect(fade).toBeGreaterThanOrEqual(0);
        previous = fade;
      }
      previous = 1;
      for (let x = OG_ACTIVE_ZONE.right; x <= OG_WIDTH; x += 10) {
        const fade = laneFade(x);
        expect(fade).toBeLessThanOrEqual(previous);
        expect(fade).toBeGreaterThanOrEqual(0);
        previous = fade;
      }
      expect(laneFade(-50)).toBe(0);
      expect(laneFade(OG_WIDTH + 50)).toBe(0);
    });
  });

  describe("dotPositions", () => {
    const at = (...dates: string[]) => dates.map((releaseDate) => ({ releaseDate }));

    it("puts a film where its date falls: the lane's middle time at the middle of the zone, a year `pxPerYear` wide", () => {
      const lane = { mid: yearFraction("2005-01-01"), pxPerYear: 20 };
      const xs = dotPositions(at("2000-01-01", "2005-01-01", "2010-01-01"), lane);
      expect(xs[1]).toBeCloseTo(805, 6);
      expect(xs[0]).toBeCloseTo(705, 6);
      expect(xs[2]).toBeCloseTo(905, 6);
    });

    it("places a film by its date, not just its year", () => {
      const lane = { mid: 2000, pxPerYear: 100 };
      const xs = dotPositions(at("2000-01-01", "2000-07-02"), lane);
      expect(xs[1] - xs[0]).toBeGreaterThan(49);
      expect(xs[1] - xs[0]).toBeLessThan(51);
    });

    it("keeps the order of the films, never going backwards", () => {
      const lane = laneScale([yearFraction("1966-06-01"), yearFraction("1998-06-01")])!;
      const xs = dotPositions(at("1950-06-01", "1966-06-01", "1968-06-01", "1971-06-01", "1991-06-01", "1998-06-01", "2020-01-01"), lane);
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    });

    it("lets films run past the active zone, toward the edges of the card", () => {
      const lane = { mid: 2000, pxPerYear: 50 };
      const [left, right] = dotPositions(at("1990-01-01", "2010-01-01"), lane);
      expect(left).toBeLessThan(OG_ACTIVE_ZONE.left);
      expect(right).toBeGreaterThan(OG_ACTIVE_ZONE.right);
    });

    it("spreads films released on the same day apart, around the spot they share", () => {
      const lane = { mid: yearFraction("2005-06-01"), pxPerYear: 30 };
      const xs = dotPositions(at("2000-01-01", "2005-06-01", "2005-06-01", "2005-06-01", "2010-01-01"), lane);
      expect(xs[2]).toBeCloseTo(805, 6);
      expect(xs[2] - xs[1]).toBeCloseTo(DOT_SPREAD, 6);
      expect(xs[3] - xs[2]).toBeCloseTo(DOT_SPREAD, 6);
      expect(xs[1] + xs[3]).toBeCloseTo(2 * xs[2], 6);
      // The films on either side are not moved.
      expect(xs[0]).toBeCloseTo(805 + (yearFraction("2000-01-01") - lane.mid) * 30, 6);
    });

    it("leaves films of the same year but different days where their dates put them", () => {
      const lane = { mid: 2005, pxPerYear: 50 };
      const xs = dotPositions(at("2005-01-10", "2005-09-10"), lane);
      expect(xs[1] - xs[0]).toBeGreaterThan(DOT_SPREAD);
    });

    it("puts films in the middle of the zone without a scale", () => {
      expect(dotPositions(at("1994-01-01"), null)).toEqual([805]);
      const same = dotPositions(at("1994-01-01", "1994-01-01"), null);
      expect(same[0] + same[1]).toBeCloseTo(1610, 6);
    });

    it("has nothing without films", () => {
      expect(dotPositions([], { mid: 2000, pxPerYear: 10 })).toEqual([]);
    });
  });

  describe("placeDots", () => {
    const dot = (id: number, date: string, featured = false) => ({ id, releaseDate: date, featured });
    const lane = { mid: yearFraction("2000-01-01"), pxPerYear: 50 };

    it("gives every green node full opacity, and a grey dot the lane's opacity where it sits", () => {
      const placed = placeDots([dot(1, "1995-01-01"), dot(2, "2000-01-01", true), dot(3, "2008-01-01")], lane);
      const byId = new Map(placed.map((d) => [d.id, d]));
      expect(byId.get(2)).toMatchObject({ featured: true, opacity: 1 });
      expect(byId.get(2)!.x).toBeCloseTo(805, 6);
      // 1995 is at 805 - 250 = 555, inside the zone; 2008 at 805 + 400 = 1205, off the card.
      expect(byId.get(1)).toMatchObject({ x: expect.closeTo(555, 4), opacity: 1 });
      expect(byId.has(3)).toBe(false);
    });

    it("fades a grey dot by where it is, as the line does", () => {
      const placed = placeDots([dot(1, "1990-01-01"), dot(2, "2000-01-01", true)], lane);
      const grey = placed.find((d) => d.id === 1)!;
      expect(grey.x).toBeCloseTo(305, 4);
      expect(grey.opacity).toBeCloseTo(laneFade(305), 8);
      expect(grey.opacity).toBeGreaterThan(0.5);
      expect(grey.opacity).toBeLessThan(1);
    });

    it("drops a grey dot that is off the card, or too faint to see", () => {
      const placed = placeDots(
        [dot(1, "1900-01-01"), dot(2, "1989-01-01"), dot(3, "1986-06-01"), dot(4, "2000-01-01", true), dot(5, "2030-01-01")],
        lane,
      );
      // 1989 is at x = 255 (opacity about 0.49), 1986-06 at about 130 (0.25); 1900 is far off the left, 2030 far off the right.
      expect(placed.map((d) => d.id)).toEqual([2, 3, 4]);
      const faint = placeDots([dot(1, "1976-03-01"), dot(2, "2000-01-01", true)], lane);
      // 1976-03 is at about x = -388 (off the card).
      expect(faint.map((d) => d.id)).toEqual([2]);
      for (const d of placeDots(Array.from({ length: 60 }, (_, i) => dot(i + 1, `${1970 + i}-01-01`, i === 30)), lane)) {
        if (!d.featured) expect(d.opacity).toBeGreaterThanOrEqual(OG_MIN_DOT_OPACITY);
        expect(d.x).toBeGreaterThanOrEqual(0);
        expect(d.x).toBeLessThanOrEqual(OG_WIDTH);
      }
    });

    it("never drops a green node, wherever it is", () => {
      const placed = placeDots([dot(1, "1900-01-01", true), dot(2, "2000-01-01", true)], lane);
      expect(placed.map((d) => d.id)).toEqual([1, 2]);
    });

    it("thins the grey dots that are left to an even sample, keeping every green node", () => {
      const dots = [
        ...Array.from({ length: 300 }, (_, i) => dot(i + 1, `${1990 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-15`)),
        dot(1000, "2000-01-01", true),
        dot(1001, "2004-01-01", true),
      ];
      const placed = placeDots(dots, { mid: yearFraction("2002-01-01"), pxPerYear: 25 });
      expect(placed.filter((d) => d.featured).map((d) => d.id)).toEqual([1000, 1001]);
      expect(placed.filter((d) => !d.featured)).toHaveLength(OG_MAX_DIM_DOTS);
      const xs = placed.filter((d) => !d.featured).map((d) => d.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
    });

    it("thins only what could be seen: a dot too faint to see does not take a place", () => {
      const dots = [...Array.from({ length: 40 }, (_, i) => dot(i + 1, `${1900 + i}-06-01`)), dot(100, "2000-01-01", true)];
      expect(placeDots(dots, lane, 5).filter((d) => !d.featured)).toHaveLength(0);
    });

    it("has no scale for no green nodes: grey dots, if any, in the middle", () => {
      expect(placeDots([], null)).toEqual([]);
    });
  });

  describe("on a card", () => {
    // A and B made films 1, 2 and 3 together, A film 4 alone and B film 5 alone; B's film 6 is a short (minor) and film 7 of A is not out yet.
    const minor = { minor: true, credits: [{ role: "other" as const, job: "Thanks", minor: true }] };
    const a = timeline(1, "A One", [film(1, 1990), film(2, 1991), film(3, 1992), film(4, 1993), film(7, 2030, { releaseDate: "2030-01-01" })]);
    const b = timeline(2, "B Two", [film(1, 1990), film(2, 1991), film(3, 1992), film(5, 1989), film(6, 1991, minor)]);

    it("shows a green node for every poster's film and a grey dot for every other film of either person, once each", () => {
      const lane = buildOgCard([a, b], TODAY, null, "all-films");
      expect(lane.dots.map((d) => d.id)).toEqual([5, 1, 2, 3, 4]);
      // Three films together, all of them posters (the target is six): green. The others, one of each person's, are grey.
      expect(lane.dots.filter((d) => d.featured).map((d) => d.id)).toEqual([1, 2, 3]);
      expect(lane.dots.filter((d) => !d.featured).map((d) => d.id)).toEqual([5, 4]);
    });

    it("leaves out films that are not out yet and shorts, as the rest of the card does", () => {
      const ids = buildOgCard([a, b], TODAY, null, "all-films").dots.map((d) => d.id);
      expect(ids).not.toContain(7);
      expect(ids).not.toContain(6);
    });

    it("centres the active years: the first and last green nodes are the same distance from the middle of the zone", () => {
      const card = buildOgCard([a, b], TODAY, null, "all-films");
      const greens = card.dots.filter((d) => d.featured);
      expect((greens[0].x + greens[greens.length - 1].x) / 2).toBeCloseTo(OG_ACTIVE_CENTER, 6);
      expect(card.lane!.pxPerYear).toBe(OG_MAX_PX_PER_YEAR);
    });

    it("keeps every green node inside the active zone, with room for the year labels", () => {
      for (const years of [[1990, 1991], [1990, 2000], [1950, 2020], [1990, 1990]]) {
        const films = [film(1, years[0]), film(2, years[1]), film(3, (years[0] + years[1]) >> 1)];
        const card = buildOgCard([timeline(1, "A One", films), timeline(2, "B Two", films)], TODAY);
        for (const d of card.dots.filter((dot) => dot.featured)) {
          expect(d.x).toBeGreaterThanOrEqual(OG_ACTIVE_ZONE.left + OG_ACTIVE_INSET - DOT_SPREAD);
          expect(d.x).toBeLessThanOrEqual(OG_ACTIVE_ZONE.right - OG_ACTIVE_INSET + DOT_SPREAD);
        }
      }
    });

    it("puts the one green node of a single film, or of films in one year that are one on the lane, at 805", () => {
      const one = buildOgCard([timeline(1, "A One", [film(1, 1994)]), timeline(2, "B Two", [film(1, 1994)])], TODAY);
      expect(one.dots.find((d) => d.featured)!.x).toBe(805);
      const same = timeline(1, "A One", [film(1, 2000), film(2, 2000), film(3, 2000)]);
      const other = timeline(2, "B Two", [film(1, 2000), film(2, 2000), film(3, 2000)]);
      const greens = buildOgCard([same, other], TODAY).dots.filter((d) => d.featured);
      expect(greens).toHaveLength(3);
      expect((greens[0].x + greens[2].x) / 2).toBeCloseTo(805, 6);
    });

    it("shows grey dots for shared films that are not posters", () => {
      const many = Array.from({ length: 9 }, (_, i) => film(i + 1, 1990 + i, { voteCount: 100 - i }));
      const card = buildOgCard([timeline(1, "A One", many), timeline(2, "B Two", many)], TODAY, null, "all-films");
      expect(card.dots.filter((d) => d.featured)).toHaveLength(OG_POSTER_TARGET);
      expect(card.dots.filter((d) => !d.featured)).toHaveLength(9 - OG_POSTER_TARGET);
    });

    it("can be set back to the films of the card alone: no other grey dots", () => {
      const lane = buildOgCard([a, b], TODAY, null, "card-films");
      expect(lane.dots.map((d) => d.id)).toEqual([1, 2, 3]);
      expect(lane.dots.every((d) => d.featured)).toBe(true);
    });

    it("is set to all films by default", () => {
      expect(OG_LANE_SCOPE).toBe("all-films");
      expect(buildOgCard([a, b], TODAY)).toEqual(buildOgCard([a, b], TODAY, null, OG_LANE_SCOPE));
    });

    it("keeps to the period: only its films are on the lane, and the active years are the films together within it", () => {
      const lane = buildOgCard([a, b], TODAY, { from: 1991, to: 1993 }, "all-films");
      expect(lane.dots.map((d) => [d.id, d.featured])).toEqual([[2, true], [3, true], [4, false]]);
      expect(lane.years).toEqual({ first: 1991, last: 1992 });
    });

    it("has no lane when the period holds no films", () => {
      const lane = buildOgCard([a, b], TODAY, { from: 2005, to: 2011 }, "all-films");
      expect(lane.posters).toEqual([]);
      expect(lane.dots).toEqual([]);
      expect(lane.lane).toBeNull();
      expect(lane.years).toBeNull();
    });
  });
});

describe("layout", () => {
  describe("headshotFan", () => {
    it("makes the card of one or two people 225x300, 1.25 times what it was", () => {
      expect(HEADSHOT).toEqual({ width: 225, height: 300 });
      for (const n of [1, 2]) {
        const fan = headshotFan(n);
        expect(fan.width).toBe(225);
        expect(fan.height).toBe(300);
      }
    });

    it("makes the cards of three and four people 0.7 of that, however many they are", () => {
      expect(HEADSHOT_SCALE).toEqual({ 1: 1, 2: 1, 3: 0.7, 4: 0.7 });
      for (const n of [3, 4]) {
        const fan = headshotFan(n);
        expect(fan.width).toBe(Math.round(225 * 0.7));
        expect(fan.height).toBe(Math.round(300 * 0.7));
        expect(fan.width / headshotFan(1).width).toBeCloseTo(0.7, 2);
        expect(fan.height / headshotFan(1).height).toBeCloseTo(0.7, 2);
      }
      expect([headshotFan(3).width, headshotFan(3).height]).toEqual([158, 210]);
    });

    it("packs the cards tighter the more of them there are, as a share of their width", () => {
      const share = (n: number) => headshotFan(n).cards[1].left / headshotFan(n).width;
      expect(share(2)).toBeGreaterThan(share(3));
      expect(share(3)).toBeGreaterThan(share(4));
      expect(headshotFan(2).cards[1].left).toBe(188);
      for (const n of [2, 3, 4]) expect(share(n)).toBeLessThan(1);
    });

    it("has one card for one person, and clamps the count", () => {
      expect(headshotFan(1).cards).toEqual([{ left: 0, covered: 0, visible: 225 }]);
      expect(headshotFan(0)).toEqual(headshotFan(1));
      expect(headshotFan(9)).toEqual(headshotFan(4));
    });

    it("fits the row of cards in its zone, clear of the posters, for every number of people", () => {
      for (const n of [1, 2, 3, 4]) {
        const fan = headshotFan(n);
        expect(fan.totalWidth).toBe(fan.cards[n - 1].left + fan.width);
        expect(fan.totalWidth).toBeLessThanOrEqual(OG_FAN_WIDTH);
        const left = OG_FAN_ZONE.left + (OG_FAN_WIDTH - fan.totalWidth) / 2;
        expect(left + fan.totalWidth).toBeLessThanOrEqual(OG_FAN_ZONE.right + 1);
        expect(OG_FAN_ZONE.right).toBeLessThan(OG_ACTIVE_ZONE.left);
      }
    });

    it("packs four people as tight as the zone needs: the row is as wide as the zone", () => {
      const fan = headshotFan(4);
      expect(fan.cards[1].left).toBe(Math.floor((OG_FAN_WIDTH - fan.width) / 3));
      expect(fan.totalWidth).toBeGreaterThan(OG_FAN_WIDTH - 4);
    });

    it("leaves at least 70px of every card showing", () => {
      for (const n of [1, 2, 3, 4]) {
        for (const card of headshotFan(n).cards) expect(card.visible).toBeGreaterThanOrEqual(70);
      }
    });

    it("puts the first card on top: it shows all of it, and each of the others starts where the card before it ends", () => {
      for (const n of [2, 3, 4]) {
        const { cards, width } = headshotFan(n);
        expect(cards[0]).toMatchObject({ covered: 0, visible: width });
        for (let i = 1; i < n; i++) {
          expect(cards[i].covered).toBe(width - (cards[i].left - cards[i - 1].left));
          expect(cards[i].covered + cards[i].visible).toBe(width);
          expect(cards[i].left + cards[i].covered).toBe(cards[i - 1].left + width);
        }
      }
    });

    it("hangs each card below the lane by a sixth of its height", () => {
      expect(HEADSHOT_OVERHANG_RATIO).toBeCloseTo(1 / 6, 10);
      expect(headshotOverhang(300)).toBe(50);
      expect(headshotOverhang(210)).toBe(35);
      expect(headshotFan(1).overhang).toBe(50);
      expect(headshotFan(2).overhang).toBe(50);
      expect(headshotFan(3).overhang).toBe(35);
      expect(headshotFan(4).overhang).toBe(35);
    });

    it("does not tilt or lower any card", () => {
      for (const n of [1, 2, 3, 4]) {
        for (const card of headshotFan(n).cards) {
          expect(card).not.toHaveProperty("rotate");
          expect(card).not.toHaveProperty("top");
        }
      }
    });
  });

  describe("posterRow", () => {
    it("lays out 2:3 posters that overlap, oldest first, inside the active zone", () => {
      expect(OG_POSTER.height).toBe(Math.round(OG_POSTER.width * 1.5));
      for (let k = 1; k <= OG_POSTER_MAX; k++) {
        const lefts = posterRow(k);
        expect(lefts).toHaveLength(k);
        expect(lefts[0]).toBeGreaterThanOrEqual(OG_ACTIVE_ZONE.left);
        expect(lefts[k - 1] + OG_POSTER.width).toBeLessThanOrEqual(OG_ACTIVE_ZONE.right + 1);
        for (let i = 1; i < k; i++) {
          const step = lefts[i] - lefts[i - 1];
          expect(step).toBeGreaterThan(0);
          expect(step).toBeLessThan(OG_POSTER.width);
        }
      }
    });

    it("centres the row on the active zone, the same x the lane's green nodes are centred on", () => {
      for (let k = 1; k <= OG_POSTER_MAX; k++) {
        const lefts = posterRow(k);
        expect((lefts[0] + lefts[k - 1] + OG_POSTER.width) / 2).toBeCloseTo(OG_ACTIVE_CENTER, -0.5);
      }
    });

    it("fills the zone with a full row, and keeps a short one together in the middle of it", () => {
      const full = posterRow(OG_POSTER_TARGET);
      expect(full[0]).toBe(OG_ACTIVE_ZONE.left);
      expect(full[full.length - 1] + OG_POSTER.width).toBeGreaterThanOrEqual(OG_ACTIVE_ZONE.right - 1);
      const two = posterRow(2);
      expect(two[1] - two[0]).toBeLessThan(OG_POSTER.width);
    });

    it("has nothing for no posters and never more than the maximum", () => {
      expect(posterRow(0)).toEqual([]);
      expect(posterRow(99)).toHaveLength(OG_POSTER_MAX);
    });
  });

  describe("yearLabelXs", () => {
    it("puts the labels under the first and last green node", () => {
      expect(yearLabelXs(600, 1000, { first: 2005, last: 2012 })).toEqual([600, 1000]);
    });

    it("keeps a label inside the active zone, so clear of the headshots", () => {
      const [a, b] = yearLabelXs(100, 1150, { first: 1950, last: 2020 });
      expect(a - YEAR_LABEL_HALF).toBeGreaterThanOrEqual(OG_ACTIVE_ZONE.left);
      expect(b + YEAR_LABEL_HALF).toBeLessThanOrEqual(OG_ACTIVE_ZONE.right);
      const [c] = yearLabelXs(10, 10, { first: 1999, last: 1999 });
      expect(c - YEAR_LABEL_HALF).toBeGreaterThanOrEqual(OG_ACTIVE_ZONE.left);
      // And so clear of the right edge of the biggest row of headshot cards.
      expect(a - YEAR_LABEL_HALF).toBeGreaterThan(OG_FAN_ZONE.right);
    });

    it("moves two labels apart when their nodes are too close for both", () => {
      const [a, b] = yearLabelXs(800, 810, { first: 2000, last: 2001 });
      expect(b - a).toBeGreaterThanOrEqual(2 * YEAR_LABEL_HALF);
      expect((a + b) / 2).toBeCloseTo(805, 6);
    });

    it("slides a pair that is pushed against an edge of the zone inwards, keeping them apart", () => {
      const [a, b] = yearLabelXs(550, 560, { first: 2000, last: 2001 });
      expect(a - YEAR_LABEL_HALF).toBeGreaterThanOrEqual(OG_ACTIVE_ZONE.left);
      expect(b - a).toBeGreaterThanOrEqual(2 * YEAR_LABEL_HALF);
      const [c, d] = yearLabelXs(1050, 1060, { first: 2000, last: 2001 });
      expect(d + YEAR_LABEL_HALF).toBeLessThanOrEqual(OG_ACTIVE_ZONE.right);
      expect(d - c).toBeGreaterThanOrEqual(2 * YEAR_LABEL_HALF);
    });

    it("has one label, under the middle of the nodes, when both years are the same", () => {
      expect(yearLabelXs(800, 900, { first: 1999, last: 1999 })).toEqual([850]);
    });
  });

  describe("composition", () => {
    const heights = [HEADSHOT.height, Math.round(HEADSHOT.height * 0.7)];

    it("centres the whole composition on the card, unless that would put it under the wordmark: then it sits as high as it may", () => {
      for (const h of heights) {
        const place = composition(h);
        expect(place.top).toBeGreaterThanOrEqual(COMPOSITION_TOP);
        if (place.top > COMPOSITION_TOP) expect(Math.abs(place.top + place.bottom - OG_HEIGHT)).toBeLessThanOrEqual(1);
        else expect(place.top).toBe(COMPOSITION_TOP);
      }
      // With room (no wordmark above it) the stack is centred exactly.
      const roomy = composition(300, true, true, 0);
      expect(roomy.top).toBeGreaterThan(0);
      expect(Math.abs(roomy.top + roomy.bottom - OG_HEIGHT)).toBeLessThanOrEqual(1);
    });

    it("hangs the headshot cards below the lane's line: their bottom is the lane plus the overhang", () => {
      for (const h of heights) {
        const place = composition(h);
        expect(place.headshotBottom).toBe(place.laneY! + headshotOverhang(h));
        expect(place.headshotBottom - place.headshotTop).toBe(h);
        expect(place.headshotBottom).toBeGreaterThan(place.laneY!);
        // The line crosses a card about 5/6 of the way down.
        expect((place.laneY! - place.headshotTop) / h).toBeCloseTo(5 / 6, 1);
      }
    });

    it("keeps the posters at their size and above the lane", () => {
      const place = composition(HEADSHOT.height);
      expect(place.postersBottom - place.postersTop).toBe(OG_POSTER.height);
      expect(place.postersBottom).toBe(place.laneY! - POSTER_GAP);
    });

    it("stacks it: the cards above the lane, the years and the caption under it", () => {
      for (const h of heights) {
        const place = composition(h);
        expect(place.laneY).toBeGreaterThan(Math.min(place.headshotTop, place.postersTop));
        expect(place.yearsTop).toBeGreaterThan(place.laneY!);
        expect(place.captionTop).toBeGreaterThan(place.yearsTop! + 20 - 1);
        expect(place.bottom).toBe(place.captionTop + 36);
      }
    });

    it("starts the caption below the cards' hanging bottom edge, whatever their size, so they never overlap", () => {
      for (const h of heights) {
        const place = composition(h);
        expect(place.captionTop).toBeGreaterThanOrEqual(place.headshotBottom + 16);
      }
      // Even for cards that hang a long way.
      const tall = composition(480);
      expect(tall.captionTop).toBeGreaterThanOrEqual(tall.headshotBottom + 16);
    });

    it("keeps everything clear of the wordmark and inside the card, moving it down, never the wordmark", () => {
      for (const h of heights) {
        const place = composition(h);
        expect(Math.min(place.headshotTop, place.postersTop)).toBeGreaterThanOrEqual(COMPOSITION_TOP);
        expect(place.bottom).toBeLessThanOrEqual(COMPOSITION_BOTTOM);
      }
      expect(composition(420).top).toBe(COMPOSITION_TOP);
    });

    it("has no lane or years for a card without films, and centres the people and the caption", () => {
      const place = composition(HEADSHOT.height, false);
      expect(place.laneY).toBeNull();
      expect(place.yearsTop).toBeNull();
      expect(Math.abs((place.top + place.bottom) / 2 - OG_HEIGHT / 2)).toBeLessThanOrEqual(1);
      expect(place.captionTop).toBeGreaterThan(place.headshotBottom);
    });

    it("sizes a green node so that it never reaches a card's bottom edge from the lane", () => {
      expect(NODE_SIZE / 2).toBeLessThan(headshotOverhang(Math.round(HEADSHOT.height * 0.7)));
    });
  });
});

describe("the years-active chip", () => {
  const shared = (years: number[]) => years.map((year, i) => film(i + 1, year));
  const pair = (years: number[]) => [timeline(1, "A One", shared(years)), timeline(2, "B Two", shared(years))];

  it("is the years of the first and last green node on a card with no period, in a period's wording", () => {
    expect(buildOgCard(pair([2005, 2006, 2008, 2012]), TODAY).chip).toBe("2005–2012");
    expect(buildOgCard(pair([1966, 1998, 1981]), TODAY).chip).toBe("1966–1998");
    expect(buildOgCard(pair([2005, 2012]), TODAY).chip).toBe(periodLabel({ from: 2005, to: 2012 }));
  });

  it("is a single year when the first and last film are in the same year", () => {
    expect(buildOgCard(pair([1991]), TODAY).chip).toBe("1991");
    expect(buildOgCard(pair([1994, 1994, 1994]), TODAY).chip).toBe("1994");
    expect(activeYearsLabel({ first: 1991, last: 1991 })).toBe("1991");
    expect(activeYearsLabel({ first: 2005, last: 2012 })).toBe("2005–2012");
    expect(activeYearsLabel(null)).toBeNull();
  });

  it("is the period's label on a period card, which is what the chip beside the wordmark used to say", () => {
    const films = shared([1966, 1968, 1971, 1981, 1991, 1998]);
    const people = [timeline(1, "A One", films), timeline(2, "B Two", films)];
    const card = buildOgCard(people, TODAY, { from: 1966, to: 1981 });
    expect(card.chip).toBe("1966–1981");
    expect(card.chip).toBe(card.period);
    // A period wider than the films inside it still says the period, as before; one year says one year.
    expect(buildOgCard(people, TODAY, { from: 1960, to: 1975 }).chip).toBe("1960–1975");
    expect(buildOgCard(people, TODAY, { from: 1971, to: 1971 }).chip).toBe("1971");
  });

  it("is on every card with a film, whichever way the film set came about", () => {
    const solo = buildOgCard([timeline(1, "Solo Artist", shared([1990, 2000, 2010]))], TODAY);
    expect(solo.chip).toBe("1990–2010");
    const side = buildOgCard([timeline(1, "A One", [film(1, 1999)]), timeline(2, "B Two", [film(2, 2005)])], TODAY);
    expect(captionText(side.caption!)).toBe("Careers side by side");
    expect(side.chip).toBe("1999–2005");
    const four = buildOgCard(["A One", "B Two", "C Three", "D Four"].map((n, i) => timeline(i + 1, n, shared([1999]))), TODAY);
    expect(four.chip).toBe("1999");
  });

  it("is not there when there are no films: not for a person without any, nor for a period that holds none", () => {
    expect(buildOgCard([timeline(1, "Newcomer", [])], TODAY).chip).toBeNull();
    expect(buildOgCard(pair([1990, 1995]), TODAY, { from: 2000, to: 2005 }).chip).toBeNull();
  });

  it("says the same as the caption's years do, so the card agrees with itself", () => {
    const card = buildOgCard(pair([2005, 2008, 2012]), TODAY);
    expect(card.years).toEqual({ first: 2005, last: 2012 });
    expect(card.chip).toBe(`${card.years!.first}–${card.years!.last}`);
  });

  describe("where it goes", () => {
    const heights = [HEADSHOT.height, Math.round(HEADSHOT.height * 0.7)];

    it("is centred on the card, the same x as the caption: the middle, 600", () => {
      expect(OG_CENTER_X).toBe(600);
      expect(OG_CENTER_X).toBe(OG_WIDTH / 2);
    });

    it("comes in order under the lane: the lane, the year labels, the chip, the caption, with a gap between each", () => {
      for (const h of heights) {
        const place = composition(h);
        const yearsBottom = place.yearsTop! + 20;
        const chipBottom = place.chipTop! + CHIP.height;
        expect(place.laneY!).toBeLessThan(place.yearsTop!);
        expect(yearsBottom).toBeLessThan(place.chipTop!);
        expect(chipBottom).toBeLessThan(place.captionTop);
        expect(place.captionTop + 36).toBe(place.bottom);
      }
    });

    it("clears the cards' hanging bottom edge by 16px or more, being the first thing under them", () => {
      for (const h of heights) {
        const place = composition(h);
        expect(place.chipTop!).toBeGreaterThanOrEqual(place.headshotBottom + 16);
        expect(place.captionTop).toBeGreaterThan(place.chipTop! + CHIP.height);
      }
      const tall = composition(420);
      expect(tall.chipTop!).toBeGreaterThanOrEqual(tall.headshotBottom + 16);
    });

    it("keeps the whole stack, with the chip in it, as near the middle of the card as the wordmark allows", () => {
      for (const h of heights) {
        const place = composition(h);
        expect(place.top).toBeGreaterThanOrEqual(COMPOSITION_TOP);
        // Where the minimum top binds the stack sits low; it is never higher than the middle.
        expect(place.top + place.bottom).toBeGreaterThanOrEqual(OG_HEIGHT - 1);
      }
    });

    it("leaves room under the caption: at least 40px, and the wordmark's room above", () => {
      for (const h of heights) {
        const place = composition(h);
        expect(OG_HEIGHT - place.bottom).toBeGreaterThanOrEqual(MIN_BOTTOM_CLEARANCE);
        expect(Math.min(place.headshotTop, place.postersTop)).toBeGreaterThanOrEqual(COMPOSITION_TOP);
      }
      expect(MIN_BOTTOM_CLEARANCE).toBeGreaterThanOrEqual(40);
    });

    it("has no chip position on a card without a lane", () => {
      expect(composition(HEADSHOT.height, false).chipTop).toBeNull();
    });
  });
});

describe("the block under the timeline: the chip and the caption, centred in the space under the timeline", () => {
  const films = (list: number[]) => list.map((year, i) => film(i + 1, year));
  const who = (n: number) => ["A One", "B Two", "C Three", "D Four"].slice(0, n);
  const crowd = (n: number, list: number[]) => who(n).map((name, i) => timeline(i + 1, name, films(list)));

  const base = [1966, 1968, 1971, 1981, 1991, 1998];
  const cases: [string, PersonTimeline[], { from: number; to: number } | null][] = [
    ...[1, 2, 3, 4].map((n): [string, PersonTimeline[], { from: number; to: number } | null] => [`${n} ${n === 1 ? "person" : "people"}`, crowd(n, base), null]),
    ...[1, 2, 3, 4].map((n): [string, PersonTimeline[], { from: number; to: number } | null] => [`${n} ${n === 1 ? "person" : "people"}, a period`, crowd(n, base), { from: 1966, to: 1981 }]),
    ["one film", crowd(2, [1991]), null],
    ["one film, in a period", crowd(2, base), { from: 1991, to: 1991 }],
    ["two films, in a period", crowd(2, base), { from: 1991, to: 1998 }],
    ["films all in one year", crowd(3, [2000, 2000, 2000]), null],
    ["no shared films", [timeline(1, "A One", [film(1, 1999)]), timeline(2, "B Two", [film(2, 2005)])], null],
    ["a long career", crowd(2, Array.from({ length: 40 }, (_, i) => 1970 + i)), null],
  ];

  /** The card's geometry, as the renderer works it out. */
  const placed = (people: PersonTimeline[], period: { from: number; to: number } | null) => {
    const card = buildOgCard(people, TODAY, period);
    const fan = headshotFan(card.people.length);
    return { card, fan, place: composition(fan.height, card.posters.length > 0, card.chip !== null) };
  };

  for (const [name, people, period] of cases) {
    describe(name, () => {
      const { card, fan, place } = placed(people, period);

      it("has the same whitespace above the chip and caption as below them, within a pixel", () => {
        expect(card.chip).not.toBeNull();
        const above = place.chipTop! - place.yearsBottom!;
        const below = OG_HEIGHT - place.bottom;
        expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
        expect(above).toBeGreaterThan(0);
      });

      it("starts the stack no higher than the minimum, and centres it where that leaves room", () => {
        expect(place.top).toBeGreaterThanOrEqual(COMPOSITION_TOP);
        if (place.top > COMPOSITION_TOP) expect(Math.abs(place.top + place.bottom - OG_HEIGHT)).toBeLessThanOrEqual(1);
        else expect(place.top + place.bottom).toBeGreaterThanOrEqual(OG_HEIGHT - 1);
      });

      it("clears the cards' hanging bottom edge by 16px or more, and the pill never touches the year labels", () => {
        expect(place.chipTop!).toBeGreaterThanOrEqual(place.headshotBottom + 16);
        expect(place.chipTop!).toBeGreaterThanOrEqual(place.yearsBottom! + CHIP.gap);
        expect(place.headshotBottom).toBe(place.laneY! + fan.overhang);
        expect(place.captionTop).toBeGreaterThanOrEqual(place.chipTop! + CHIP.height);
      });

      it("does not clip at the bottom: at least 40px under the caption", () => {
        expect(OG_HEIGHT - place.bottom).toBeGreaterThanOrEqual(MIN_BOTTOM_CLEARANCE);
        expect(place.bottom).toBe(place.captionTop + 36);
      });
    });
  }

  it("is about the same under both sizes of card", () => {
    for (const h of [HEADSHOT.height, Math.round(HEADSHOT.height * 0.7)]) {
      const place = composition(h);
      expect(Math.abs(place.chipTop! - place.yearsBottom! - (OG_HEIGHT - place.bottom))).toBeLessThanOrEqual(1);
    }
  });

  it("puts the lane where the two rules put it: for 300px cards, at the lowest the wordmark allows", () => {
    const place = composition(300);
    // 250px above the lane (cards less their overhang), starting at 110: the lane is at 360, the block 106px under it.
    expect(place.top).toBe(110);
    expect(place.laneY).toBe(360);
    expect(place.yearsBottom).toBe(396);
    expect(place.chipTop).toBe(466);
    expect(place.bottom).toBe(560);
    expect(OG_HEIGHT - place.bottom).toBe(70);
    expect(place.chipTop! - place.yearsBottom!).toBe(70);
  });

  it("puts the lane for 210px cards at the lowest the wordmark allows too", () => {
    const place = composition(210);
    expect(place.top).toBe(110);
    expect(place.laneY).toBe(330);
    expect(place.chipTop).toBe(451);
    expect(place.bottom).toBe(545);
    expect(OG_HEIGHT - place.bottom).toBe(85);
    expect(place.chipTop! - place.yearsBottom!).toBe(85);
  });

  it("centres the whole stack exactly, and the block with it, when there is room: no minimum top in the way", () => {
    for (const h of [HEADSHOT.height, Math.round(HEADSHOT.height * 0.7), 150]) {
      const place = composition(h, true, true, 0);
      expect(place.top).toBeGreaterThan(0);
      expect(place.top).toBeLessThan(COMPOSITION_TOP);
      expect(Math.abs(place.top + place.bottom - OG_HEIGHT)).toBeLessThanOrEqual(1);
      expect(Math.abs(place.chipTop! - place.yearsBottom! - (OG_HEIGHT - place.bottom))).toBeLessThanOrEqual(1);
    }
  });

  it("applies the same rule to the caption alone on a card without a chip", () => {
    for (const h of [HEADSHOT.height, Math.round(HEADSHOT.height * 0.7), 150]) {
      const place = composition(h, true, false);
      expect(place.chipTop).toBeNull();
      expect(Math.abs(place.captionTop - place.yearsBottom! - (OG_HEIGHT - place.bottom))).toBeLessThanOrEqual(1);
      expect(place.captionTop).toBeGreaterThanOrEqual(place.headshotBottom + 16);
      expect(place.captionTop).toBeGreaterThanOrEqual(place.yearsBottom! + CHIP.gap);
      expect(place.bottom).toBe(place.captionTop + 36);
      expect(place.top).toBeGreaterThanOrEqual(COMPOSITION_TOP);
    }
  });

  it("holds the floors even when the cards are so tall that equal whitespace is out of reach", () => {
    const tall = composition(420);
    expect(tall.top).toBe(COMPOSITION_TOP);
    expect(tall.chipTop!).toBeGreaterThanOrEqual(tall.headshotBottom + 16);
    expect(tall.chipTop!).toBeGreaterThanOrEqual(tall.yearsBottom! + CHIP.gap);
  });

  it("leaves a card without a lane as it was", () => {
    const bare = composition(HEADSHOT.height, false);
    expect(bare.laneY).toBeNull();
    expect(bare.yearsBottom).toBeNull();
    expect(bare.chipTop).toBeNull();
    expect(Math.abs((bare.top + bare.bottom) / 2 - OG_HEIGHT / 2)).toBeLessThanOrEqual(1);
  });
});
