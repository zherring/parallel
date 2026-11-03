import { NextResponse, type NextRequest } from "next/server";
import { cardFilms } from "@/lib/card-films";
import { renderPairOgImage } from "@/lib/og-render";
import { loadPeople } from "@/lib/people";
import { parsePeriodParams, resolvePeriod, searchWithPeriod, spanOfYears } from "@/lib/period";
import { todayIso } from "@/lib/released";

/**
 * The preview card of a /p/ page for a shared period: `/p/<people>/og?from=1978&to=1993`. The
 * colocated `opengraph-image` cannot do this, it is only handed `params`. The page's metadata
 * points here when the link carries a period (see `generateMetadata`).
 *
 * The URL is whatever a visitor typed, so it is made canonical before anything is drawn: ends
 * that are not years are dropped, wrong-way-round ends swapped, ends outside the films' years
 * clamped, and a period that covers everything is no period at all. A URL that is not already
 * written that way (extra parameters, a period that is no period) redirects to the one that is,
 * so a card has one address, one cache entry and one render, however it is asked for. Bad input
 * ends at the page's own card, never at an error.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ people: string }> }) {
  const { people } = await params;
  // Bad slugs and unknown people end in notFound(), so they answer 404 rather than 500.
  const { timelines } = await loadPeople(people);

  const span = spanOfYears(cardFilms(timelines, todayIso()).films.map((film) => film.year));
  const period = resolvePeriod(parsePeriodParams(request.nextUrl.searchParams), span);

  const { pathname, search } = request.nextUrl;
  const canonicalSearch = period ? searchWithPeriod("", period) : "";
  if (search !== canonicalSearch) {
    const target = period ? `${pathname}${canonicalSearch}` : pathname.replace(/\/og\/?$/, "/opengraph-image");
    return NextResponse.redirect(new URL(target, request.nextUrl), {
      status: 307,
      headers: { "Cache-Control": "public, s-maxage=3600" },
    });
  }

  return renderPairOgImage({ timelines, period });
}
