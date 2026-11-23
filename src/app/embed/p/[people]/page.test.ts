import { describe, expect, it, vi } from "vitest";
import PairEmbedPage, { metadata } from "@/app/embed/p/[people]/page";
import { BACON_PAIR_SLUG, PAIR_SLUG } from "@/lib/test-people";

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

const props = (slug: string, query: Record<string, string> = {}) => ({ params: Promise.resolve({ people: slug }), searchParams: Promise.resolve(query) });
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

  it("hands the pair's treated card, which the first frame draws, and none for one person (the timeline's own card)", async () => {
    const pair = (await PairEmbedPage(props(PAIR_SLUG))) as { props: { treated: { names: string; posters: unknown[] } | null } };
    expect(pair.props.treated?.names).toBe("Jack Lemmon & Walter Matthau");
    expect(pair.props.treated?.posters.length).toBeGreaterThan(0);
    const solo = (await PairEmbedPage(props("3151-jack-lemmon"))) as { props: { treated: unknown } };
    expect(solo.props.treated).toBeNull();
  });

  it("is not in Kevin Bacon mode unless the address names it and he is one of two to four people", async () => {
    const mode = (slug: string, query: Record<string, string>) => PairEmbedPage(props(slug, query)).then((page) => (page as { props: { baconMode: boolean } }).props.baconMode);
    expect(await mode(BACON_PAIR_SLUG, {})).toBe(false);
    expect(await mode(BACON_PAIR_SLUG, { mode: "bacon" })).toBe(true);
    expect(await mode(BACON_PAIR_SLUG, { mode: "other" })).toBe(false);
    // The word means nothing without him, and a person of his own has no films made together to colour.
    expect(await mode(PAIR_SLUG, { mode: "bacon" })).toBe(false);
    expect(await mode("4724-kevin-bacon", { mode: "bacon" })).toBe(false);
  });

  it("keeps the mode through the redirect to the canonical embed", async () => {
    expect((await thrown(() => PairEmbedPage(props("4724+26467", { mode: "bacon" }))))?.message).toBe(`${REDIRECTED}/embed/p/${BACON_PAIR_SLUG}?mode=bacon`);
    expect((await thrown(() => PairEmbedPage(props("4724+26467"))))?.message).toBe(`${REDIRECTED}/embed/p/${BACON_PAIR_SLUG}`);
  });

  it("is not for search engines to index", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
