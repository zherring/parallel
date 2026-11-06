import { beforeEach, describe, expect, it, vi } from "vitest";
import PeoplePage, { generateMetadata } from "@/app/p/[people]/page";
import { PAIR_SLUG } from "@/lib/test-people";

vi.mock("@/lib/people", async () => {
  const { stubLoadPeople } = await import("@/lib/test-people");
  return { loadPeople: stubLoadPeople };
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
