import { describe, expect, it, vi } from "vitest";
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

  it("is not for search engines to index", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
