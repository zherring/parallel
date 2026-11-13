import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAIR_SLUG } from "@/lib/test-people";

vi.mock("@/lib/people", async () => {
  const { stubLoadPeople } = await import("@/lib/test-people");
  return { loadPeople: stubLoadPeople };
});

vi.mock("@/lib/clippings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clippings")>();
  const { QUOTE_DATA: data } = await import("@/lib/test-people");
  return { ...actual, getPairClippingSet: (ids: readonly number[]) => actual.pairClippingsFrom(data, ids) };
});

vi.mock("@/lib/critics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/critics")>();
  const { CRITIC_DATA: data } = await import("@/lib/test-people");
  return { ...actual, getPairCritics: (ids: readonly number[]) => actual.pairCriticsFrom(data, ids) };
});

// The pages hand their people to client components; they are not what these tests are about.
vi.mock("@/components/people-view", () => ({ PeopleView: function PeopleView() {} }));
vi.mock("@/components/depth/depth-view", () => ({ DepthView: function DepthView() {} }));
vi.mock("@/components/embed/quote-embed", () => ({ QuoteEmbed: function QuoteEmbed() {} }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

type Query = Record<string, string | string[] | undefined>;
const pairProps = (slug: string, query: Query = {}) => ({ params: Promise.resolve({ people: slug }), searchParams: Promise.resolve(query) });
const quoteProps = (slug: string, id: string) => ({ params: Promise.resolve({ people: slug, id }) });

const PLAYER_TAGS = {
  "twitter:player": `https://parallel.zachherring.com/embed/p/${PAIR_SLUG}`,
  "twitter:player:width": "1200",
  "twitter:player:height": "630",
};

/** The pair page and the quote share page, loaded fresh so that they read the flag as it is now. */
async function pages() {
  vi.resetModules();
  const pair = await import("@/app/p/[people]/page");
  const quote = await import("@/app/p/[people]/q/[id]/page");
  return { pair: pair.generateMetadata, quote: quote.generateMetadata };
}

afterEach(() => vi.unstubAllEnvs());

describe("the pair page's link, with player cards on (the default)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("asks X for a player card framing the pair's embed, 1200 x 630, with the pair's own card image as the poster", async () => {
    const { pair } = await pages();
    const meta = await pair(pairProps(PAIR_SLUG));
    expect(meta.twitter).toMatchObject({ card: "player" });
    expect(meta.other).toEqual(PLAYER_TAGS);
    // No image of its own: the `opengraph-image` next to the page is the card, as before (and what X shows until the frame loads).
    expect(meta.twitter).not.toHaveProperty("images");
    expect(meta.openGraph).not.toHaveProperty("images");
  });

  it("keeps the Open Graph tags and the canonical address as they were", async () => {
    const { pair } = await pages();
    const meta = await pair(pairProps(PAIR_SLUG));
    expect(meta.title).toBe("Jack Lemmon & Walter Matthau: films made together");
    expect(meta.openGraph).toMatchObject({ url: `/p/${PAIR_SLUG}`, type: "website", siteName: "Parallel" });
    expect(meta.alternates?.canonical).toBe(`/p/${PAIR_SLUG}`);
  });

  it("is the player for a link that carries a view of its own, which opens the same page", async () => {
    const { pair } = await pages();
    expect((await pair(pairProps(PAIR_SLUG, { view: "table", sort: "year" }))).other).toEqual(PLAYER_TAGS);
  });

  it("is not a player for a shared period or for a quote in the link: each is its own card, as before", async () => {
    const { pair } = await pages();
    for (const query of [{ from: "1970", to: "1980" }, { view: "clippings", quote: "short-one" }]) {
      const meta = await pair(pairProps(PAIR_SLUG, query));
      expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
      expect(meta.other).toBeUndefined();
    }
  });

  it("is not a player for one person: the pair's embed is a pair's", async () => {
    const { pair } = await pages();
    const meta = await pair(pairProps("3151-jack-lemmon"));
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.other).toBeUndefined();
  });

  it("is the player on the quote's share page too, as it was", async () => {
    const { quote } = await pages();
    const meta = await quote(quoteProps(PAIR_SLUG, "short-one"));
    expect(meta.twitter).toMatchObject({ card: "player" });
    expect(meta.other).toHaveProperty("twitter:player", `https://parallel.zachherring.com/embed/q/${PAIR_SLUG}/short-one`);
  });
});

describe("the same links with player cards switched off (NEXT_PUBLIC_PLAYER_CARDS=0)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_PLAYER_CARDS", "0"));

  it("are the large-image card again, with no player tags, on the pair's page", async () => {
    const { pair } = await pages();
    const meta = await pair(pairProps(PAIR_SLUG));
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "Jack Lemmon & Walter Matthau: films made together" });
    expect(meta.other).toBeUndefined();
    expect(meta.openGraph).toMatchObject({ url: `/p/${PAIR_SLUG}`, type: "website", siteName: "Parallel" });
  });

  it("and on the quote's share page, whose card image is still the quote's", async () => {
    const { quote } = await pages();
    const meta = await quote(quoteProps(PAIR_SLUG, "short-one"));
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.other).toBeUndefined();
    const poster = { url: `/p/${PAIR_SLUG}/og?quote=short-one`, width: 1200, height: 630 };
    expect(meta.twitter?.images).toEqual([expect.objectContaining(poster)]);
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(poster)]);
  });
});
