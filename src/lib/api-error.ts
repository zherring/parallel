import "server-only";
import { NextResponse } from "next/server";
import { TmdbError } from "@/lib/tmdb";

/** Maps a failure from the TMDB client to a JSON response; never forwards upstream details. */
export function apiError(error: unknown): NextResponse {
  if (error instanceof TmdbError && error.status === 404) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  console.error(error instanceof Error ? error.message : "Unknown TMDB error");
  return error instanceof TmdbError
    ? NextResponse.json({ error: "TMDB is unavailable, try again shortly" }, { status: 502 })
    : NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
