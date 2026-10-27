import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { searchPeople } from "@/lib/tmdb";

const MIN_QUERY = 2;
const MAX_QUERY = 100;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
    return NextResponse.json(
      { error: `q must be ${MIN_QUERY} to ${MAX_QUERY} characters` },
      { status: 400 },
    );
  }

  try {
    const results = await searchPeople(q);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
