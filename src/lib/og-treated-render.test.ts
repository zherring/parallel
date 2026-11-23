import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BACON_ORANGE, TOGETHER_WHITE, togetherColor } from "@/lib/bacon-share";
import { buildOgCard } from "@/lib/og-card";
import { buildTreatedPair } from "@/lib/og-treated";
import { TreatedPairCardView } from "@/lib/og-treated-render";
import { PAIR_SLUG, stubLoadPeople } from "@/lib/test-people";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

const TODAY = "2026-11-13";

/** The pair's treated card (the PNG of `/p/<people>/opengraph-image` and `/og`) as markup, as the image renderer lays it out, with no images: every portrait and poster falls back to its placeholder. */
async function cardOf(together?: string) {
  const { timelines } = await stubLoadPeople(PAIR_SLUG);
  const card = buildOgCard(timelines, TODAY);
  const pair = buildTreatedPair(card, timelines, TODAY)!;
  const html = renderToStaticMarkup(
    createElement(TreatedPairCardView, {
      pair,
      tiles: card.people.map(() => null),
      people: card.people.map(({ name, initials }) => ({ name, initials })),
      posterImages: pair.posters.map(() => null),
      ...(together ? { together } : {}),
    }),
  );
  return { pair, html };
}

/** The colour of the films the pair made together, where the card draws it: the posters' frames, the shared films' dots and the count's numbers. */
function togetherColours(html: string) {
  return {
    posters: [...html.matchAll(/data-part="poster" style="[^"]*border:2px solid (#[0-9a-f]{6})/g)].map((m) => m[1]),
    nodes: [...html.matchAll(/data-part="node" style="[^"]*background-color:(#[0-9a-f]{6})/g)].map((m) => m[1]),
    caption: [...html.matchAll(/<span style="[^"]*color:(#[0-9a-f]{6})">(\d+)/g)].map((m) => m[1]),
  };
}

describe("the pair's card's colour for the films made together", () => {
  it("is white by default, as it always has been", async () => {
    const { pair, html } = await cardOf();
    const colours = togetherColours(html);
    expect(colours.posters).toEqual(pair.posters.map(() => TOGETHER_WHITE));
    expect(colours.nodes).toEqual(pair.dots.filter((dot) => dot.kind === "shared").map(() => TOGETHER_WHITE));
    expect(colours.caption.length).toBeGreaterThan(0);
    expect(colours.caption.every((hex) => hex === TOGETHER_WHITE)).toBe(true);
  });

  it("is the mode's orange for a pair in Kevin Bacon mode: the posters' frames, the shared films' dots and the count's numbers", async () => {
    const { pair, html } = await cardOf(togetherColor(true));
    const colours = togetherColours(html);
    expect(colours.posters).toEqual(pair.posters.map(() => BACON_ORANGE));
    expect(colours.nodes).toEqual(pair.dots.filter((dot) => dot.kind === "shared").map(() => BACON_ORANGE));
    expect(colours.caption.length).toBeGreaterThan(0);
    expect(colours.caption.every((hex) => hex === BACON_ORANGE)).toBe(true);
    expect(html).not.toContain("solid #ffffff");
  });

  it("leaves everything that is not the films made together as it is: a person's own films, the names, the canvas, the wordmark's green", async () => {
    const plain = await cardOf();
    const mode = await cardOf(togetherColor(true));
    const strip = (html: string) => html.replaceAll(BACON_ORANGE, "#ffffff");
    expect(strip(mode.html)).toBe(plain.html);
  });
});
