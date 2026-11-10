import { OG_SIZE } from "@/lib/og-theme";
import { renderPairOgImage } from "@/lib/og-render";
import { loadPeople } from "@/lib/people";

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 20;

export const alt = "Film collaborations on Parallel";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * The card of a /p/ page: the whole career, or all the films they made together. A card for a
 * shared period (`?from=&to=`) is the `/og` route next to this one, because this file is only
 * handed `params`, never the page's search params.
 */
export default async function Image({ params }: { params: Promise<{ people: string }> }) {
  const { people } = await params;
  // Bad slugs and unknown people end in notFound(), so they answer 404 rather than 500.
  const { timelines } = await loadPeople(people);
  return renderPairOgImage({ timelines });
}
