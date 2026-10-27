import "server-only";
import { notFound } from "next/navigation";
import { buildPeopleSlug, parsePeopleSlug } from "@/lib/slug";
import { TmdbError, getPersonMovieCredits } from "@/lib/tmdb";
import type { PersonTimeline } from "@/lib/types";

/**
 * Loads every person in a /p/ slug, in URL order. Calls notFound() for bad slugs and unknown ids.
 * `isCanonical` is false when the requested slug (percent-decoded) differs from `canonical`.
 */
export async function loadPeople(
  slug: string,
): Promise<{ timelines: PersonTimeline[]; canonical: string; isCanonical: boolean }> {
  const parsed = parsePeopleSlug(slug);
  if (!parsed) notFound();

  try {
    const timelines = await Promise.all(parsed.ids.map(getPersonMovieCredits));
    const canonical = buildPeopleSlug(timelines.map((t) => t.person));
    return { timelines, canonical, isCanonical: decodeURIComponent(slug) === canonical };
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound();
    throw error;
  }
}
