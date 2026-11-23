import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/p/[people]/og/route";
import { renderPairOgImage } from "@/lib/og-render";
import { BACON_PAIR_SLUG, PAIR_SLUG } from "@/lib/test-people";

/** The card route for a pair in Kevin Bacon mode (`?mode=bacon`, see `bacon-share.ts`): its canonical addresses, and that it is drawn in the mode. The rest of the route is `route.test.ts`'s. */

vi.mock("@/lib/people", async () => {
  const { stubLoadPeople } = await import("@/lib/test-people");
  return { loadPeople: stubLoadPeople };
});

vi.mock("@/lib/clippings", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/clippings")>()), getPairClippingSet: () => null }));
vi.mock("@/lib/critics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/critics")>()), getPairCritics: () => null }));

// The renderer is the real one (the route answers with its image); the spy is only to see what it was asked for.
vi.mock("@/lib/og-render", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/og-render")>();
  return { ...actual, renderPairOgImage: vi.fn(actual.renderPairOgImage) };
});

const BASE = "http://localhost:3000";
const get = (slug: string, query = "") => GET(new NextRequest(`${BASE}/p/${slug}/og${query}`), { params: Promise.resolve({ people: slug }) });
const redirectOf = (response: Response) => (response.status === 307 ? response.headers.get("location") : null);
const drawnWith = () => vi.mocked(renderPairOgImage).mock.lastCall?.[0];

beforeEach(() => {
  vi.mocked(renderPairOgImage).mockClear();
});

describe("the card route in Kevin Bacon mode", () => {
  it("draws the mode's card at ?mode=bacon, a PNG like the page's own, and asks for the mode", async () => {
    const response = await get(BACON_PAIR_SLUG, "?mode=bacon");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(drawnWith()).toMatchObject({ bacon: true, period: null });
  });

  it("draws a period's card in the mode at ?from=&to=&mode=bacon, with the years before the mode", async () => {
    const response = await get(BACON_PAIR_SLUG, "?from=1970&to=1980&mode=bacon");
    expect(response.status).toBe(200);
    expect(drawnWith()).toMatchObject({ bacon: true, period: { from: 1970, to: 1980 } });
  });

  it("is one address for a card in the mode: any other spelling redirects to it", async () => {
    expect(redirectOf(await get(BACON_PAIR_SLUG, "?mode=bacon&x=1"))).toBe(`/p/${BACON_PAIR_SLUG}/og?mode=bacon`);
    expect(redirectOf(await get(BACON_PAIR_SLUG, "?mode=bacon&from=1970&to=1980"))).toBe(`/p/${BACON_PAIR_SLUG}/og?from=1970&to=1980&mode=bacon`);
    expect(redirectOf(await get(BACON_PAIR_SLUG, "?to=1980&from=1970&mode=bacon&view=table"))).toBe(`/p/${BACON_PAIR_SLUG}/og?from=1970&to=1980&mode=bacon`);
    expect(redirectOf(await get(BACON_PAIR_SLUG, "?from=1990&mode=bacon"))).toBe(`/p/${BACON_PAIR_SLUG}/og?from=1990&to=1998&mode=bacon`);
    expect(drawnWith()).toBeUndefined();
  });

  it("sends a slug that is not the canonical one to the canonical card, with the mode", async () => {
    expect(redirectOf(await get("4724+26467", "?mode=bacon"))).toBe(`/p/${BACON_PAIR_SLUG}/og?mode=bacon`);
  });

  it("is not a card of its own where the mode means nothing: without him, or with him alone, it is the page's own card", async () => {
    expect(redirectOf(await get(PAIR_SLUG, "?mode=bacon"))).toBe(`/p/${PAIR_SLUG}/opengraph-image`);
    expect(redirectOf(await get("4724-kevin-bacon", "?mode=bacon"))).toBe("/p/4724-kevin-bacon/opengraph-image");
    expect(redirectOf(await get(PAIR_SLUG, "?from=1970&to=1980&mode=bacon"))).toBe(`/p/${PAIR_SLUG}/og?from=1970&to=1980`);
  });

  it("still draws the card out of the mode as it was, and a card in the mode only where the address asks", async () => {
    expect(redirectOf(await get(BACON_PAIR_SLUG))).toBe(`/p/${BACON_PAIR_SLUG}/opengraph-image`);
    expect(redirectOf(await get(BACON_PAIR_SLUG, "?mode=other"))).toBe(`/p/${BACON_PAIR_SLUG}/opengraph-image`);
    const response = await get(BACON_PAIR_SLUG, "?from=1970&to=1980");
    expect(response.status).toBe(200);
    expect(drawnWith()).toMatchObject({ bacon: false, period: { from: 1970, to: 1980 } });
  });

  it("never loops: each redirect's target answers with the card", async () => {
    for (const query of ["?mode=bacon&x=1", "?mode=bacon&from=1970&to=1980", "?from=1990&mode=bacon"]) {
      const target = redirectOf(await get(BACON_PAIR_SLUG, query))!;
      const second = await GET(new NextRequest(`${BASE}${target}`), { params: Promise.resolve({ people: BACON_PAIR_SLUG }) });
      expect(second.status).toBe(200);
    }
  });
});
