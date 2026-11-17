import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildOgCard } from "@/lib/og-card";
import { TreatedPairCardView } from "@/lib/og-treated-render";
import {
  TREATED_CAPTION_SIZE,
  TREATED_COLUMN,
  TREATED_GUTTER,
  TREATED_LEFT,
  TREATED_MARGIN,
  TREATED_POSTER,
  TREATED_NAMES_SIZE,
  TREATED_RIGHT,
  TREATED_SOLO_COLOR,
  TREATED_WIDTH,
  buildTreatedPair,
  treatedAxisFade,
  treatedAxisGradient,
  treatedPairLayout,
  treatedPosterLefts,
  treatedQuotePortraits,
  treatedTile,
  treatedTileTops,
} from "@/lib/og-treated";
import type { Film, PersonTimeline } from "@/lib/types";

const TODAY = "2026-11-16";

const film = (id: number, year: number, over: Partial<Film> = {}): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${year}-06-01`,
  year,
  posterPath: `/poster-${id}.jpg`,
  voteCount: 100 - id,
  credits: [{ role: "director", job: "Director", minor: false }],
  minor: false,
  ...over,
});

const timeline = (id: number, name: string, films: Film[]): PersonTimeline => ({
  person: { id, name, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

/** Two people who made `shared` years' films together, and a few of their own each. */
function pairOf(shared: number[], soloA: number[] = [], soloB: number[] = []) {
  const together = shared.map((year, i) => film(i + 1, year));
  const a = timeline(1, "Jack Lemmon", [...together, ...soloA.map((year, i) => film(100 + i, year))]);
  const b = timeline(2, "Walter Matthau", [...together, ...soloB.map((year, i) => film(200 + i, year))]);
  return [a, b];
}

function treatedOf(timelines: PersonTimeline[], period: { from: number; to: number } | null = null) {
  const card = buildOgCard(timelines, TODAY, period);
  return { card, treated: buildTreatedPair(card, timelines, TODAY, period) };
}

describe("the treated cards' grid", () => {
  it("is one column of portraits down the left edge and a column for the rest, with the margin on the other three sides", () => {
    expect(TREATED_LEFT).toBe(TREATED_COLUMN + TREATED_GUTTER);
    expect(TREATED_RIGHT).toBe(1200 - TREATED_MARGIN);
    expect(TREATED_WIDTH).toBe(TREATED_RIGHT - TREATED_LEFT);
  });

  it("stacks the portraits over the card's whole height, the first on top, the gap between them", () => {
    const tile = treatedTile(2);
    const [first, second] = treatedTileTops(2);
    expect(tile.width).toBe(TREATED_COLUMN);
    expect(first).toBe(0);
    expect(second + tile.height).toBe(630);
    expect(second).toBeGreaterThan(tile.height);
    expect(treatedTile(1).height).toBe(630);
  });

  it("keeps a quote card's portraits in the order of the URL whoever speaks, and only the colour follows the speaker", () => {
    const pair = [
      { id: 491, slot: 0, name: "John Williams" },
      { id: 488, slot: 1, name: "Steven Spielberg" },
    ];
    // Williams on Spielberg, then Spielberg on Williams: the same person on top both times, the grey the other way round.
    const williamsSpeaks = treatedQuotePortraits(pair, 0);
    const spielbergSpeaks = treatedQuotePortraits(pair, 1);
    expect(williamsSpeaks.map((p) => p.id)).toEqual([491, 488]);
    expect(spielbergSpeaks.map((p) => p.id)).toEqual([491, 488]);
    expect(williamsSpeaks.map((p) => p.grey)).toEqual([false, true]);
    expect(spielbergSpeaks.map((p) => p.grey)).toEqual([true, false]);
    // The other way round in the URL, the other way round on the card.
    const reversed = treatedQuotePortraits([{ ...pair[1], slot: 0 }, { ...pair[0], slot: 1 }], 1);
    expect(reversed.map((p) => p.id)).toEqual([488, 491]);
    expect(reversed.map((p) => p.grey)).toEqual([true, false]);
  });

  it("puts a group's portraits in the order of the URL too, the speaker's alone in colour; a critic's quote has all of them in colour", () => {
    const group = [0, 1, 2, 3].map((slot) => ({ id: 100 + slot, slot }));
    const shuffled = [group[2], group[0], group[3], group[1]];
    expect(treatedQuotePortraits(shuffled, 2).map((p) => [p.id, p.grey])).toEqual([[100, true], [101, true], [102, false], [103, true]]);
    expect(treatedQuotePortraits(group, null).every((p) => !p.grey)).toBe(true);
    expect(treatedQuotePortraits(group, null).map((p) => p.id)).toEqual([100, 101, 102, 103]);
  });

  it("puts the posters on the column's left edge, a fixed step apart, and the last one on its right edge when the row is full", () => {
    const lefts = treatedPosterLefts(TREATED_POSTER.count);
    expect(lefts).toHaveLength(TREATED_POSTER.count);
    expect(lefts[0]).toBe(TREATED_LEFT);
    expect(lefts[lefts.length - 1] + TREATED_POSTER.width).toBeCloseTo(TREATED_RIGHT, -1);
    expect(treatedPosterLefts(2)).toEqual(lefts.slice(0, 2));
    expect(treatedPosterLefts(20)).toHaveLength(TREATED_POSTER.count);
    expect(treatedPosterLefts(0)).toEqual([]);
  });

  it("stacks the pair's parts: posters, then the axis, then the names, then the count, all inside the margins", () => {
    const place = treatedPairLayout();
    expect(place.postersTop).toBeGreaterThanOrEqual(TREATED_MARGIN);
    expect(place.axisY).toBeGreaterThan(place.postersBottom);
    expect(place.namesTop).toBeGreaterThan(place.axisY + 10);
    // The count is under the names (the names are small, the count twice their size), with a gap, not a band, between them.
    expect(TREATED_CAPTION_SIZE).toBe(2 * TREATED_NAMES_SIZE);
    expect(place.captionTop).toBeGreaterThan(place.namesTop + TREATED_NAMES_SIZE);
    expect(place.captionTop - (place.namesTop + TREATED_NAMES_SIZE)).toBeLessThan(TREATED_NAMES_SIZE);
    expect(place.captionTop + TREATED_CAPTION_SIZE).toBeLessThan(630 - TREATED_MARGIN);
  });

  it("centres the posters, the axis and the text as one block in the card's height, the count's baseline the block's bottom, and keeps the wordmark's baseline on the bottom margin", () => {
    const place = treatedPairLayout();
    const countBaseline = place.captionTop + TREATED_CAPTION_SIZE * (1 - 0.137);
    expect(place.postersTop).toBeCloseTo(630 - countBaseline, 0);
    // The text hangs under the axis by a gap like the posters' above it, and nothing is left between the axis and the names but that gap.
    expect(place.namesTop - place.axisY).toBeLessThan(60);
    expect(place.axisY - place.postersBottom).toBeLessThan(60);
    expect(place.wordmarkTop + 30 * (1 - 0.137)).toBeCloseTo(630 - TREATED_MARGIN, 0);
  });

  it("fades the axis to nothing at both ends and not at all through the middle", () => {
    expect(treatedAxisFade(TREATED_LEFT)).toBe(0);
    expect(treatedAxisFade(TREATED_RIGHT)).toBe(0);
    expect(treatedAxisFade((TREATED_LEFT + TREATED_RIGHT) / 2)).toBe(1);
    expect(treatedAxisFade(TREATED_LEFT + 20)).toBeGreaterThan(0);
    expect(treatedAxisFade(TREATED_LEFT + 20)).toBeLessThan(1);
    expect(treatedAxisGradient("1, 2, 3", 0.7)).toMatch(/^linear-gradient\(to right, rgba\(1, 2, 3, 0\) 0%, .* rgba\(1, 2, 3, 0\) 100%\)$/);
  });
});

describe("buildTreatedPair", () => {
  it("is for two to four people, and not for one, whose page keeps the plain card", () => {
    const [a, b] = pairOf([2000, 2005]);
    const c = timeline(3, "Jack Klugman", [film(1, 2000), film(2, 2005)]);
    const d = timeline(4, "Felix Unger", [film(1, 2000), film(2, 2005)]);
    expect(buildTreatedPair(buildOgCard([a], TODAY), [a], TODAY)).toBeNull();
    expect(buildTreatedPair(buildOgCard([a, b], TODAY), [a, b], TODAY)).not.toBeNull();
    expect(buildTreatedPair(buildOgCard([a, b, c], TODAY), [a, b, c], TODAY)).not.toBeNull();
    expect(buildTreatedPair(buildOgCard([a, b, c, d], TODAY), [a, b, c, d], TODAY)!.posters).toHaveLength(2);
  });

  it("is the same card for a group: the films all of them made are the shared ones, the names are joined, each one's own films are dots", () => {
    const together = [film(1, 1990), film(2, 1995), film(3, 2000)];
    const group = [
      timeline(1, "Jack Lemmon", [...together, film(100, 1992)]),
      timeline(2, "Walter Matthau", [...together, film(200, 1997)]),
      timeline(3, "Jack Klugman", [...together, film(300, 1994)]),
    ];
    const { treated } = treatedOf(group);
    expect(treated!.names).toBe("Jack Lemmon, Walter Matthau & Jack Klugman");
    expect(treated!.dots.filter((dot) => dot.kind === "shared")).toHaveLength(3);
    expect(treated!.dots.filter((dot) => dot.kind === 2).map((dot) => dot.id)).toEqual([300]);
    expect(treated!.caption!.segments.map((s) => s.text).join("")).toBe("3 films over 10 years");
  });

  it("picks the posters as the plain card does (the first film, the last, the best known between), up to the row's count, oldest first", () => {
    const { card, treated } = treatedOf(pairOf([1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005]));
    expect(treated!.posters).toHaveLength(TREATED_POSTER.count);
    const years = treated!.posters.map((poster) => poster.year);
    expect(years).toEqual([...years].sort((x, y) => x - y));
    expect(years[0]).toBe(1970);
    expect(years[years.length - 1]).toBe(2005);
    // The plain card's pick at the same count.
    expect(card.posters.slice(0, 1)[0].id).toBe(treated!.posters[0].id);
  });

  it("draws a white dot for each shared film and a dot in each person's slot for their own, shared ones on top", () => {
    const { treated } = treatedOf(pairOf([1990, 1995, 2000], [1989, 1992], [1996, 1999, 2001]));
    const dots = treated!.dots;
    expect(dots.filter((dot) => dot.kind === "shared")).toHaveLength(3);
    expect(dots.filter((dot) => dot.kind === 0).map((dot) => dot.id).sort()).toEqual([100, 101]);
    expect(dots.filter((dot) => dot.kind === 1).map((dot) => dot.id).sort()).toEqual([200, 201, 202]);
    const firstShared = dots.findIndex((dot) => dot.kind === "shared");
    expect(dots.slice(firstShared).every((dot) => dot.kind === "shared")).toBe(true);
  });

  it("places the shared films in time order, centred on the axis, never wider than a year's maximum", () => {
    const { treated } = treatedOf(pairOf([2000, 2002, 2010]));
    const xs = treated!.dots.filter((dot) => dot.kind === "shared").map((dot) => dot.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect((xs[0] + xs[2]) / 2).toBeCloseTo((TREATED_LEFT + TREATED_RIGHT) / 2, 0);
    expect(xs[2] - xs[0]).toBeLessThanOrEqual(10 * 56 + 1);
    for (const x of xs) expect(treatedAxisFade(x)).toBe(1);
  });

  it("drops a solo film that is off the axis or too faint, and keeps the rest with the axis's own fade", () => {
    const { treated } = treatedOf(pairOf([2000, 2002], [1900, 2001, 2100]));
    const solo = treated!.dots.filter((dot) => dot.kind === 0);
    expect(solo.map((dot) => dot.id)).toEqual([101]);
    for (const dot of treated!.dots) expect(dot.opacity).toBe(treatedAxisFade(dot.x));
  });

  it("says what the plain card's caption says: the count and the span, the same words for one year, plain words for none", () => {
    expect(treatedOf(pairOf([1990, 2010])).treated!.caption!.segments.map((s) => s.text).join("")).toBe("2 films over 20 years");
    expect(treatedOf(pairOf([1990, 2011])).treated!.caption!.segments.filter((s) => s.accent).map((s) => s.text)).toEqual(["2", "21"]);
    expect(treatedOf(pairOf([1994, 1994, 1994])).treated!.caption!.segments.map((s) => s.text).join("")).toBe("3 films in 1994");
    expect(treatedOf(pairOf([1994])).treated!.caption!.segments.map((s) => s.text).join("")).toBe("1 film in 1994");
    expect(treatedOf(pairOf([1990, 1991])).treated!.caption!.segments.map((s) => s.text).join("")).toBe("2 films over 1 year");
  });

  it("counts only the films of a shared period, and puts the others' dots outside it off the axis", () => {
    const period = { from: 1990, to: 1995 };
    const { treated } = treatedOf(pairOf([1980, 1990, 1993, 1995, 2005]), period);
    expect(treated!.caption!.segments.map((s) => s.text).join("")).toBe("3 films over 5 years");
    expect(treated!.dots.filter((dot) => dot.kind === "shared")).toHaveLength(3);
  });

  it("writes the two names under the axis, and cuts them with an ellipsis if they would run past the column", () => {
    expect(treatedOf(pairOf([2000])).treated!.names).toBe("Jack Lemmon & Walter Matthau");
    const [a, b] = pairOf([2000]);
    const long = [
      { ...a, person: { ...a.person, name: "Florian Henckel von Donnersmarck Florian Henckel von Donnersmarck" } },
      { ...b, person: { ...b.person, name: "Wolfgang Amadeus Mozart Wolfgang Amadeus Mozart Wolfgang" } },
    ];
    const names = treatedOf(long).treated!.names;
    expect(names.endsWith("…")).toBe(true);
    expect(names.length).toBeLessThan(long[0].person.name.length + long[1].person.name.length);
  });

  it("is a card of two careers, with posters of the careers' films, for a pair that made none together", () => {
    const a = timeline(1, "Jack Lemmon", [film(1, 1960), film(2, 1970)]);
    const b = timeline(2, "Walter Matthau", [film(3, 1965), film(4, 1975)]);
    const { treated } = treatedOf([a, b]);
    expect(treated!.dots.some((dot) => dot.kind === "shared")).toBe(false);
    expect(treated!.dots.map((dot) => dot.kind)).toContain(0);
    expect(treated!.dots.map((dot) => dot.kind)).toContain(1);
    expect(treated!.caption!.segments.map((s) => s.text).join("")).toBe("Careers side by side");
  });
});

describe("the pair's treated card as markup", () => {
  function markup(timelines: PersonTimeline[]) {
    const { card, treated } = treatedOf(timelines);
    return renderToStaticMarkup(
      createElement(TreatedPairCardView, {
        pair: treated!,
        tiles: [null, null],
        people: card.people.map(({ name, initials }) => ({ name, initials })),
        posterImages: treated!.posters.map(() => null),
      }),
    );
  }

  it("has no green and no glow: the posters' ring is white, the dots white or a neutral grey (not a person's colour), and only the wordmark's two l's are the brand's", () => {
    const html = markup(pairOf([1990, 1995, 2000], [1989], [1999]));
    expect(html).not.toContain("0, 224, 84");
    expect(html).not.toContain("box-shadow");
    expect(html).not.toContain("radial-gradient");
    expect(html).toContain("border:2px solid #ffffff");
    expect(html.match(new RegExp(`background-color:${TREATED_SOLO_COLOR}`, "g"))).toHaveLength(2);
    expect(html).not.toContain("#E5487D");
    // The wordmark is the one place the brand's green is, as it is on every card.
    expect(html.match(/#00e054/g)).toHaveLength(1);
    expect(html).toContain('<span style="color:#00e054">ll</span>');
  });

  it("draws both people, the axis, a node for each shared film, the names, the count and the wordmark", () => {
    const html = markup(pairOf([1990, 1995, 2000], [1989], [1999]));
    const parts = (name: string) => (html.match(new RegExp(`data-part="${name}"`, "g")) ?? []).length;
    expect(parts("person")).toBe(2);
    expect(parts("axis")).toBe(1);
    expect(parts("node")).toBe(3);
    expect(parts("dot")).toBe(2);
    expect(parts("names")).toBe(1);
    expect(parts("caption")).toBe(1);
    expect(parts("wordmark")).toBe(1);
    expect(html).toContain("Jack Lemmon &amp; Walter Matthau");
    expect(html.replace(/<[^>]+>/g, "")).toContain("3 films over 10 years");
  });

  it("centres the names and the count on the column, under the axis", () => {
    const html = markup(pairOf([1990, 1995, 2000]));
    for (const part of ["names", "caption"]) {
      const style = new RegExp(`data-part="${part}" style="([^"]*)"`).exec(html)![1];
      expect(style).toContain("justify-content:center");
      expect(style).toContain(`left:${TREATED_LEFT}px`);
      expect(style).toContain(`width:${TREATED_WIDTH}px`);
    }
    expect(/data-part="caption" style="([^"]*)"/.exec(html)![1]).toContain(`font-size:${TREATED_CAPTION_SIZE}px`);
  });

  it("stacks the portraits of a group of four down the column, each a quarter of its height (less the gaps)", () => {
    const together = [film(1, 1990), film(2, 1995)];
    const four = [1, 2, 3, 4].map((id) => timeline(id, `Person ${id}`, together));
    const { card, treated } = treatedOf(four);
    const html = renderToStaticMarkup(
      createElement(TreatedPairCardView, {
        pair: treated!,
        tiles: [null, null, null, null],
        people: card.people.map(({ name, initials }) => ({ name, initials })),
        posterImages: treated!.posters.map(() => null),
      }),
    );
    expect((html.match(/data-part="person"/g) ?? []).length).toBe(4);
    expect(html).toContain("Person 1, Person 2, Person 3 &amp; Person 4");
    const tile = treatedTile(4);
    expect(tile.height).toBeCloseTo((630 - 3 * 4) / 4, 5);
    expect(tile.height).toBeGreaterThan(120);
    expect(html).toContain(`height:${tile.height}px`);
  });

  it("has no header row: the wordmark is at the bottom right and nothing sits at the top left", () => {
    const html = markup(pairOf([1990, 1995, 2000]));
    expect(html).not.toContain("left:60px;top:44px");
    const wordmark = /data-part="wordmark" style="([^"]*)"/.exec(html)![1];
    expect(wordmark).toContain(`right:${TREATED_MARGIN}px`);
    expect(Number.parseFloat(/top:([\d.]+)px/.exec(wordmark)![1])).toBeGreaterThan(540);
  });
});
