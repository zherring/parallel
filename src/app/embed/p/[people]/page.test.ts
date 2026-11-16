import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PairEmbedPage, { metadata } from "@/app/embed/p/[people]/page";
import { PAIR_SLUG } from "@/lib/test-people";

vi.mock("@/lib/people", async () => {
  const { stubLoadPeople } = await import("@/lib/test-people");
  return { loadPeople: stubLoadPeople };
});

vi.mock("@/components/embed/pair-embed", () => ({ PairEmbed: function PairEmbed() {} }));

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

const props = (slug: string) => ({ params: Promise.resolve({ people: slug }) });
const thrown = (run: () => unknown) => Promise.resolve(run()).then(() => null, (error: Error) => error);

describe("the pair embed page", () => {
  it("is the pair embed of the pair's people, with the card the pair's own preview image is drawn from", async () => {
    const page = (await PairEmbedPage(props(PAIR_SLUG))) as { props: Record<string, unknown> };
    expect(page.props).toMatchObject({ slug: PAIR_SLUG, count: 6 });
    expect((page.props.timelines as { person: { name: string } }[]).map((t) => t.person.name)).toEqual(["Jack Lemmon", "Walter Matthau"]);
    const card = page.props.card as { kind: string; people: { name: string }[]; posters: unknown[]; caption: { segments: { text: string }[] } };
    expect(card.kind).toBe("pair");
    expect(card.people.map((p) => p.name)).toEqual(["Jack Lemmon", "Walter Matthau"]);
    expect(card.posters).toHaveLength(6);
    expect(card.caption.segments.map((s) => s.text).join("")).toBe("6 films over 32 years");
  });

  it("counts one person's films, not the films they share with no one", async () => {
    const page = (await PairEmbedPage(props("3151-jack-lemmon"))) as { props: { count: number; card: { kind: string } } };
    expect(page.props.card.kind).toBe("solo");
    expect(page.props.count).toBe(6);
  });

  it("is a 404 for a person that does not exist, and for a slug that is none", async () => {
    for (const slug of ["999999-nobody+3151-jack-lemmon", "not-a-slug"]) {
      expect((await thrown(() => PairEmbedPage(props(slug))))?.message).toMatch(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    }
  });

  it("sends a spelling of the people that is not the canonical one to the canonical embed", async () => {
    expect((await thrown(() => PairEmbedPage(props("3151+6837"))))?.message).toBe(`${REDIRECTED}/embed/p/${PAIR_SLUG}`);
  });

  describe("the treatment its first frame opens on (`serverPortraitMode`, the gate the share image follows)", () => {
    beforeEach(() => {
      jar.value = undefined;
      jar.reads = 0;
    });
    afterEach(() => vi.unstubAllEnvs());
    const modeOf = async () => ((await PairEmbedPage(props(PAIR_SLUG))) as { props: { serverPortraitMode: unknown } }).props.serverPortraitMode;

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
      jar.value = "color";
      expect(await modeOf()).toBe("color");
      jar.value = "nonsense";
      expect(await modeOf()).toBeNull();
      jar.value = undefined;
      expect(await modeOf()).toBeNull();
    });
  });

  it("is not for search engines to index", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
