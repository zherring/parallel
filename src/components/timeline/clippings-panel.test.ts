import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PairCritics } from "@/lib/critics";
import raw from "@/lib/clippings.json";
import { voiceClippings } from "@/lib/clippings-view";
import { ClippingsPanel } from "./clippings-panel";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("view=clippings"),
  usePathname: () => "/p/1-first-person+2-second-person",
}));
vi.mock("@/components/newsreader", () => ({ newsreader: { variable: "test-serif" } }));

const critics: PairCritics = {
  people: [{ id: 1, name: "First Person" }, { id: 2, name: "Second Person" }],
  critics: [{
    id: "critic-a-collaboration", critic: "A Critic", publication: "A Journal", via: null,
    title: "A collaboration", date: "2020", url: "https://example.com/essay", kind: "essay",
    quote: "An enduring creative partnership.",
  }],
  reading: [{ title: "Further reading", author: "An Author", publication: "A Publisher", date: "2021", url: "https://example.com/book", paywalled: true }],
};

describe("the default Quotes page", () => {
  it("renders a critics-only pair in the same portrait deck, with a real author credit and source", () => {
    const html = renderToStaticMarkup(createElement(ClippingsPanel, { pair: null, critics, active: true }));
    expect(html).toContain("data-quote-exhibit-deck");
    expect(html).toContain('data-quote-exhibit="portraits"');
    expect(html).toContain("An enduring creative partnership.");
    expect(html).toContain("by A Critic");
    expect(html).toContain('href="https://example.com/essay"');
    expect(html).toContain('data-portrait-person="1"');
    expect(html).toContain('data-portrait-person="2"');
    expect(html).not.toContain('data-speaking="true"');
    expect(html).not.toContain('data-quiet="true"');
    expect(html).toContain("Browse all quotes");
    expect(html).toContain("More reading</button>");
    expect(html).not.toContain("<dialog");
  });

  it("renders reading-only pairs in the split layout without an empty quote counter", () => {
    const html = renderToStaticMarkup(createElement(ClippingsPanel, { pair: null, critics: { ...critics, critics: [] }, active: true }));
    expect(html).toContain("data-quote-exhibit-deck");
    expect(html).toContain('data-portrait-person="1"');
    expect(html).toContain('href="https://example.com/book"');
    expect(html).toContain("paywall");
    expect(html).not.toContain("Browse all quotes");
    expect(html).not.toContain("of 0");
  });

  for (const key of ["1259+4385", "309+955", "880+1892"] as const) {
    it(`keeps attribution inside the explainer for ${key}, without a separate byline`, () => {
      const entry = raw[key];
      const [first, second] = entry.tmdb_ids;
      const pair = voiceClippings({ people: [{ id: first, name: entry.pair[0] }, { id: second, name: entry.pair[1] }], clippings: entry.clippings }, []);
      const html = renderToStaticMarkup(createElement(ClippingsPanel, { pair, critics: null, active: true }));
      const contexts = [...html.matchAll(/<p class="quote-exhibit-context">(.*?)<\/p>/g)].map((match) => match[1].replace(/<[^>]*>/g, ""));
      expect(contexts.some((text) => text.startsWith(`${pair.clippings[0].speaker} — `))).toBe(true);
      expect(html).not.toContain("quote-exhibit-byline");
    });
  }

  it("keeps complete quoted text and reading sources in inactive server HTML, but no portraits or deck", () => {
    const html = renderToStaticMarkup(createElement(ClippingsPanel, { pair: null, critics, active: false }));
    expect(html).toContain("An enduring creative partnership.");
    expect(html).toContain('href="https://example.com/essay"');
    expect(html).toContain('href="https://example.com/book"');
    expect(html).not.toContain("data-quote-exhibit-deck");
    expect(html).not.toContain("data-portrait-person");
    expect(html).not.toContain('data-quotes-page="true"');
  });
});
