import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { getFilmDetails } from "@/lib/tmdb";

const MOVIE_ID = /^[1-9]\d{0,9}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!MOVIE_ID.test(id)) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getFilmDetails(Number(id)));
  } catch (error) {
    return apiError(error);
  }
}
