import { describe, expect, it, vi } from "vitest";
import QuotePage, { generateMetadata } from "@/app/p/[people]/q/[id]/page";
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

// The page hands the quotes to a client component; it is not what these tests are about.
vi.mock("@/components/embed/quote-embed", () => ({ QuoteEmbed: function QuoteEmbed() {} }));

const REDIRECTED = "TEST_REDIRECT:";
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: vi.fn((to: string) => {
    throw new Error(`${REDIRECTED}${to}`);
  }),
}));

const props = (slug: string, id: string) => ({ params: Promise.resolve({ people: slug, id }) });
const thrown = (run: () => unknown) => Promise.resolve(run()).then(() => null, (error: Error) => error);

describe("the share URL's metadata", () => {
  it("asks X for the player card, framing the quote's embed, with the quote's card image as the poster", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, "short-one"));
    expect(meta.twitter).toMatchObject({ card: "player" });
    expect(meta.other).toEqual({
      "twitter:player": `https://parallel.zachherring.com/embed/q/${PAIR_SLUG}/short-one`,
      "twitter:player:width": "1200",
      "twitter:player:height": "630",
    });
    const poster = { url: `/p/${PAIR_SLUG}/og?quote=short-one`, width: 1200, height: 630 };
    expect(meta.twitter?.images).toEqual([expect.objectContaining(poster)]);
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(poster)]);
  });

  it("is the share URL itself in og:url, titled and described as the link to the quote is, and points search engines at the pair's page", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, "short-one"));
    expect(meta.title).toBe("“Walter could make a telephone book funny.” — Jack Lemmon");
    expect(meta.description).toBe("Jack Lemmon on Walter Matthau · Example Times, 1998");
    expect(meta.openGraph).toMatchObject({ url: `/p/${PAIR_SLUG}/q/short-one`, type: "website", siteName: "Parallel" });
    expect(meta.alternates).toEqual({ canonical: `/p/${PAIR_SLUG}` });
  });

  it("does the same for a critic's quote", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, "critic-short"));
    expect(meta.twitter).toMatchObject({ card: "player" });
    expect(meta.other).toHaveProperty("twitter:player", `https://parallel.zachherring.com/embed/q/${PAIR_SLUG}/critic-short`);
    expect(meta.description).toBe("Pat Critic on Lemmon & Matthau · Example Review, 1999");
  });

  it("promises no player for a quote the pair does not have", async () => {
    expect(await generateMetadata(props(PAIR_SLUG, "nope"))).toEqual({});
  });
});

describe("the share URL's page", () => {
  it("opens on the quote, in a card, with the pair's quotes around it", async () => {
    const page = (await QuotePage(props(PAIR_SLUG, "short-one"))) as { props: { children: { props: Record<string, unknown> }[] } };
    expect(page.props.children[0].props).toMatchObject({ variant: "card", slug: PAIR_SLUG, start: 1 });
    expect((page.props.children[0].props.quotes as unknown[]).length).toBe(4);
  });

  it("is a 404 for a quote the pair does not have", async () => {
    expect((await thrown(() => QuotePage(props(PAIR_SLUG, "nope"))))?.message).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("sends a spelling of the people that is not the canonical one to the canonical share URL", async () => {
    const error = await thrown(() => QuotePage(props("3151+6837", "short-one")));
    expect(error?.message).toBe(`${REDIRECTED}/p/${PAIR_SLUG}/q/short-one`);
  });
});
