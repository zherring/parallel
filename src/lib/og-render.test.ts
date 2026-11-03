import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OG_CACHE_CONTROL, OgCardView, renderPairOgImage } from "@/lib/og-render";
import { OG_CENTER_X, OG_WIDTH, buildOgCard, composition, headshotFan } from "@/lib/og-card";
import type { Film, PersonTimeline } from "@/lib/types";

const TODAY = "2026-10-27";

const film = (id: number, year: number): Film => ({
  id,
  title: `Film ${id}`,
  releaseDate: `${year}-06-01`,
  year,
  posterPath: `/poster-${id}.jpg`,
  voteCount: 100,
  credits: [{ role: "director", job: "Director", minor: false }],
  minor: false,
});

const timeline = (id: number, name: string, films: Film[]): PersonTimeline => ({
  person: { id, name, profilePath: null, knownFor: null, birthday: null, deathday: null, biography: null },
  films,
});

/** The card as markup, the way the renderer lays it out (no images: every headshot and poster falls back to its placeholder). */
function markupOf(timelines: PersonTimeline[], period: { from: number; to: number } | null = null) {
  const card = buildOgCard(timelines, TODAY, period);
  const hasLane = card.posters.length > 0;
  const fan = headshotFan(card.people.length);
  const place = composition(fan.height, hasLane, card.chip !== null);
  const html = renderToStaticMarkup(
    createElement(OgCardView, {
      card,
      avatars: card.people.map(() => null),
      posterImages: card.posters.map(() => null),
      hasLane,
      place,
      fan,
      fanLeft: 40,
    }),
  );
  return { card, place, html };
}

/** The style of the element marked `data-part="name"`, as numbers where it has them. */
function styleOf(html: string, part: string): Record<string, string> {
  const tag = new RegExp(`<div data-part="${part}" style="([^"]*)"`).exec(html);
  if (!tag) throw new Error(`no ${part} in the card`);
  return Object.fromEntries(tag[1].split(";").map((rule) => rule.split(":") as [string, string]));
}

const px = (value: string) => Number.parseFloat(value);
const years = (list: number[]) => list.map((year, i) => film(i + 1, year));
const pair = (list: number[]) => [timeline(1, "Jack Lemmon", years(list)), timeline(2, "Walter Matthau", years(list))];

describe("the card as drawn", () => {
  it("draws the chip and the caption as rows with the same centre, the middle of the card", () => {
    const { html } = markupOf(pair([2005, 2008, 2012]));
    for (const part of ["chip", "caption"]) {
      const style = styleOf(html, part);
      expect(px(style.left) + px(style.width) / 2).toBe(OG_CENTER_X);
      expect(style["justify-content"]).toBe("center");
      expect(px(style.width)).toBe(OG_WIDTH);
    }
  });

  it("draws the chip above the caption, each clear of the other, and the chip below the lane", () => {
    const { html, place } = markupOf(pair([2005, 2008, 2012]));
    const chipTop = px(styleOf(html, "chip").top);
    const captionTop = px(styleOf(html, "caption").top);
    expect(chipTop).toBe(place.chipTop);
    expect(captionTop).toBe(place.captionTop);
    expect(chipTop).toBeGreaterThan(place.laneY! + 26);
    expect(captionTop).toBeGreaterThan(chipTop + 40);
  });

  it("says the years once, in the chip, and not beside the wordmark, on a card with no period", () => {
    const { html, card } = markupOf(pair([2005, 2008, 2012]));
    expect(card.chip).toBe("2005–2012");
    expect(html.split("2005–2012")).toHaveLength(2);
    expect(html.indexOf("2005–2012")).toBeGreaterThan(html.indexOf('data-part="chip"'));
  });

  it("says a period's label once, in the chip, not beside the wordmark as it used to", () => {
    const { html, card } = markupOf(pair([1966, 1968, 1981, 1998]), { from: 1966, to: 1981 });
    expect(card.chip).toBe("1966–1981");
    expect(html.split("1966–1981")).toHaveLength(2);
    // The wordmark is the first thing on the card, and the row it is in holds nothing else.
    const wordmark = html.indexOf("Para");
    expect(wordmark).toBeGreaterThan(-1);
    expect(html.indexOf("1966–1981")).toBeGreaterThan(html.indexOf('data-part="chip"'));
    const row = /<div style="[^"]*left:60px;top:44px[^"]*">([\s\S]*?)<\/div><\/div>(?=<div|<svg)/.exec(html);
    expect(row).not.toBeNull();
    expect(row![1]).not.toMatch(/\d{4}/);
  });

  it("draws a single year as the chip for one film", () => {
    const { html, card } = markupOf(pair([1991]));
    expect(card.chip).toBe("1991");
    expect(html).toContain('data-part="chip"');
  });

  it("draws no chip when there are no films, and the caption alone", () => {
    const { html, card, place } = markupOf([timeline(1, "Newcomer", [])]);
    expect(card.chip).toBeNull();
    expect(place.chipTop).toBeNull();
    expect(html).not.toContain('data-part="chip"');
    expect(html).toContain('data-part="caption"');
  });

  it("draws no chip for a period that holds no films", () => {
    const { html } = markupOf(pair([1990, 1995]), { from: 2000, to: 2005 });
    expect(html).not.toContain('data-part="chip"');
  });
});

describe("the card as a response", () => {
  it("is a 1200x630 PNG with the cache header every card has", async () => {
    // No portraits and no posters, so drawing it fetches nothing.
    const response = await renderPairOgImage({ timelines: pair([2005, 2008, 2012]) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(OG_CACHE_CONTROL);
    expect(OG_CACHE_CONTROL).toBe("public, s-maxage=86400, stale-while-revalidate=604800");
    const bytes = new DataView(await response.arrayBuffer());
    expect(bytes.getUint32(0)).toBe(0x89504e47);
    // The IHDR chunk holds the size: width, then height, from byte 16.
    expect([bytes.getUint32(16), bytes.getUint32(20)]).toEqual([1200, 630]);
  });
});
