import { beforeEach, describe, expect, it, vi } from "vitest";
import PeoplePage, { generateMetadata } from "@/app/p/[people]/page";
import { DepthView } from "@/components/depth/depth-view";
import { PeopleView } from "@/components/people-view";
import { PAIR_SLUG } from "@/lib/test-people";

vi.mock("@/lib/people", async () => {
  const { stubLoadPeople } = await import("@/lib/test-people");
  return { loadPeople: stubLoadPeople };
});

// The pair of the stub has quotes of its own (see `QUOTE_DATA`), as four real pairs have in clippings.json.
vi.mock("@/lib/clippings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clippings")>();
  const { QUOTE_DATA: data } = await import("@/lib/test-people");
  return { ...actual, getPairClippingSet: (ids: readonly number[]) => actual.pairClippingsFrom(data, ids) };
});

// ... and critics of its own (see `CRITIC_DATA`), as two real pairs have in essays.json.
vi.mock("@/lib/critics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/critics")>();
  const { CRITIC_DATA: data } = await import("@/lib/test-people");
  return { ...actual, getPairCritics: (ids: readonly number[]) => actual.pairCriticsFrom(data, ids) };
});

// The page hands the people to a client component; it is not what these tests are about.
vi.mock("@/components/people-view", () => ({ PeopleView: function PeopleView() {} }));
vi.mock("@/components/depth/depth-view", () => ({ DepthView: function DepthView() {} }));

// The request's headers: the user agent decides which view a link that names none opens.
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const GOOGLEBOT_SMARTPHONE =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
let userAgentHeader: string | null = DESKTOP;
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers(userAgentHeader === null ? {} : { "user-agent": userAgentHeader })),
}));

const REDIRECTED = "TEST_REDIRECT:";
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: vi.fn((to: string) => {
    throw new Error(`${REDIRECTED}${to}`);
  }),
}));

type Query = Record<string, string | string[] | undefined>;
const props = (slug: string, query: Query = {}) => ({ params: Promise.resolve({ people: slug }), searchParams: Promise.resolve(query) });
const redirectsTo = async (slug: string, query: Query = {}) => {
  const error = await Promise.resolve(PeoplePage(props(slug, query))).then(
    () => null,
    (thrown: Error) => thrown,
  );
  return error?.message.startsWith(REDIRECTED) ? error.message.slice(REDIRECTED.length) : null;
};

const IMAGE = (query: string) => ({ url: `/p/${PAIR_SLUG}/og${query}`, width: 1200, height: 630 });

describe("generateMetadata", () => {
  describe("with a period in the link", () => {
    it("points og:image and twitter:image at the period's card, in the canonical spelling of the period", async () => {
      const meta = await generateMetadata(props(PAIR_SLUG, { from: "1970", to: "1980" }));
      expect(meta.openGraph?.images).toEqual([expect.objectContaining(IMAGE("?from=1970&to=1980"))]);
      expect(meta.twitter?.images).toEqual([expect.objectContaining(IMAGE("?from=1970&to=1980"))]);
    });

    it("says the period in the title, the description and the page's own url, and keeps the plain page as canonical", async () => {
      const meta = await generateMetadata(props(PAIR_SLUG, { from: "1970", to: "1980" }));
      expect(meta.title).toBe("Jack Lemmon & Walter Matthau: films made together, 1970–1980");
      expect(meta.description).toContain("in 1970–1980");
      expect(meta.openGraph?.title).toBe(meta.title);
      expect(meta.openGraph?.url).toBe(`/p/${PAIR_SLUG}?from=1970&to=1980`);
      expect(meta.alternates?.canonical).toBe(`/p/${PAIR_SLUG}`);
    });

    it("reads the period the way the card does: swapped, open or clamped ends come out as one period", async () => {
      const swapped = await generateMetadata(props(PAIR_SLUG, { from: "1980", to: "1970" }));
      expect(swapped.openGraph?.images).toEqual([expect.objectContaining(IMAGE("?from=1970&to=1980"))]);
      const open = await generateMetadata(props(PAIR_SLUG, { from: "1990" }));
      expect(open.openGraph?.images).toEqual([expect.objectContaining(IMAGE("?from=1990&to=1998"))]);
      const clamped = await generateMetadata(props(PAIR_SLUG, { from: "1900", to: "1980" }));
      expect(clamped.openGraph?.images).toEqual([expect.objectContaining(IMAGE("?from=1966&to=1980"))]);
    });

    it("takes the first of a repeated parameter", async () => {
      const meta = await generateMetadata(props(PAIR_SLUG, { from: ["1970", "1975"], to: "1980" }));
      expect(meta.openGraph?.images).toEqual([expect.objectContaining(IMAGE("?from=1970&to=1980"))]);
    });
  });

  describe("with no period, or none that means anything", () => {
    it.each([
      ["no query", {}],
      ["ends that are not years", { from: "abc", to: "xyz" }],
      ["years out of range", { from: "1700", to: "3000" }],
      ["a period that covers every year of the films", { from: "1966", to: "1998" }],
      ["a period outside the films' years", { from: "2010", to: "2020" }],
      ["other parameters", { view: "table", sort: "year" }],
    ])("is the plain page's metadata, with no image of its own, for %s", async (_name, query) => {
      const meta = await generateMetadata(props(PAIR_SLUG, query));
      expect(meta.title).toBe("Jack Lemmon & Walter Matthau: films made together");
      expect(meta.description).not.toContain(" in 19");
      expect(meta.openGraph).not.toHaveProperty("images");
      expect(meta.twitter).not.toHaveProperty("images");
      expect(meta.openGraph?.url).toBe(`/p/${PAIR_SLUG}`);
      expect(meta.alternates?.canonical).toBe(`/p/${PAIR_SLUG}`);
    });
  });
});

describe("generateMetadata with a quote in the link", () => {
  const SHORT = { view: "clippings", quote: "short-one" };
  const QUOTE_IMAGE = (id: string) => ({ url: `/p/${PAIR_SLUG}/og?quote=${id}`, width: 1200, height: 630 });

  it("points og:image and twitter:image at the quote's card", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, SHORT));
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("short-one"))]);
    expect(meta.twitter?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("short-one"))]);
  });

  it("titles the link with the quote and who said it, and describes who said it about whom and where", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, SHORT));
    expect(meta.title).toBe("\u201cWalter could make a telephone book funny.\u201d \u2014 Jack Lemmon");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.twitter?.title).toBe(meta.title);
    // said in 1998, in an article of 2001: the older year
    expect(meta.description).toBe("Jack Lemmon on Walter Matthau \u00b7 Example Times, 1998");
    expect(meta.openGraph?.description).toBe(meta.description);
  });

  it("cuts a long quote in the title, and says the year of the original when no year was said", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, { quote: "long-one" }));
    const title = String(meta.title);
    expect(title.startsWith("\u201cJack never stopped working.")).toBe(true);
    expect(title.endsWith("\u2026\u201d \u2014 Walter Matthau")).toBe(true);
    expect(Array.from(title).length).toBeLessThan(120);
    expect(meta.description).toBe("Walter Matthau on Jack Lemmon \u00b7 Example Times, 1975");
  });

  it("keeps the plain page as canonical, and the link as the page's own url", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, SHORT));
    expect(meta.openGraph?.url).toBe(`/p/${PAIR_SLUG}?view=clippings&quote=short-one`);
    expect(meta.alternates?.canonical).toBe(`/p/${PAIR_SLUG}`);
  });

  it("does not need the clippings view in the link, and takes the first of a repeated parameter", async () => {
    const bare = await generateMetadata(props(PAIR_SLUG, { quote: "short-one" }));
    expect(bare.openGraph?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("short-one"))]);
    const twice = await generateMetadata(props(PAIR_SLUG, { quote: ["long-one", "short-one"] }));
    expect(twice.openGraph?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("long-one"))]);
  });

  it("wins over a period in the same link", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, { ...SHORT, from: "1970", to: "1980" }));
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("short-one"))]);
    expect(meta.openGraph?.url).toBe(`/p/${PAIR_SLUG}?view=clippings&quote=short-one`);
  });

  // The page opens a valid quote on the Clippings with or without `view=clippings` (see `parseView`), so the card is
  // promised for both; a link that names another view opens that view, so it promises no quote.
  it.each([
    ["the table", { view: "table", quote: "short-one" }],
    ["the timeline", { view: "timeline", quote: "short-one" }],
    ["a critic's quote on the table", { view: "table", quote: "critic-short" }],
  ])("is the plain page's metadata when the link names %s as well", async (_name, query) => {
    const meta = await generateMetadata(props(PAIR_SLUG, query));
    expect(meta.title).toBe("Jack Lemmon & Walter Matthau: films made together");
    expect(meta.openGraph).not.toHaveProperty("images");
    expect(meta.openGraph?.url).toBe(`/p/${PAIR_SLUG}`);
  });

  it("opens a quote on the Clippings even when the link also carries a sort, if it names no view", async () => {
    const sorted = await generateMetadata(props(PAIR_SLUG, { sort: "rating", quote: "short-one" }));
    expect(sorted.openGraph?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("short-one"))]);
  });

  it.each([
    ["an id the pair does not have", { quote: "nope" }],
    ["an empty id", { quote: "" }],
    ["an id of another case", { quote: "SHORT-ONE" }],
    ["no id", { view: "clippings" }],
  ])("is the plain page's metadata, with no image of its own, for %s", async (_name, query) => {
    const meta = await generateMetadata(props(PAIR_SLUG, query));
    expect(meta.title).toBe("Jack Lemmon & Walter Matthau: films made together");
    expect(meta.openGraph).not.toHaveProperty("images");
    expect(meta.twitter).not.toHaveProperty("images");
    expect(meta.openGraph?.url).toBe(`/p/${PAIR_SLUG}`);
  });

  it("reads a period when the id is not a quote of the pair", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, { quote: "nope", from: "1970", to: "1980" }));
    expect(meta.openGraph?.images).toEqual([expect.objectContaining({ url: `/p/${PAIR_SLUG}/og?from=1970&to=1980` })]);
  });
});

describe("generateMetadata with a critic's quote in the link", () => {
  const SHORT = { view: "clippings", quote: "critic-short" };
  const QUOTE_IMAGE = (id: string) => ({ url: `/p/${PAIR_SLUG}/og?quote=${id}`, width: 1200, height: 630 });

  it("points og:image and twitter:image at the critic's card", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, SHORT));
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("critic-short"))]);
    expect(meta.twitter?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("critic-short"))]);
  });

  it("titles the link with the quote and the critic, and describes who wrote it about whom and where", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, SHORT));
    expect(meta.title).toBe("\u201cThe odd couple, in every sense.\u201d \u2014 Pat Critic");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.twitter?.title).toBe(meta.title);
    expect(meta.description).toBe("Pat Critic on Lemmon & Matthau \u00b7 Example Review, 1999");
    expect(meta.openGraph?.description).toBe(meta.description);
  });

  it("credits the publication for a piece that is not signed, and cuts a long quote", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, { quote: "critic-unsigned" }));
    const title = String(meta.title);
    expect(title.endsWith("\u2026\u201d \u2014 Kirkus Reviews")).toBe(true);
    expect(meta.description).toBe("Kirkus Reviews on Lemmon & Matthau \u00b7 Kirkus Reviews, 2025");
  });

  it("keeps the plain page as canonical, and the link as the page's own url", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, SHORT));
    expect(meta.openGraph?.url).toBe(`/p/${PAIR_SLUG}?view=clippings&quote=critic-short`);
    expect(meta.alternates?.canonical).toBe(`/p/${PAIR_SLUG}`);
  });

  it("wins over a period in the same link", async () => {
    const meta = await generateMetadata(props(PAIR_SLUG, { ...SHORT, from: "1970", to: "1980" }));
    expect(meta.openGraph?.images).toEqual([expect.objectContaining(QUOTE_IMAGE("critic-short"))]);
  });

  it("does not take an artist's id for a critic's, or the reverse", async () => {
    // Each id is looked up among its own kind only: "short-one" is a clipping, "critic-short" a critic, and neither answers to the other's lookup.
    const clipping = await generateMetadata(props(PAIR_SLUG, { quote: "short-one" }));
    expect(String(clipping.title)).toContain("\u2014 Jack Lemmon");
    const critic = await generateMetadata(props(PAIR_SLUG, { quote: "critic-short" }));
    expect(String(critic.title)).toContain("\u2014 Pat Critic");
    const crossed = await generateMetadata(props(PAIR_SLUG, { quote: "critic-short-one" }));
    expect(crossed.openGraph).not.toHaveProperty("images");
  });

  it.each([
    ["an id the pair does not have", { quote: "critic-nope" }],
    ["an id of another case", { quote: "CRITIC-SHORT" }],
    ["the id without its prefix", { quote: "short" }],
  ])("is the plain page's metadata, with no image of its own, for %s", async (_name, query) => {
    const meta = await generateMetadata(props(PAIR_SLUG, query));
    expect(meta.title).toBe("Jack Lemmon & Walter Matthau: films made together");
    expect(meta.openGraph).not.toHaveProperty("images");
  });
});

describe("the page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userAgentHeader = DESKTOP;
  });

  it("does not redirect from the canonical slug", async () => {
    expect(await redirectsTo(PAIR_SLUG)).toBeNull();
    expect(await redirectsTo(PAIR_SLUG, { from: "1970", to: "1980" })).toBeNull();
  });

  it("redirects a slug that is not canonical to it", async () => {
    expect(await redirectsTo("3151+6837")).toBe(`/p/${PAIR_SLUG}`);
    expect(await redirectsTo("3151-wrong+6837-words")).toBe(`/p/${PAIR_SLUG}`);
  });

  it("carries a period through that redirect, in canonical order", async () => {
    expect(await redirectsTo("3151+6837", { from: "1970", to: "1980" })).toBe(`/p/${PAIR_SLUG}?from=1970&to=1980`);
    // Ends given the wrong way round come out right, so the redirect lands on an address that does not redirect again.
    expect(await redirectsTo("3151+6837", { from: "1980", to: "1970" })).toBe(`/p/${PAIR_SLUG}?from=1970&to=1980`);
  });

  it("drops what is not a year, and leaves out parameters that are not the page's", async () => {
    expect(await redirectsTo("3151+6837", { from: "abc", to: "1980" })).toBe(`/p/${PAIR_SLUG}?to=1980`);
    expect(await redirectsTo("3151+6837", { from: "1700", to: "3000" })).toBe(`/p/${PAIR_SLUG}`);
    expect(await redirectsTo("3151+6837", { from: "1970", to: "1980", utm_source: "newsletter" })).toBe(`/p/${PAIR_SLUG}?from=1970&to=1980`);
  });

  it("takes the first of a repeated parameter", async () => {
    expect(await redirectsTo("3151+6837", { from: ["1970", "1975"], to: "1980" })).toBe(`/p/${PAIR_SLUG}?from=1970&to=1980`);
  });

  it("carries view=depth through that redirect, after the period", async () => {
    expect(await redirectsTo("3151+6837", { view: "depth" })).toBe(`/p/${PAIR_SLUG}?view=depth`);
    expect(await redirectsTo("3151+6837", { view: "depth", from: "1970", to: "1980" })).toBe(
      `/p/${PAIR_SLUG}?from=1970&to=1980&view=depth`,
    );
    expect(await redirectsTo("3151+6837", { view: ["depth", "table"] })).toBe(`/p/${PAIR_SLUG}?view=depth`);
  });

  describe("carries the view and the quote through that redirect", () => {
    it("keeps a link to a quote opening on it", async () => {
      expect(await redirectsTo("3151+6837", { view: "clippings", quote: "short-one" })).toBe(`/p/${PAIR_SLUG}?view=clippings&quote=short-one`);
      expect(await redirectsTo("3151+6837", { quote: "critic-short" })).toBe(`/p/${PAIR_SLUG}?quote=critic-short`);
    });

    it("keeps the view alone, and the table's sort and direction", async () => {
      expect(await redirectsTo("3151+6837", { view: "clippings" })).toBe(`/p/${PAIR_SLUG}?view=clippings`);
      expect(await redirectsTo("3151+6837", { view: "table" })).toBe(`/p/${PAIR_SLUG}?view=table`);
      expect(await redirectsTo("3151+6837", { sort: "rating", dir: "desc" })).toBe(`/p/${PAIR_SLUG}?sort=rating&dir=desc`);
      expect(await redirectsTo("3151-wrong+6837-words", { dir: "asc", sort: "year", view: "timeline" })).toBe(
        `/p/${PAIR_SLUG}?view=timeline&sort=year&dir=asc`,
      );
    });

    it("puts the period first, in canonical order, and the rest in a fixed order", async () => {
      expect(await redirectsTo("3151+6837", { quote: "short-one", view: "clippings", to: "1970", from: "1980" })).toBe(
        `/p/${PAIR_SLUG}?from=1970&to=1980&view=clippings&quote=short-one`,
      );
    });

    it("takes the first of a repeated parameter, and leaves out an empty one", async () => {
      expect(await redirectsTo("3151+6837", { view: ["clippings", "table"], quote: ["short-one", "long-one"] })).toBe(
        `/p/${PAIR_SLUG}?view=clippings&quote=short-one`,
      );
      expect(await redirectsTo("3151+6837", { view: "", quote: "", sort: "" })).toBe(`/p/${PAIR_SLUG}`);
    });

    it("writes an id as a URL does, so that it reads back as the same id", async () => {
      const to = await redirectsTo("3151+6837", { view: "clippings", quote: "a b&c=d" });
      expect(to).toBe(`/p/${PAIR_SLUG}?view=clippings&quote=a+b%26c%3Dd`);
      expect(new URLSearchParams(to!.split("?")[1]).get("quote")).toBe("a b&c=d");
    });
  });

  describe("which view it renders", () => {
    const rendered = async (query: Query) => {
      const element = (await PeoplePage(props(PAIR_SLUG, query))) as { type: unknown; props: Record<string, unknown> };
      return element;
    };

    it("is the Depth view for ?view=depth, with the people's films", async () => {
      const element = await rendered({ view: "depth" });
      expect(element.type).toBe(DepthView);
      expect(element.props).toMatchObject({ today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
      expect(element.props.timelines).toHaveLength(2);
    });

    it("is the Depth view with a period in the link, which the client reads", async () => {
      expect((await rendered({ view: "depth", from: "1970", to: "1980" })).type).toBe(DepthView);
    });

    it.each([
      ["no query", {}],
      ["a period", { from: "1970", to: "1980" }],
      ["the table", { view: "table" }],
      ["the timeline", { view: "timeline" }],
      ["the clippings", { view: "clippings" }],
      ["a link to one quote", { quote: "short-one" }],
      ["a sort", { sort: "rating", dir: "desc" }],
      ["a view it does not know", { view: "grid" }],
    ])("is the usual page for %s on a desktop", async (_name, query) => {
      expect((await rendered(query)).type).toBe(PeopleView);
    });

    describe("on a phone, for a link that names no view", () => {
      it.each([
        ["an iPhone", IPHONE],
        ["an Android phone", ANDROID_PHONE],
      ])("is the Films view (the Depth view) for %s, so that the page never flashes the Timeline first", async (_name, agent) => {
        userAgentHeader = agent;
        const element = await rendered({});
        expect(element.type).toBe(DepthView);
        expect(element.props.timelines).toHaveLength(2);
        expect((await rendered({ from: "1970", to: "1980" })).type).toBe(DepthView);
        // A view the page does not know names none, and neither does a quote it does not have.
        expect((await rendered({ view: "grid" })).type).toBe(DepthView);
        expect((await rendered({ quote: "not-a-quote-of-its" })).type).toBe(DepthView);
      });

      it("lets a view the link names win: the Timeline, the Table, the Quotes, a quote of the pair's own and a sort are the flat page", async () => {
        userAgentHeader = IPHONE;
        for (const query of [{ view: "timeline" }, { view: "table" }, { view: "clippings" }, { quote: "short-one" }, { sort: "rating", dir: "desc" }]) {
          expect((await rendered(query)).type, JSON.stringify(query)).toBe(PeopleView);
        }
        expect((await rendered({ view: "depth" })).type).toBe(DepthView);
      });

      it("takes the first of a repeated view", async () => {
        userAgentHeader = IPHONE;
        expect((await rendered({ view: ["timeline", "depth"] })).type).toBe(PeopleView);
        expect((await rendered({ view: ["depth", "timeline"] })).type).toBe(DepthView);
      });
    });

    describe("on a desktop, a tablet, a bot or with no user agent at all, for a link that names no view", () => {
      it.each([
        ["a desktop", DESKTOP],
        ["an iPad", IPAD],
        ["an Android tablet", ANDROID_TABLET],
        ["Googlebot's smartphone agent, so that a crawler reads the page with the table in its HTML", GOOGLEBOT_SMARTPHONE],
        ["no user agent", null],
      ])("is the Timeline for %s", async (_name, agent) => {
        userAgentHeader = agent;
        expect((await rendered({})).type).toBe(PeopleView);
      });

      it("is still the Films view when the link says so", async () => {
        for (const agent of [DESKTOP, IPAD, GOOGLEBOT_SMARTPHONE, null]) {
          userAgentHeader = agent;
          expect((await rendered({ view: "depth" })).type).toBe(DepthView);
        }
      });
    });

    it("hands the client the pair hero's note, worked out here: the pair's quote, as the stub pair has quotes of its own", async () => {
      const element = await rendered({});
      expect(element.props.heroNote).toMatchObject({ kind: "quote" });
    });
  });
});
