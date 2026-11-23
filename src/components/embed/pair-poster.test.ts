import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PairPoster } from "@/components/embed/pair-poster";
import { composition, headshotFan, posterRow, buildOgCard, captionText } from "@/lib/og-card";
import { TREATED_POSTER, buildTreatedPair, treatedPairLayout } from "@/lib/og-treated";
import { BACON_ORANGE, togetherColor } from "@/lib/bacon-share";
import { PAIR_SLUG, stubLoadPeople } from "@/lib/test-people";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

const TODAY = "2026-11-13";

const SOLO_SLUG = "3151-jack-lemmon";

/** The first frame as the embed page hands it: the treated card for two to four people (`buildTreatedPair`), the plain one for one. */
async function posterOf(slug: string) {
  const { timelines } = await stubLoadPeople(slug);
  const card = buildOgCard(timelines, TODAY);
  const treated = buildTreatedPair(card, timelines, TODAY);
  return { card, treated, html: renderToStaticMarkup(createElement(PairPoster, { card, treated })) };
}

/** The plain card's parts (`PlainPairPoster`) with two people, as the card draws them for a fan: a pair is never handed it, so it is asked for with no treated card. */
async function plainPosterOf(slug: string) {
  const { timelines } = await stubLoadPeople(slug);
  const card = buildOgCard(timelines, TODAY);
  return { card, html: renderToStaticMarkup(createElement(PairPoster, { card })) };
}

const count = (html: string, part: string) => (html.match(new RegExp(`data-part="${part}"`, "g")) ?? []).length;

describe("the plain card as HTML (one person's, the timeline's own: a fan of two is the same layout)", () => {
  it("has every part of the PNG card: wordmark, lane, a node and a poster per featured film, years, both people, chip and caption", async () => {
    const { card, html } = await plainPosterOf(PAIR_SLUG);
    expect(html).toContain("Para");
    expect(html).toContain(">ll<");
    expect(count(html, "wordmark")).toBe(1);
    expect(count(html, "lane")).toBe(1);
    expect(count(html, "poster")).toBe(card.posters.length);
    expect(count(html, "node")).toBe(card.dots.filter((dot) => dot.featured).length);
    expect(count(html, "dot")).toBe(card.dots.filter((dot) => !dot.featured).length);
    expect(count(html, "years")).toBe(2);
    expect(count(html, "person")).toBe(2);
    expect(count(html, "chip")).toBe(1);
    expect(count(html, "caption")).toBe(1);
    for (const person of card.people) for (const line of person.overlay) expect(html).toContain(line);
    expect(html).toContain(card.chip);
    expect(html.replace(/<[^>]+>/g, "")).toContain(captionText(card.caption!));
    expect(captionText(card.caption!)).toBe("6 films over 32 years");
  });

  it("places the parts where the PNG does: the same functions, from the same card, in the card's own pixels", async () => {
    const { card, html } = await plainPosterOf(PAIR_SLUG);
    const fan = headshotFan(card.people.length);
    const place = composition(fan.height, true, card.chip !== null);
    expect(html).toContain(`top:calc(${(place.laneY ?? 0) - 1} * var(--px))`);
    expect(html).toContain(`top:calc(${place.postersTop} * var(--px))`);
    expect(html).toContain(`top:calc(${place.headshotTop} * var(--px))`);
    expect(html).toContain(`top:calc(${place.captionTop} * var(--px))`);
    for (const left of posterRow(card.posters.length)) expect(html).toContain(`left:calc(${left} * var(--px))`);
    // The stage is the card's 1200 x 630 and nothing else.
    expect(html).toContain("width:calc(1200 * var(--px));height:calc(630 * var(--px))");
  });

  it("draws the card's colours: the canvas, the green ring of a shared film, and the lane", async () => {
    const { html } = await plainPosterOf(PAIR_SLUG);
    expect(html).toContain("#14181c");
    expect(html).toContain("0 0 0 calc(3 * var(--px)) #00e054");
    expect(html).toContain("rgba(136, 153, 170, 0.7)");
  });

  it("draws no ring, tint or second card behind or around the headshots, in the first frame or at any point after it: they are the PNG's, as it is", async () => {
    const { card, html } = await plainPosterOf(PAIR_SLUG);
    expect(count(html, "ring")).toBe(0);
    expect(count(html, "person")).toBe(card.people.length);
    expect(html).not.toContain("var(--person-1)");
    // Each headshot is one box of the card's own (its border and shadow) and no other box is placed over the same spot.
    const fan = headshotFan(card.people.length);
    const place = composition(fan.height, true, card.chip !== null);
    expect(html.split(`top:calc(${place.headshotTop} * var(--px))`)).toHaveLength(card.people.length + 1);
  });

  it("is the same for one person: no ring, one headshot", async () => {
    const { card, html } = await posterOf(SOLO_SLUG);
    expect(card.kind).toBe("solo");
    expect(count(html, "ring")).toBe(0);
    expect(count(html, "person")).toBe(1);
    // One person is the plain card, never the treated one.
    expect(count(html, "names")).toBe(0);
  });
});

describe("the pair embed's first frame for two to four people (the treated card as HTML)", () => {
  it("is the PNG's layout: both portraits down the left edge, the posters, the axis with its nodes, the names, the count and the wordmark", async () => {
    const { treated, html } = await posterOf(PAIR_SLUG);
    expect(count(html, "person")).toBe(2);
    expect(count(html, "poster")).toBe(treated!.posters.length);
    expect(count(html, "node")).toBe(treated!.dots.filter((dot) => dot.kind === "shared").length);
    expect(count(html, "dot")).toBe(treated!.dots.filter((dot) => dot.kind !== "shared").length);
    expect(count(html, "lane")).toBe(1);
    expect(count(html, "names")).toBe(1);
    expect(count(html, "caption")).toBe(1);
    expect(count(html, "wordmark")).toBe(1);
    // The sequence's parts: the numbers of the count tick.
    expect(count(html, "accent")).toBe(2);
    expect(html.replace(/<[^>]+>/g, "")).toContain("6 films over 32 years");
    const place = treatedPairLayout();
    expect(html).toContain(`top:calc(${place.postersTop} * var(--px))`);
    expect(html).toContain(`top:calc(${place.captionTop} * var(--px))`);
    expect(html).toContain("width:calc(1200 * var(--px));height:calc(630 * var(--px))");
    expect(treated!.posters.length).toBeLessThanOrEqual(TREATED_POSTER.count);
  });

  it("has no header row, no green ring or glow, and no chip", async () => {
    const { html } = await posterOf(PAIR_SLUG);
    expect(html).not.toContain("0 0 0 calc(3 * var(--px)) #00e054");
    expect(html).not.toContain("rgba(0, 224, 84");
    expect(count(html, "chip")).toBe(0);
    expect(count(html, "years")).toBe(0);
    // White rings on the posters; the wordmark's two l's are the brand's only green.
    expect(html).toContain("2 * var(--px)) solid #ffffff");
    expect(html.match(/#00e054/g)).toHaveLength(1);
  });

  it("is the plain card for one person, which has no treated card to hand", async () => {
    const { treated, html } = await posterOf(SOLO_SLUG);
    expect(treated).toBeNull();
    expect(count(html, "names")).toBe(0);
    expect(html).toContain("0 0 0 calc(3 * var(--px)) #00e054");
  });

  describe("in Kevin Bacon mode (`together` is the mode's orange)", () => {
    /** The frame colour of every poster, the fill of every shared film's node and the colour of the count's numbers: what the card draws in the colour of the films made together. */
    const togetherColours = (html: string) => ({
      posters: [...html.matchAll(/data-part="poster" style="[^"]*border:calc\(2 \* var\(--px\)\) solid (#[0-9a-f]{6})/g)].map((m) => m[1]),
      nodes: [...html.matchAll(/data-part="node" style="[^"]*background-color:(#[0-9a-f]{6})/g)].map((m) => m[1]),
      accents: [...html.matchAll(/data-part="accent" style="[^"]*color:(#[0-9a-f]{6})/g)].map((m) => m[1]),
    });

    it("draws the posters' frames, the shared films' nodes and the count's numbers white, as it always has, by default", async () => {
      const { treated, html } = await posterOf(PAIR_SLUG);
      const colours = togetherColours(html);
      expect(colours.posters).toEqual(treated!.posters.map(() => "#ffffff"));
      expect(colours.nodes).toEqual(treated!.dots.filter((dot) => dot.kind === "shared").map(() => "#ffffff"));
      expect(colours.accents).toEqual(["#ffffff", "#ffffff"]);
      expect(togetherColor(false)).toBe("#ffffff");
    });

    it("draws all three in the orange, and leaves a person's own films and the card's own colours as they are", async () => {
      const { timelines } = await stubLoadPeople(PAIR_SLUG);
      const card = buildOgCard(timelines, TODAY);
      const treated = buildTreatedPair(card, timelines, TODAY);
      const html = renderToStaticMarkup(createElement(PairPoster, { card, treated, together: togetherColor(true) }));
      const colours = togetherColours(html);
      expect(BACON_ORANGE).toBe("#ff8000");
      expect(colours.posters).toEqual(treated!.posters.map(() => BACON_ORANGE));
      expect(colours.nodes).toEqual(treated!.dots.filter((dot) => dot.kind === "shared").map(() => BACON_ORANGE));
      expect(colours.accents).toEqual([BACON_ORANGE, BACON_ORANGE]);
      expect(html).not.toContain("solid #ffffff");
      expect(html).toContain("#14181c");
      // The wordmark's two l's are still the brand's green.
      expect(html.match(/#00e054/g)).toHaveLength(1);
    });
  });
});
