import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { suggestCollaborators } from "@/lib/collaborators";

const PERSON_ID = /^[1-9]\d{0,9}$/;

/**
 * The people this person has worked with most, for the "Frequent collaborators" chips on their
 * page: `{ source, results }`, at most 10, each with the exact number of films the two share
 * (the pair page's "N films together"). See src/lib/collaborators.ts for how they are found.
 * Our own cache headers keep a hot person's list out of the app for an hour.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PERSON_ID.test(id)) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  try {
    return NextResponse.json(await suggestCollaborators(Number(id)), {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return apiError(error);
  }
}
