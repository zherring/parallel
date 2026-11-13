import { afterEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/dev/x-preview/page";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "127.0.0.1:3110" }) }));
vi.mock("@/components/dev/x-preview", () => ({ XPreview: function XPreview() {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const props = (target?: string) => ({ searchParams: Promise.resolve(target === undefined ? {} : { target }) });

describe("the X preview page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is a 404 in production, whatever is asked for, and reads no page", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    await expect(Page(props("/p/488-steven-spielberg+491-john-williams"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(Page(props())).rejects.toThrow("NEXT_NOT_FOUND");
    expect(fetched).not.toHaveBeenCalled();
  });

  it("outside production (the tests run as `test`) reads the target page's own tags from this server and hands them to the preview", async () => {
    const fetched = vi.fn(async () => new Response('<meta name="twitter:card" content="player"/><meta name="twitter:player" content="https://parallel.zachherring.com/embed/p/1+2"/>'));
    vi.stubGlobal("fetch", fetched);
    const element = (await Page(props("488+491"))) as { props: { origin: string; target: string; meta: { player: string } | null; error: string | null } };
    expect(fetched).toHaveBeenCalledWith("http://127.0.0.1:3110/p/488+491", expect.objectContaining({ cache: "no-store" }));
    expect(element.props).toMatchObject({ origin: "http://127.0.0.1:3110", target: "/p/488+491", error: null });
    expect(element.props.meta?.player).toBe("https://parallel.zachherring.com/embed/p/1+2");
  });

  it("fetches nothing for a target that is not a pair or a quote", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    const element = (await Page(props("/api/search?q=a"))) as { props: { meta: unknown; error: string } };
    expect(fetched).not.toHaveBeenCalled();
    expect(element.props.meta).toBeNull();
    expect(element.props.error).toMatch(/not a pair or a quote/);
  });
});
