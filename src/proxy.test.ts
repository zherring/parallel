import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const request = (ip: string) =>
  new NextRequest("http://localhost/api/search?q=fincher", { headers: { "x-forwarded-for": ip } });

const imageRequest = (ip: string, slug = "564-richard-linklater%2B569-ethan-hawke") =>
  new NextRequest(`http://localhost/p/${slug}/opengraph-image`, { headers: { "x-forwarded-for": ip } });

describe("proxy", () => {
  it("lets 60 requests per minute through and answers the 61st with 429 + Retry-After", () => {
    const statuses = Array.from({ length: 61 }, () => proxy(request("198.51.100.1")).status);

    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses[60]).toBe(429);

    const limited = proxy(request("198.51.100.1"));
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("limits each client separately", () => {
    for (let i = 0; i < 61; i++) proxy(request("198.51.100.2"));
    expect(proxy(request("198.51.100.3")).status).toBe(200);
  });

  describe("preview images", () => {
    it("lets 30 per minute through and answers the 31st with 429 + Retry-After", () => {
      const statuses = Array.from({ length: 31 }, () => proxy(imageRequest("198.51.100.10")).status);

      expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
      expect(statuses[30]).toBe(429);
      expect(Number(proxy(imageRequest("198.51.100.10")).headers.get("retry-after"))).toBeGreaterThan(0);
    });

    it("counts every card against the same budget, whatever the people", () => {
      for (let i = 0; i < 30; i++) proxy(imageRequest("198.51.100.11", `${i + 1}-someone`));
      expect(proxy(imageRequest("198.51.100.11", "999-another")).status).toBe(429);
    });

    it("keeps its budget apart from /api", () => {
      for (let i = 0; i < 31; i++) proxy(imageRequest("198.51.100.12"));
      expect(proxy(request("198.51.100.12")).status).toBe(200);

      for (let i = 0; i < 61; i++) proxy(request("198.51.100.13"));
      expect(proxy(imageRequest("198.51.100.13")).status).toBe(200);
    });

    it("limits each client separately", () => {
      for (let i = 0; i < 31; i++) proxy(imageRequest("198.51.100.14"));
      expect(proxy(imageRequest("198.51.100.15")).status).toBe(200);
    });
  });
});

describe("proxy matcher", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it("covers the API", () => {
    expect(matches("/api/search?q=fincher")).toBe(true);
    expect(matches("/api/movie/550")).toBe(true);
  });

  it("covers the preview image of every /p/ page, with plain or encoded plus signs", () => {
    expect(matches("/p/7467-david-fincher/opengraph-image")).toBe(true);
    expect(matches("/p/564-richard-linklater+569-ethan-hawke/opengraph-image")).toBe(true);
    expect(matches("/p/564-richard-linklater%2B569-ethan-hawke/opengraph-image")).toBe(true);
    expect(matches("/p/564-richard-linklater%2B569-ethan-hawke/opengraph-image?d2a84846e289b634")).toBe(true);
  });

  it("leaves pages, the home image and static files alone", () => {
    expect(matches("/")).toBe(false);
    expect(matches("/opengraph-image")).toBe(false);
    expect(matches("/p/7467-david-fincher")).toBe(false);
    expect(matches("/p/7467-david-fincher/other")).toBe(false);
    expect(matches("/_next/static/chunk.js")).toBe(false);
  });
});
