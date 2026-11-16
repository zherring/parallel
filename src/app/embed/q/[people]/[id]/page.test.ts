import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QuoteEmbedPage, { metadata } from "@/app/embed/q/[people]/[id]/page";
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

vi.mock("@/components/embed/quote-embed", () => ({ QuoteEmbed: function QuoteEmbed() {} }));

const REDIRECTED = "TEST_REDIRECT:";
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: vi.fn((to: string) => {
    throw new Error(`${REDIRECTED}${to}`);
  }),
}));

// `next/headers`: the spike's cookie (`ogPortraitTreatment`), which is read only outside production and only without `PORTRAIT_TREATMENT=1`.
const jar = vi.hoisted(() => ({ value: undefined as string | undefined, reads: 0 }));
vi.mock("next/headers", () => ({
  cookies: async () => {
    jar.reads += 1;
    return { get: (name: string) => (name === "spike-portrait" && jar.value ? { name, value: jar.value } : undefined) };
  },
}));

const props = (slug: string, id: string) => ({ params: Promise.resolve({ people: slug, id }) });
const thrown = (run: () => unknown) => Promise.resolve(run()).then(() => null, (error: Error) => error);

describe("the embed page", () => {
  it("is the frame variant of the quote component, opened on the quote the link names, with every quote of the pair to step through", async () => {
    const page = (await QuoteEmbedPage(props(PAIR_SLUG, "short-one"))) as { props: Record<string, unknown> };
    expect(page.props).toMatchObject({ variant: "frame", slug: PAIR_SLUG, pair: "Lemmon & Matthau", start: 1 });
    expect((page.props.quotes as { id: string }[]).map((q) => q.id)).toEqual(["long-one", "short-one", "critic-short", "critic-unsigned"]);
  });

  it("opens on the critic's quote when the link names it", async () => {
    const page = (await QuoteEmbedPage(props(PAIR_SLUG, "critic-short"))) as { props: { start: number; quotes: { id: string }[] } };
    expect(page.props.quotes[page.props.start].id).toBe("critic-short");
  });

  it("is a 404 for a quote the pair does not have", async () => {
    expect((await thrown(() => QuoteEmbedPage(props(PAIR_SLUG, "nope"))))?.message).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
  });

  it("sends a spelling of the people that is not the canonical one to the canonical embed", async () => {
    expect((await thrown(() => QuoteEmbedPage(props("3151+6837", "short-one"))))?.message).toBe(`${REDIRECTED}/embed/q/${PAIR_SLUG}/short-one`);
  });

  describe("the treatment its frame opens on (`serverPortraitMode`, the gate the quote's share image follows)", () => {
    beforeEach(() => {
      jar.value = undefined;
      jar.reads = 0;
    });
    afterEach(() => vi.unstubAllEnvs());
    const modeOf = async () => ((await QuoteEmbedPage(props(PAIR_SLUG, "short-one"))) as { props: { serverPortraitMode: unknown } }).props.serverPortraitMode;

    it("is the montage when PORTRAIT_TREATMENT=1, without reading the cookie, in production too", async () => {
      vi.stubEnv("PORTRAIT_TREATMENT", "1");
      vi.stubEnv("NODE_ENV", "production");
      expect(await modeOf()).toBe("montage");
      expect(jar.reads).toBe(0);
    });

    it("is none without it, and in production the cookie is not read or heeded", async () => {
      vi.stubEnv("PORTRAIT_TREATMENT", "");
      vi.stubEnv("NODE_ENV", "production");
      jar.value = "color";
      expect(await modeOf()).toBeNull();
      expect(jar.reads).toBe(0);
    });

    it("is the cookie's mode outside production (what /dev/x-preview sets), and none for a cookie that is no mode", async () => {
      vi.stubEnv("PORTRAIT_TREATMENT", "");
      jar.value = "montage";
      expect(await modeOf()).toBe("montage");
      jar.value = undefined;
      expect(await modeOf()).toBeNull();
    });
  });

  it("is not for search engines to index", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
