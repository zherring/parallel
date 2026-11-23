import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { MODE_SUBJECT_IDS } from "@/lib/bacon-mode";
import { suggestTeamsChecked } from "@/lib/teams";
import { ROUTE_BUDGET_MS } from "@/lib/tmdb";

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 60;

const PERSON_ID = /^[1-9]\d{0,9}$/;
const COMPLETE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";
const PARTIAL_CACHE = "public, s-maxage=60, stale-while-revalidate=60";

/**
 * The teams of a person, for Kevin Bacon mode's "Teams" (see src/lib/bacon-mode.ts): `{ results }`, at most 6 pairs of
 * people with the exact number of films the three share. See src/lib/teams.ts for how they are found. Cached like the
 * frequent collaborators: an hour for a complete list, a minute for one that is missing something.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PERSON_ID.test(id)) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 });
  }
  // A cold list is about 130 TMDB requests: only the people a mode is about (`MODE_SUBJECT_IDS`) are asked for.
  if (!MODE_SUBJECT_IDS.includes(Number(id))) {
    return NextResponse.json({ error: "id must be a person a mode is about" }, { status: 400 });
  }

  try {
    const { teams, complete } = await suggestTeamsChecked(Number(id), AbortSignal.timeout(ROUTE_BUDGET_MS));
    return NextResponse.json(teams, {
      headers: { "Cache-Control": complete ? COMPLETE_CACHE : PARTIAL_CACHE },
    });
  } catch (error) {
    return apiError(error);
  }
}
