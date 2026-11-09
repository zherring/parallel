import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getFilmDetails } from "@/lib/tmdb";

// Seconds this function may run. Set explicitly because the platform's default may be shorter than
// the 12s a TMDB request is given (REQUEST_DEADLINE_MS in src/lib/tmdb.ts), which would then never
// fire. Keep it above that with room to render; src/app/max-duration.test.ts checks.
export const maxDuration = 20;

const MOVIE_ID = /^[1-9]\d{0,9}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!MOVIE_ID.test(id)) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getFilmDetails(Number(id)), {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return apiError(error);
  }
}
