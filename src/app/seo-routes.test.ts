import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { metadata } from "@/app/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { canonicalPeoplePath } from "@/lib/canonical-people";
import { buildGenreSections } from "@/lib/example-cards";
import { SITE_URL } from "@/lib/site-url";

describe("SEO entry points", () => {
  it("serves the Search Console verification token as a static root file", () => {
    const file = new URL("../../public/googlecfed69c56c13e595.html", import.meta.url);
    expect(readFileSync(file, "utf8").trim()).toBe("google-site-verification: googlecfed69c56c13e595.html");
  });

  it("gives only the homepage its descriptive title and home canonical", () => {
    expect(metadata.title).toEqual({ absolute: "Parallel — Filmographies & Film Collaborations" });
    expect(metadata.alternates).toEqual({ canonical: "/" });
    expect(metadata.openGraph).toMatchObject({ url: "/", siteName: "Parallel" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("lists exactly the home, curated pairings and their artists, once each", () => {
    const paths = new Set(["/"]);
    for (const { cards } of buildGenreSections()) {
      for (const { people } of cards) {
        paths.add(canonicalPeoplePath(people));
        for (const person of people) paths.add(canonicalPeoplePath([person]));
      }
    }
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toEqual([...paths].map((path) => new URL(path, SITE_URL).toString()));
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.length).toBeGreaterThan(200);
    for (const entry of entries) {
      expect(new URL(entry.url).search).toBe("");
      expect(new URL(entry.url).hash).toBe("");
      expect(entry).not.toHaveProperty("lastModified");
    }
  });

  it("uses the same base URL and exposes the sitemap without blocking embeds or page variants", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
    });
  });
});
