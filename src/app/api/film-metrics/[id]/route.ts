import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { awardsFor } from "@/lib/awards";
import { getMovieMetrics } from "@/lib/tmdb";
import type { FilmMetrics } from "@/lib/types";

const MOVIE_ID = /^[1-9]\d{0,9}$/;

/**
 * The numbers behind a film's hover card: TMDB's rating, budget and revenue plus the curated
 * awards, if any. A lean lookup (no credits) so it stays cheap per hover; TMDB's own response is
 * cached for a day and the shared caches in front of the app keep ours for an hour.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!MOVIE_ID.test(id)) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  const filmId = Number(id);
  try {
    const body: FilmMetrics = { ...(await getMovieMetrics(filmId)), awards: awardsFor(filmId) };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return apiError(error);
  }
}
