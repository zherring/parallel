import type { MetadataRoute } from "next";
import { canonicalPeoplePath } from "@/lib/canonical-people";
import { buildGenreSections } from "@/lib/example-cards";
import { SITE_URL } from "@/lib/site-url";

/** Curated pairings and their artists only; no TMDB requests or combination crawl. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = new Set(["/"]);
  for (const { cards } of buildGenreSections()) {
    for (const { people } of cards) {
      paths.add(canonicalPeoplePath(people));
      for (const person of people) paths.add(canonicalPeoplePath([person]));
    }
  }
  // No artificial lastModified: a deploy is not necessarily a content update.
  return [...paths].map((path) => ({ url: new URL(path, SITE_URL).toString() }));
}
