import { NextResponse } from "next/server";
import { awardsFor } from "@/lib/awards";
import { parseIdList } from "@/lib/film-metrics-batch";
import { TmdbError, getMovieMetrics } from "@/lib/tmdb";
import type { FilmMetrics } from "@/lib/types";

/** Films looked up at TMDB at once: enough to finish 50 in about a second without a burst of 50. */
const CONCURRENCY = 8;

type Outcome = { metrics: FilmMetrics } | { missing: true } | { failed: true; message: string };

async function lookup(id: number): Promise<Outcome> {
  try {
    return { metrics: { ...(await getMovieMetrics(id)), awards: awardsFor(id) } };
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return { missing: true };
    return { failed: true, message: error instanceof Error ? error.message : "Unknown TMDB error" };
  }
}

/** Runs `lookup` for every id, at most `limit` at a time; results keep the order of `ids`. */
async function lookupAll(ids: number[], limit: number): Promise<Outcome[]> {
  const outcomes: Outcome[] = new Array(ids.length);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const index = next++;
      outcomes[index] = await lookup(ids[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, worker));
  return outcomes;
}

/**
 * The numbers behind many films at once, for the "films together" table: the same per-film body
 * as `/api/film-metrics/{id}`, keyed by id, in one request (so one hit on the rate limiter, not
 * one per film). A film TMDB does not know or cannot serve right now is `null` and does not fail
 * the others; only when no film came back and TMDB itself was in trouble is the answer a 502.
 * Shared caches may keep a clean answer for an hour like the single route's; one with a transient
 * failure in it is not cached, so the missing films come back on the next ask.
 */
export async function GET(request: Request) {
  const parsed = parseIdList(new URL(request.url).searchParams.get("ids"));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const outcomes = await lookupAll(parsed.ids, CONCURRENCY);
  const failures = outcomes.flatMap((outcome) => ("failed" in outcome ? [outcome.message] : []));

  // Nothing came back and TMDB (not just "no such film") is why: report it rather than a page of nulls.
  if (failures.length > 0 && !outcomes.some((outcome) => "metrics" in outcome)) {
    console.error(`film-metrics batch: all ${parsed.ids.length} lookups failed (${failures[0]})`);
    return NextResponse.json({ error: "TMDB is unavailable, try again shortly" }, { status: 502 });
  }
  if (failures.length > 0) {
    console.error(`film-metrics batch: ${failures.length} of ${parsed.ids.length} lookups failed (${failures[0]})`);
  }

  const results: Record<string, FilmMetrics | null> = {};
  parsed.ids.forEach((id, index) => {
    const outcome = outcomes[index];
    results[id] = "metrics" in outcome ? outcome.metrics : null;
  });

  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control":
          failures.length === 0 ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store",
      },
    },
  );
}
