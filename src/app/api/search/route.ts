import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { loadPeopleMatchIndex } from "@/lib/people-index";
import { searchIndex, type PersonMatch } from "@/lib/people-match";
import { mergeSearchResults, MAX_SEARCH_RESULTS } from "@/lib/search-merge";
import { TmdbError, searchPeopleWithPopularity } from "@/lib/tmdb";

const MIN_QUERY = 2;
const MAX_QUERY = 100;
/** TMDB's person search only adds names the local index lacks; it never holds the answer up. */
const TMDB_TIMEOUT_MS = 1500;

/** The local matcher. An index that cannot be loaded counts as "found nothing". */
async function searchLocal(q: string): Promise<PersonMatch[]> {
  try {
    return searchIndex(await loadPeopleMatchIndex(), q, MAX_SEARCH_RESULTS);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "People index failed to load");
    return [];
  }
}

/** TMDB's own search, given up on after TMDB_TIMEOUT_MS (rejects with a 504 TmdbError). */
function searchTmdb(q: string) {
  const signal = AbortSignal.timeout(TMDB_TIMEOUT_MS);
  const timedOut = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => reject(new TmdbError(504, "TMDB search timed out")), {
      once: true,
    });
  });
  return Promise.race([searchPeopleWithPopularity(q, signal), timedOut]);
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
    return NextResponse.json(
      { error: `q must be ${MIN_QUERY} to ${MAX_QUERY} characters` },
      { status: 400 },
    );
  }

  // Both start at once: the local matcher answers in milliseconds, TMDB in a few hundred.
  const [local, tmdb] = await Promise.all([
    searchLocal(q),
    searchTmdb(q).then(
      (hits) => ({ hits }),
      (error: unknown) => ({ error }),
    ),
  ]);

  if ("error" in tmdb && local.length === 0) return apiError(tmdb.error);
  if ("error" in tmdb) {
    console.warn(
      tmdb.error instanceof TmdbError ? `TMDB search unavailable (${tmdb.error.status})` : "TMDB search failed",
    );
  }

  const results = mergeSearchResults(q, local, "hits" in tmdb ? tmdb.hits : []);
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
