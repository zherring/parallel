import { beforeEach, describe, expect, it, vi } from "vitest";
import PeoplePage, { generateMetadata } from "@/app/p/[people]/page";
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

// The page hands the people to a client component; it is not what these tests are about.
vi.mock("@/components/people-view", () => ({ PeopleView: function PeopleView() {} }));

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

describe("the page", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("drops what is not a year, and leaves out every other parameter", async () => {
    expect(await redirectsTo("3151+6837", { from: "abc", to: "1980" })).toBe(`/p/${PAIR_SLUG}?to=1980`);
    expect(await redirectsTo("3151+6837", { from: "1700", to: "3000" })).toBe(`/p/${PAIR_SLUG}`);
    expect(await redirectsTo("3151+6837", { from: "1970", to: "1980", view: "table" })).toBe(`/p/${PAIR_SLUG}?from=1970&to=1980`);
  });

  it("takes the first of a repeated parameter", async () => {
    expect(await redirectsTo("3151+6837", { from: ["1970", "1975"], to: "1980" })).toBe(`/p/${PAIR_SLUG}?from=1970&to=1980`);
  });
});
