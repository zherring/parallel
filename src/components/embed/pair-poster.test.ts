import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PairPoster } from "@/components/embed/pair-poster";
import { composition, headshotFan, posterRow, buildOgCard, captionText } from "@/lib/og-card";
import { PAIR_SLUG, stubLoadPeople } from "@/lib/test-people";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

const TODAY = "2026-11-13";

async function posterOf(slug: string) {
  const { timelines } = await stubLoadPeople(slug);
  const card = buildOgCard(timelines, TODAY);
  return { card, html: renderToStaticMarkup(createElement(PairPoster, { card })) };
}

const count = (html: string, part: string) => (html.match(new RegExp(`data-part="${part}"`, "g")) ?? []).length;

describe("the pair embed's first frame (the preview card as HTML)", () => {
  it("has every part of the PNG card: wordmark, lane, a node and a poster per featured film, years, both people, chip and caption", async () => {
    const { card, html } = await posterOf(PAIR_SLUG);
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
    const { card, html } = await posterOf(PAIR_SLUG);
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
    const { html } = await posterOf(PAIR_SLUG);
    expect(html).toContain("#14181c");
    expect(html).toContain("0 0 0 calc(3 * var(--px)) #00e054");
    expect(html).toContain("rgba(136, 153, 170, 0.7)");
  });

  it("holds each person's timeline colour in a ring that is not drawn until the animation shows it (the first frame is the PNG's)", async () => {
    const { html } = await posterOf(PAIR_SLUG);
    expect(count(html, "ring")).toBe(2);
    expect(html).toContain("var(--person-1)");
    expect(html).toContain("var(--person-2)");
    for (const ring of html.match(/<div data-part="ring"[^>]*>/g) ?? []) expect(ring).toContain("opacity:0");
  });

  it("has no ring for one person, whose films have no colour to tell apart", async () => {
    const { card, html } = await posterOf("3151-jack-lemmon");
    expect(card.kind).toBe("solo");
    expect(count(html, "ring")).toBe(0);
    expect(count(html, "person")).toBe(1);
  });
});
