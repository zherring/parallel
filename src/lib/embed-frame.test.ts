// Next's own matcher, the one it applies a `headers()` source with; it ships without types.
// @ts-expect-error TS7016
import { match } from "next/dist/compiled/path-to-regexp";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { EMBED_CSP, EMBED_FRAME_ANCESTORS, embedHeaders, isEmbedPath } from "@/lib/embed-frame";

/** The rules of `next.config.ts` that answer for `path`, as Next applies them (later rules win a header they share). */
async function headersFor(path: string): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const sent: Record<string, string> = {};
  for (const rule of rules) {
    if (!match(rule.source)(path)) continue;
    for (const { key, value } of rule.headers) sent[key.toLowerCase()] = value;
  }
  return sent;
}

describe("the CSP that lets X frame an embed", () => {
  it("names the page itself and X under both of its names, and nothing else", () => {
    expect(EMBED_CSP).toBe("frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com");
    expect(EMBED_FRAME_ANCESTORS).not.toContain("*");
  });

  it("is what next.config.ts sends on a quote's embed", async () => {
    expect(await headersFor("/embed/q/488-steven-spielberg+491-john-williams/john-is-much-more-of-a")).toEqual({
      "content-security-policy": EMBED_CSP,
    });
  });

  it("is what next.config.ts sends on a pair's embed", async () => {
    expect(await headersFor("/embed/p/488-steven-spielberg+491-john-williams")).toEqual({ "content-security-policy": EMBED_CSP });
  });

  it("is never joined by an X-Frame-Options header, which would stop the frame whatever the CSP says", async () => {
    const rules = embedHeaders();
    expect(rules).toHaveLength(1);
    expect(rules[0].headers.map((header) => header.key.toLowerCase())).not.toContain("x-frame-options");
    for (const path of ["/embed/q/a/b", "/embed/p/a+b", "/embed", "/embed/anything/else"]) {
      expect(await headersFor(path)).not.toHaveProperty("x-frame-options");
    }
  });
});

describe("what else is framed: nothing", () => {
  it.each([
    "/",
    "/p/488-steven-spielberg+491-john-williams",
    "/p/488-steven-spielberg+491-john-williams/q/john-is-much-more-of-a",
    "/p/488-steven-spielberg+491-john-williams/og",
    "/api/search",
    "/embedded",
    "/x/embed/q/a/b",
  ])("%s sends no framing header (it keeps what it sends today: none)", async (path) => {
    expect(await headersFor(path)).toEqual({});
  });
});

describe("isEmbedPath", () => {
  it("is true for the prefix and everything under it", () => {
    expect(isEmbedPath("/embed")).toBe(true);
    expect(isEmbedPath("/embed/q/a/b")).toBe(true);
    expect(isEmbedPath("/embed/p/1-a+2-b")).toBe(true);
  });

  it("is false for anything else, a path that only starts with the same letters included", () => {
    for (const path of ["/", "/p/1-a+2-b", "/p/1-a+2-b/q/x", "/embedded", "/api/embed", "", null, undefined]) {
      expect(isEmbedPath(path)).toBe(false);
    }
  });
});
