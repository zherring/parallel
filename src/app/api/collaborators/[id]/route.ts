import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { MODE_SUBJECT_IDS } from "@/lib/bacon-mode";
import { suggestCollaboratorsChecked } from "@/lib/collaborators";
import { ROUTE_BUDGET_MS } from "@/lib/tmdb";

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 60;

const PERSON_ID = /^[1-9]\d{0,9}$/;
/** `?fill=`: a whole number of one or two digits (the lib clamps it to the candidates it counts). */
const FILL = /^[1-9]\d?$/;
const COMPLETE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";
const PARTIAL_CACHE = "public, s-maxage=60, stale-while-revalidate=60";

/**
 * The people this person has worked with most, for the "Frequent collaborators" in the Add a person
 * field on their page: `{ source, results }`, at most 10, each with the exact number of films the two share
 * (the pair page's "N films together"). See src/lib/collaborators.ts for how they are found.
 * Our own cache headers keep a hot person's list out of the app for an hour; a list that is missing
 * candidates (some TMDB lookups failed) is kept for a minute only, so shared caches do not hold
 * a gap in it for long.
 *
 * `?fill=N` asks for a list of at least N people: where the graph's row has fewer, it is topped up with live candidates
 * (up to 80 credit requests on a cold cache), which Kevin Bacon mode's empty field wants for him (his row has 3). Only the
 * people a mode is about (`MODE_SUBJECT_IDS`) are topped up; for anyone else, or a `fill` that is not a number, the option is
 * ignored and the answer is the usual one. The address differs with it, so shared caches keep the two answers apart, and the
 * lib keeps them apart in memory.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PERSON_ID.test(id)) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }

  const fill = new URL(request.url).searchParams.get("fill");
  const minCandidates = fill !== null && FILL.test(fill) && MODE_SUBJECT_IDS.includes(Number(id)) ? Number(fill) : undefined;

  try {
    const { suggestions, complete } = await suggestCollaboratorsChecked(Number(id), AbortSignal.timeout(ROUTE_BUDGET_MS), { minCandidates });
    return NextResponse.json(suggestions, {
      headers: { "Cache-Control": complete ? COMPLETE_CACHE : PARTIAL_CACHE },
    });
  } catch (error) {
    return apiError(error);
  }
}
