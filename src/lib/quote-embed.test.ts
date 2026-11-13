import { describe, expect, it } from "vitest";
import raw from "@/lib/clippings.json";
import essays from "@/lib/essays.json";
import type { Clipping, VoicedClippings } from "@/lib/clippings";
import { voiceClippings } from "@/lib/clippings-view";
import type { PairCritics } from "@/lib/critics";
import {
  MORE_PAIRS_PATH,
  PLAYER_SIZE,
  embedPath,
  embedQuotes,
  findQuoteIndex,
  quoteInPairPath,
  quotePath,
  quoteSharePath,
  quoteUnits,
} from "@/lib/quote-embed";
import { pairQuotes } from "@/lib/quote-embed-data";
import type { PersonTimeline } from "@/lib/types";

const SLUG = "488-steven-spielberg+491-john-williams";

describe("paths", () => {
  it("puts the share URL under the pair's page and the embed under /embed, both with the quote's id", () => {
    expect(quotePath(SLUG, "john-is-much-more-of-a")).toBe(`/p/${SLUG}/q/john-is-much-more-of-a`);
    expect(embedPath(SLUG, "john-is-much-more-of-a")).toBe(`/embed/q/${SLUG}/john-is-much-more-of-a`);
  });

  it("builds the share URL of the pair page the visitor is on, which is already canonical", () => {
    expect(quoteSharePath(`/p/${SLUG}`, "john-is-much-more-of-a")).toBe(`/p/${SLUG}/q/john-is-much-more-of-a`);
    expect(quoteSharePath(`/p/${SLUG}/`, "critic-x")).toBe(`/p/${SLUG}/q/critic-x`);
  });

  it("opens the pair's Clippings tab on the quote, and the landing page's Quotes tab for more pairs", () => {
    expect(quoteInPairPath(SLUG, "critic-x")).toBe(`/p/${SLUG}?view=clippings&quote=critic-x`);
    expect(MORE_PAIRS_PATH).toBe("/#clippings");
  });

  it("asks for the shape of the poster", () => {
    expect(PLAYER_SIZE).toEqual({ width: 1200, height: 630 });
  });
});

const timeline = (id: number, name: string): PersonTimeline => ({
  person: { id, name, profilePath: `/${id}.jpg`, knownFor: null, birthday: null, deathday: null, biography: null },
  films: [],
});

describe("quote ids", () => {
  const quotes = pairQuotes([timeline(488, "Steven Spielberg"), timeline(491, "John Williams")]);

  it("are the ids the Clippings tab already links with: the pair's clippings and critics, one list, oldest first", () => {
    const clippings = raw["488+491"].clippings.length;
    const critics = essays["488+491"].critics.length;
    expect(quotes).toHaveLength(clippings + critics);
    expect(quotes.map((q) => q.id)).toContain("john-is-much-more-of-a");
    expect(quotes.map((q) => q.id)).toContain("critic-e-t-the-extra-terrestrial-1982");
  });

  it("resolve to their place in the list, in the id's own spelling or percent-encoded", () => {
    const at = findQuoteIndex(quotes, "john-is-much-more-of-a");
    expect(quotes[at].id).toBe("john-is-much-more-of-a");
    expect(findQuoteIndex(quotes, encodeURIComponent("john-is-much-more-of-a"))).toBe(at);
    expect(findQuoteIndex(quotes, "  john-is-much-more-of-a ")).toBe(at);
  });

  it.each([["an id the pair does not have", "nope"], ["no id", ""], ["a malformed escape", "%E0%A4%A"], ["a quote of another pair", "so-thelma-finally-decided-to-put"]])(
    "do not resolve for %s",
    (_name, id) => {
      expect(findQuoteIndex(quotes, id)).toBe(-1);
    },
  );

  it("are a missing id for null and undefined", () => {
    expect(findQuoteIndex(quotes, null)).toBe(-1);
    expect(findQuoteIndex(quotes, undefined)).toBe(-1);
  });

  it("give the speaker the headshot and the colour slot of the same person on the page, whatever order the page names the pair in", () => {
    const forward = pairQuotes([timeline(488, "Steven Spielberg"), timeline(491, "John Williams")]);
    const reverse = pairQuotes([timeline(491, "John Williams"), timeline(488, "Steven Spielberg")]);
    const speaker = (list: typeof forward, name: string) => list.find((q) => q.speaker === name)!;
    expect(speaker(forward, "Steven Spielberg")).toMatchObject({ slot: 0, avatar: { name: "Steven Spielberg", profilePath: "/488.jpg" } });
    expect(speaker(reverse, "Steven Spielberg")).toMatchObject({ slot: 1, avatar: { name: "Steven Spielberg", profilePath: "/488.jpg" } });
  });

  it("set a critic's quote in the pair's family names, quiet, with initials for a picture", () => {
    const critic = quotes.find((q) => q.id.startsWith("critic-"))!;
    expect(critic).toMatchObject({ about: "Spielberg & Williams", slot: null, film: null });
    expect(critic.avatar?.profilePath).toBeNull();
  });
});

describe("the data: every quote of every pair", () => {
  const people = (entry: { pair: string[]; tmdb_ids: number[] }) => entry.tmdb_ids.map((id, i) => timeline(id, entry.pair[i]));
  const entries = Object.values({ ...raw, ...essays } as Record<string, { pair: string[]; tmdb_ids: number[] }>);

  it("has an id that is safe in a path, unique within its pair, and is found again by it", () => {
    for (const entry of entries) {
      const quotes = pairQuotes(people(entry));
      const ids = quotes.map((q) => q.id);
      expect(new Set(ids).size, entry.pair.join(" & ")).toBe(ids.length);
      for (const id of ids) {
        expect(id, id).toMatch(/^[a-z0-9-]+$/);
        expect(quotes[findQuoteIndex(quotes, id)].id).toBe(id);
      }
    }
  });

  it("has a critic's id that no clipping has, anywhere", () => {
    const clippingIds = Object.values(raw).flatMap((entry) => entry.clippings.map((c: Clipping) => c.id));
    const criticIds = Object.values(essays).flatMap((entry) => entry.critics.map((c) => c.id));
    expect(criticIds.every((id) => id.startsWith("critic-"))).toBe(true);
    expect(clippingIds.some((id) => id.startsWith("critic-"))).toBe(false);
    expect(new Set(criticIds).size).toBe(criticIds.length);
  });
});

describe("embedQuotes", () => {
  const clipping = (overrides: Partial<Clipping>): Clipping => ({
    id: "a",
    speaker: "Jack Lemmon",
    about: "Walter Matthau",
    quote: "Q.",
    film: "The Odd Couple",
    said_year: 1998,
    publication: "Example Times",
    title: "Headline",
    date: "2001-03",
    url: "https://example.com/a",
    via: null,
    context: "",
    secondhand: false,
    ...overrides,
  });
  const voiced = (clippings: Clipping[]): VoicedClippings =>
    voiceClippings(
      { people: [{ id: 1, name: "Jack Lemmon" }, { id: 2, name: "Walter Matthau" }], clippings },
      [{ id: 1, profilePath: "/j.jpg" }, { id: 2, profilePath: null }],
    );

  it("says who is speaking, about whom, the film, the source and the year it goes under (the older of the two)", () => {
    const [quote] = embedQuotes(voiced([clipping({})]), null);
    expect(quote).toEqual({
      id: "a",
      quote: "Q.",
      speaker: "Jack Lemmon",
      about: "Walter Matthau",
      slot: 0,
      avatar: { name: "Jack Lemmon", profilePath: "/j.jpg" },
      film: "The Odd Couple",
      publication: "Example Times",
      year: 1998,
      url: "https://example.com/a",
    });
  });

  it("has no colour and no headshot for a speaker who is neither of the pair", () => {
    const [quote] = embedQuotes(voiced([clipping({ speaker: "Billy Wilder", about: "Jack Lemmon" })]), null);
    expect(quote).toMatchObject({ slot: null, avatar: null });
  });

  it("interleaves the critics' quotes with the artists', oldest first, an artist's first within a year", () => {
    const critics: PairCritics = {
      people: [{ id: 1, name: "Jack Lemmon" }, { id: 2, name: "Walter Matthau" }],
      critics: [{ id: "critic-z", critic: null, publication: "Kirkus Reviews", via: null, title: "T", date: "1990", url: "https://example.com/c", kind: "review", quote: "C." }],
      reading: [],
    };
    const list = embedQuotes(voiced([clipping({ id: "late", said_year: 2000, date: "2001" }), clipping({ id: "same", said_year: 1990, date: "1990" })]), critics);
    expect(list.map((q) => q.id)).toEqual(["same", "critic-z", "late"]);
    expect(list[1]).toMatchObject({ speaker: "Kirkus Reviews", about: "Lemmon & Matthau" });
  });

  it("is empty for a pair with neither", () => {
    expect(embedQuotes(null, null)).toEqual([]);
  });
});

describe("quoteUnits", () => {
  it("is the card image's font size in twelfths, so the frame sets the type as the card does at 1200 wide", () => {
    expect(quoteUnits(72)).toBe(6);
    expect(quoteUnits(37)).toBe(3.08);
  });
});
