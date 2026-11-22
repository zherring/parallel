import "server-only";
import { mapLimited } from "@/lib/map-limited";
import { todayIso } from "@/lib/released";
import { sharedFilms } from "@/lib/shared";
import { getPersonMovieCredits } from "@/lib/tmdb";

/** Filmographies loaded at once (the TMDB client's own limiter holds the wire to six). */
const CONCURRENCY = 6;

/**
 * For each of `ids`, the number of films they share with `subjectId`, counted by the pair page's own code (`sharedFilms`
 * with minor credits off: released films only), so someone a mode lets through never opens an empty pair page. Null for a
 * person whose filmography could not be loaded in time, and for everyone when the subject's could not: "not checked" is
 * never reported as "no films". The subject is not their own co-worker (null).
 *
 * One filmography per person (two TMDB requests each, kept for a day by the fetch cache); the others skip the short-film
 * lookup, as the collaborator suggestions do. `signal` is the caller's time budget.
 */
export async function filmsTogether(
  subjectId: number,
  ids: readonly number[],
  signal?: AbortSignal,
): Promise<Map<number, number | null>> {
  const counts = new Map<number, number | null>(ids.map((id) => [id, null]));
  let subject;
  try {
    subject = await getPersonMovieCredits(subjectId, { signal });
  } catch (error) {
    console.warn(error instanceof Error ? `Worked-with check unavailable: ${error.message}` : "Worked-with check unavailable");
    return counts;
  }

  const today = todayIso();
  const others = ids.filter((id) => id !== subjectId);
  const settled = await mapLimited(others, CONCURRENCY, (id) => getPersonMovieCredits(id, { shorts: false, signal }));
  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    counts.set(others[index], sharedFilms([subject, result.value], { includeMinor: false, today }).length);
  });
  return counts;
}
