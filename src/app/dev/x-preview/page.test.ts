import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/dev/x-preview/page";

const request = vi.hoisted(() => ({ headers: {} as Record<string, string> }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(request.headers) }));
vi.mock("@/components/dev/x-preview", () => ({ XPreview: function XPreview() {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const props = (target?: string) => ({ searchParams: Promise.resolve(target === undefined ? {} : { target }) });

describe("the X preview page", () => {
  beforeEach(() => {
    request.headers = { host: "127.0.0.1:3110" };
  });
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

  it("reads from this machine whatever the Host header says: a crafted one is never fetched", async () => {
    vi.stubEnv("PORT", "3456");
    const fetched = vi.fn(async () => new Response('<meta name="twitter:card" content="player"/>'));
    vi.stubGlobal("fetch", fetched);
    for (const host of ["evil.example", "evil.example:3000", "127.0.0.1.evil.example", "169.254.169.254", "10.0.0.5:3000"]) {
      request.headers = { host, "x-forwarded-proto": "https" };
      fetched.mockClear();
      const element = (await Page(props("488+491"))) as { props: { origin: string; error: string | null } };
      expect(fetched, host).toHaveBeenCalledTimes(1);
      expect(fetched.mock.calls[0] as unknown[], host).toEqual(["http://127.0.0.1:3456/p/488+491", expect.objectContaining({ cache: "no-store" })]);
      expect(element.props.error, host).toBeNull();
    }
  });

  it("reads from the request's own host when it is a loopback one, on any port", async () => {
    const fetched = vi.fn(async () => new Response("<html></html>"));
    vi.stubGlobal("fetch", fetched);
    for (const [host, origin] of [["localhost:3102", "http://localhost:3102"], ["[::1]:3000", "http://[::1]:3000"], ["127.0.0.1", "http://127.0.0.1"]]) {
      request.headers = { host };
      fetched.mockClear();
      await Page(props("488+491"));
      expect(fetched.mock.calls[0] as unknown[], host).toEqual([`${origin}/p/488+491`, expect.anything()]);
    }
  });

  it("passes the test-mode headers on to the page it reads (and no others), so that it sees the same stub", async () => {
    request.headers = { host: "127.0.0.1:3110", "next-test-proxy-port": "5555", cookie: "secret=1", "x-other": "1" };
    const fetched = vi.fn(async () => new Response("<html></html>"));
    vi.stubGlobal("fetch", fetched);
    await Page(props("488+491"));
    const sent = (fetched.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers;
    expect(sent["next-test-proxy-port"]).toBe("5555");
    expect(Object.keys(sent).sort()).toEqual(["next-test-proxy-port", "user-agent"]);
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
