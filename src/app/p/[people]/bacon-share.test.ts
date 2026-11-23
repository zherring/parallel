import { afterEach, describe, expect, it, vi } from "vitest";
import { BACON_PAIR_SLUG, PAIR_SLUG, QUOTE_DATA } from "@/lib/test-people";

/**
 * What a link to a pair in Kevin Bacon mode (`?mode=bacon`, see `bacon-mode.ts` and `bacon-share.ts`) says to whoever it is shared with: the page's metadata, the quote
 * share page's, and the way its pages answer. The page without the mode, or without him, is what the other tests of these pages hold.
 */

vi.mock("@/lib/people", async () => {
  const { stubLoadPeople } = await import("@/lib/test-people");
  return { loadPeople: stubLoadPeople };
});

// Kevin Bacon's pair has quotes of its own here (the stub's pair's, under his pair's ids): a link to one of them is the quote's.
vi.mock("@/lib/clippings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clippings")>();
  const { QUOTE_DATA: data } = await import("@/lib/test-people");
  const bacon = { "4724+26467": { ...data["3151+6837"], pair: ["Kevin Bacon", "Kyra Sedgwick"], tmdb_ids: [4724, 26467] } };
  return { ...actual, getPairClippingSet: (ids: readonly number[]) => actual.pairClippingsFrom({ ...data, ...bacon }, ids) };
});

vi.mock("@/lib/critics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/critics")>();
  return { ...actual, getPairCritics: () => null };
});

vi.mock("@/components/people-view", () => ({ PeopleView: function PeopleView() {} }));
vi.mock("@/components/depth/depth-view", () => ({ DepthView: function DepthView() {} }));
vi.mock("@/components/embed/quote-embed", () => ({ QuoteEmbed: function QuoteEmbed() {} }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const REDIRECTED = "TEST_REDIRECT:";
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: vi.fn((to: string) => {
    throw new Error(`${REDIRECTED}${to}`);
  }),
}));

type Query = Record<string, string | string[] | undefined>;
const pairProps = (slug: string, query: Query = {}) => ({ params: Promise.resolve({ people: slug }), searchParams: Promise.resolve(query) });
const quoteProps = (slug: string, id: string, query: Query = {}) => ({ params: Promise.resolve({ people: slug, id }), searchParams: Promise.resolve(query) });
const thrown = (run: () => unknown) => Promise.resolve(run()).then(() => null, (error: Error) => error);

const MODE = { mode: "bacon" };
const SITE = "https://parallel.zachherring.com";
const TITLE = "Kevin Bacon & Kyra Sedgwick: films made together";

/** The pair page and the quote share page, loaded fresh so that they read the player-card flag as it is now. */
async function pages() {
  vi.resetModules();
  const pair = await import("@/app/p/[people]/page");
  const quote = await import("@/app/p/[people]/q/[id]/page");
  return { pair, quote };
}

afterEach(() => vi.unstubAllEnvs());

describe("the metadata of a pair page in Kevin Bacon mode", () => {
  it("says the mode in its title and its description", async () => {
    const { pair } = await pages();
    const meta = await pair.generateMetadata(pairProps(BACON_PAIR_SLUG, MODE));
    expect(meta.title).toBe(`${TITLE} · Kevin Bacon mode`);
    expect(meta.description).toMatch(/^Kevin Bacon mode\. Films made together by Kevin Bacon & Kyra Sedgwick: /);
    expect(meta.openGraph).toMatchObject({ title: `${TITLE} · Kevin Bacon mode`, siteName: "Parallel", type: "website" });
    expect(meta.twitter).toMatchObject({ title: `${TITLE} · Kevin Bacon mode` });
  });

  it("is the same page without the mode, in the words it has always had", async () => {
    const { pair } = await pages();
    const meta = await pair.generateMetadata(pairProps(BACON_PAIR_SLUG));
    expect(meta.title).toBe(TITLE);
    expect(meta.description).toMatch(/^Films made together by Kevin Bacon & Kyra Sedgwick: /);
    expect(meta.openGraph).toMatchObject({ url: `/p/${BACON_PAIR_SLUG}` });
    expect(meta.openGraph).not.toHaveProperty("images");
    expect(meta.other).toEqual({
      "twitter:player": `${SITE}/embed/p/${BACON_PAIR_SLUG}`,
      "twitter:player:width": "1200",
      "twitter:player:height": "630",
    });
  });

  it("keeps the canonical link without the mode and makes og:url the link as it was shared", async () => {
    const { pair } = await pages();
    const meta = await pair.generateMetadata(pairProps(BACON_PAIR_SLUG, MODE));
    expect(meta.alternates?.canonical).toBe(`/p/${BACON_PAIR_SLUG}`);
    expect(meta.openGraph).toMatchObject({ url: `/p/${BACON_PAIR_SLUG}?mode=bacon` });
  });

  it("draws the preview card in the mode (the /og route asked for it) as og:image and twitter:image", async () => {
    const { pair } = await pages();
    const meta = await pair.generateMetadata(pairProps(BACON_PAIR_SLUG, MODE));
    const poster = { url: `/p/${BACON_PAIR_SLUG}/og?mode=bacon`, width: 1200, height: 630 };
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(poster)]);
    expect(meta.twitter?.images).toEqual([expect.objectContaining(poster)]);
  });

  it("frames the mode's embed as the X player", async () => {
    const { pair } = await pages();
    const meta = await pair.generateMetadata(pairProps(BACON_PAIR_SLUG, MODE));
    expect(meta.twitter).toMatchObject({ card: "player" });
    expect(meta.other).toEqual({
      "twitter:player": `${SITE}/embed/p/${BACON_PAIR_SLUG}?mode=bacon`,
      "twitter:player:width": "1200",
      "twitter:player:height": "630",
    });
  });

  it("is the large-image card with the mode's picture where player cards are switched off", async () => {
    vi.stubEnv("NEXT_PUBLIC_PLAYER_CARDS", "0");
    const { pair } = await pages();
    const meta = await pair.generateMetadata(pairProps(BACON_PAIR_SLUG, MODE));
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.other).toBeUndefined();
    expect(meta.twitter?.images).toEqual([expect.objectContaining({ url: `/p/${BACON_PAIR_SLUG}/og?mode=bacon` })]);
  });

  it("has the period before the mode in the card and in og:url, and the mode after the period in the title", async () => {
    const { pair } = await pages();
    const meta = await pair.generateMetadata(pairProps(BACON_PAIR_SLUG, { ...MODE, from: "1970", to: "1980" }));
    expect(meta.title).toBe(`${TITLE}, 1970–1980 · Kevin Bacon mode`);
    expect(meta.description).toMatch(/^Kevin Bacon mode\. Films made together by Kevin Bacon & Kyra Sedgwick in 1970–1980: /);
    expect(meta.alternates?.canonical).toBe(`/p/${BACON_PAIR_SLUG}`);
    expect(meta.openGraph).toMatchObject({ url: `/p/${BACON_PAIR_SLUG}?from=1970&to=1980&mode=bacon` });
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: `/p/${BACON_PAIR_SLUG}/og?from=1970&to=1980&mode=bacon` })]);
  });

  it("leaves the words of a link to one quote the quote's, and carries the mode in og:url", async () => {
    const { pair } = await pages();
    const meta = await pair.generateMetadata(pairProps(BACON_PAIR_SLUG, { ...MODE, view: "clippings", quote: "short-one" }));
    expect(meta.title).toBe("“Walter could make a telephone book funny.” — Jack Lemmon");
    expect(meta.openGraph).toMatchObject({ url: `/p/${BACON_PAIR_SLUG}?view=clippings&quote=short-one&mode=bacon` });
    expect(meta.alternates?.canonical).toBe(`/p/${BACON_PAIR_SLUG}`);
  });

  it("is an ordinary page where the address names the mode but he is not on the page, or is on it alone", async () => {
    const { pair } = await pages();
    const without = await pair.generateMetadata(pairProps(PAIR_SLUG, MODE));
    expect(without.title).toBe("Jack Lemmon & Walter Matthau: films made together");
    expect(without.openGraph).toMatchObject({ url: `/p/${PAIR_SLUG}` });
    expect(without.openGraph).not.toHaveProperty("images");

    const alone = await pair.generateMetadata(pairProps("4724-kevin-bacon", MODE));
    expect(alone.title).toBe("Kevin Bacon: filmography timeline");
    expect(alone.openGraph).toMatchObject({ url: "/p/4724-kevin-bacon" });
    expect(alone.openGraph).not.toHaveProperty("images");
  });

  it("keeps the mode through the redirect to the canonical address", async () => {
    const { pair } = await pages();
    const error = await thrown(() => pair.default(pairProps("4724+26467", { ...MODE, view: "table" })));
    expect(error?.message).toBe(`${REDIRECTED}/p/${BACON_PAIR_SLUG}?view=table&mode=bacon`);
  });
});

describe("the quote share page of a pair in Kevin Bacon mode", () => {
  it("is og:url with the mode, and the quote's own words, card and player", async () => {
    const { quote } = await pages();
    const meta = await quote.generateMetadata(quoteProps(BACON_PAIR_SLUG, "short-one", MODE));
    expect(meta.openGraph).toMatchObject({ url: `/p/${BACON_PAIR_SLUG}/q/short-one?mode=bacon` });
    expect(meta.alternates).toEqual({ canonical: `/p/${BACON_PAIR_SLUG}` });
    expect(meta.title).toBe("“Walter could make a telephone book funny.” — Jack Lemmon");
    expect(meta.other).toHaveProperty("twitter:player", `${SITE}/embed/q/${BACON_PAIR_SLUG}/short-one`);
    expect(meta.twitter?.images).toEqual([expect.objectContaining({ url: `/p/${BACON_PAIR_SLUG}/og?quote=short-one` })]);
  });

  it("is og:url as it was without the mode, on a pair that has no mode to carry", async () => {
    const { quote } = await pages();
    expect((await quote.generateMetadata(quoteProps(BACON_PAIR_SLUG, "short-one"))).openGraph).toMatchObject({ url: `/p/${BACON_PAIR_SLUG}/q/short-one` });
    // The pair of the stub has no Kevin Bacon in it, so the word in the address means nothing.
    expect((await quote.generateMetadata(quoteProps(PAIR_SLUG, "short-one", MODE))).openGraph).toMatchObject({ url: `/p/${PAIR_SLUG}/q/short-one` });
    expect(QUOTE_DATA["3151+6837"]).toBeDefined();
  });

  it("leads on to the pair's page in the mode, and keeps the mode through the redirect to the canonical share URL", async () => {
    const { quote } = await pages();
    const page = (await quote.default(quoteProps(BACON_PAIR_SLUG, "short-one", MODE))) as {
      props: { children: [unknown, { props: { children: { props: { href: string } }[] } }] };
    };
    const links = page.props.children[1].props.children.map((link) => link.props.href);
    expect(links).toEqual([`/p/${BACON_PAIR_SLUG}?view=clippings&quote=short-one&mode=bacon`, `/p/${BACON_PAIR_SLUG}?mode=bacon`]);

    const error = await thrown(() => quote.default(quoteProps("4724+26467", "short-one", MODE)));
    expect(error?.message).toBe(`${REDIRECTED}/p/${BACON_PAIR_SLUG}/q/short-one?mode=bacon`);
  });

  it("leads on to the pair's page as it was without the mode", async () => {
    const { quote } = await pages();
    const page = (await quote.default(quoteProps(BACON_PAIR_SLUG, "short-one"))) as {
      props: { children: [unknown, { props: { children: { props: { href: string } }[] } }] };
    };
    expect(page.props.children[1].props.children.map((link) => link.props.href)).toEqual([
      `/p/${BACON_PAIR_SLUG}?view=clippings&quote=short-one`,
      `/p/${BACON_PAIR_SLUG}`,
    ]);
  });
});
