import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/p/[people]/og/route";
import { OG_CACHE_CONTROL } from "@/lib/og-render";
import { PAIR_SLUG } from "@/lib/test-people";

vi.mock("@/lib/people", async () => {
  const { stubLoadPeople } = await import("@/lib/test-people");
  return { loadPeople: stubLoadPeople };
});

const BASE = "http://localhost:3000";
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
const OG_IMAGE = `/p/${PAIR_SLUG}/opengraph-image`;

const get = (slug: string, query = "") =>
  GET(new NextRequest(`${BASE}/p/${slug}/og${query}`), { params: Promise.resolve({ people: slug }) });

/** Where a response sends the visitor, or null when it does not. */
const redirectOf = (response: Response) => (response.status === 307 ? response.headers.get("location") : null);

describe("the period card route", () => {
  describe("what is not a card", () => {
    it("is a 404 for a slug that is not people, and for a person TMDB does not know", async () => {
      await expect(get("zzz", "?from=1970&to=1980")).rejects.toMatchObject(NOT_FOUND);
      await expect(get("zzz")).rejects.toMatchObject(NOT_FOUND);
      await expect(get("999999-nobody", "?from=1970&to=1980")).rejects.toMatchObject(NOT_FOUND);
      await expect(get(`3151-jack-lemmon+999999`, "?from=1970&to=1980")).rejects.toMatchObject(NOT_FOUND);
    });
  });

  describe("a request with no period to draw goes to the page's own card", () => {
    it.each([
      ["no query", ""],
      ["an empty query", "?"],
      ["ends that are not years", "?from=abc&to=xyz"],
      ["years out of range", "?from=1700&to=3000"],
      ["a period that covers every year of the films", "?from=1966&to=1998"],
      ["a period that covers more than every year", "?from=1900&to=2050"],
      ["a period outside the films' years", "?from=2010&to=2020"],
      ["other parameters only", "?view=table"],
    ])("redirects %s to /opengraph-image", async (_name, query) => {
      const response = await get(PAIR_SLUG, query);
      expect(redirectOf(response)).toBe(OG_IMAGE);
    });
  });

  describe("a period is written one way, and any other spelling of it redirects to that", () => {
    it.each([
      ["the ends the other way round", "?from=1980&to=1970", "?from=1970&to=1980"],
      ["the parameters in the other order", "?to=1980&from=1970", "?from=1970&to=1980"],
      ["an extra parameter", "?from=1970&to=1980&x=1", "?from=1970&to=1980"],
      ["the view the visitor was on", "?view=table&from=1970&to=1980", "?from=1970&to=1980"],
      ["an end that is not a year", "?from=abc&to=1980", "?from=1966&to=1980"],
      ["an open end", "?from=1990", "?from=1990&to=1998"],
      ["an end past the films' years", "?from=1900&to=1980", "?from=1966&to=1980"],
      ["a repeated parameter", "?from=1970&from=1975&to=1980", "?from=1970&to=1980"],
      ["a query that reaches it still escaped", "?from=%31970&to=1980", "?from=1970&to=1980"],
      ["a lone question mark and a period", "?&from=1970&to=1980", "?from=1970&to=1980"],
    ])("redirects %s", async (_name, query, canonical) => {
      const response = await get(PAIR_SLUG, query);
      expect(redirectOf(response)).toBe(`/p/${PAIR_SLUG}/og${canonical}`);
    });

    it("never loops: the target of each of those redirects answers with the card", async () => {
      for (const query of ["?from=1980&to=1970", "?to=1980&from=1970", "?from=1970&to=1980&x=1", "?from=1990", "?from=1900&to=1980"]) {
        const target = redirectOf(await get(PAIR_SLUG, query))!;
        expect(target).toMatch(new RegExp(`^/p/${PAIR_SLUG.replace("+", "\\+")}/og\\?from=\\d{4}&to=\\d{4}$`));
        const second = await GET(new NextRequest(`${BASE}${target}`), { params: Promise.resolve({ people: PAIR_SLUG }) });
        expect(second.status).toBe(200);
      }
    });
  });

  describe("the slug", () => {
    it("redirects a slug that is not the people's own to it, keeping the period it asked for", async () => {
      for (const slug of ["3151+6837", "3151-jack+6837-matthau", "3151-wrong-words+6837-walter-matthau", "3151-jack-lemmon+6837-walter-matthau+3151"]) {
        const response = await get(slug, "?from=1970&to=1980");
        expect(redirectOf(response)).toBe(`/p/${PAIR_SLUG}/og?from=1970&to=1980`);
      }
    });

    it("sends a non-canonical slug with no period to the canonical page's card", async () => {
      expect(redirectOf(await get("3151+6837"))).toBe(OG_IMAGE);
      expect(redirectOf(await get("3151+6837", "?from=abc"))).toBe(OG_IMAGE);
    });

    it("canonicalises a slug and a query in one hop", async () => {
      expect(redirectOf(await get("3151+6837", "?to=1980&from=1970&x=1"))).toBe(`/p/${PAIR_SLUG}/og?from=1970&to=1980`);
    });

    it("takes the escaped plus sign of a link as the same slug", async () => {
      const response = await GET(new NextRequest(`${BASE}/p/3151-jack-lemmon%2B6837-walter-matthau/og?from=1970&to=1980`), {
        params: Promise.resolve({ people: "3151-jack-lemmon%2B6837-walter-matthau" }),
      });
      expect(response.status).toBe(200);
    });
  });

  describe("a redirect", () => {
    it("has a relative Location, so a proxy that rewrites the host cannot cache a redirect to another", async () => {
      for (const [slug, query] of [[PAIR_SLUG, ""], [PAIR_SLUG, "?to=1980&from=1970"], ["3151+6837", "?from=1970&to=1980"]]) {
        const response = await get(slug, query);
        const location = response.headers.get("location")!;
        expect(location.startsWith("/p/")).toBe(true);
        expect(location).not.toMatch(/^[a-z]+:/i);
        expect(location).not.toContain("localhost");
      }
    });

    it("is a 307 that shared caches may keep for an hour, with no body", async () => {
      const response = await get(PAIR_SLUG, "?to=1980&from=1970");
      expect(response.status).toBe(307);
      expect(response.headers.get("cache-control")).toBe("public, s-maxage=3600");
      expect(await response.text()).toBe("");
    });
  });

  describe("the canonical address", () => {
    it("does not redirect: it answers 200 with a PNG", async () => {
      const response = await get(PAIR_SLUG, "?from=1970&to=1980");
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("content-type")).toBe("image/png");
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });

    it("carries the same Cache-Control as the page's own card", async () => {
      const response = await get(PAIR_SLUG, "?from=1970&to=1980");
      expect(response.headers.get("cache-control")).toBe(OG_CACHE_CONTROL);
    });

    it("is the address a clamped period is written at", async () => {
      const response = await get(PAIR_SLUG, "?from=1966&to=1980");
      expect(response.status).toBe(200);
    });
  });
});
