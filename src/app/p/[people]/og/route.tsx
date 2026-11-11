import type { NextRequest } from "next/server";
import { cardFilms } from "@/lib/card-films";
import { getPairClippingSet } from "@/lib/clippings";
import { clippingById, parseQuoteId, quoteCardSearch } from "@/lib/clippings-view";
import { getPairCritics } from "@/lib/critics";
import { criticById } from "@/lib/critics-view";
import { renderCriticOgImage, renderQuoteOgImage } from "@/lib/og-quote-render";
import { renderPairOgImage } from "@/lib/og-render";
import { loadPeople } from "@/lib/people";
import { parsePeriodParams, resolvePeriod, searchWithPeriod, spanOfYears } from "@/lib/period";
import { todayIso } from "@/lib/released";

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 20;

/** What a redirect from here may be cached for: it only depends on the URL and on the films, which change slowly. */
const REDIRECT_CACHE_CONTROL = "public, s-maxage=3600";

/** A 307 to a path on this site. The `Location` is relative, so a proxy that rewrites the host cannot cache a redirect to an internal one. */
function redirectTo(path: string): Response {
  return new Response(null, { status: 307, headers: { Location: path, "Cache-Control": REDIRECT_CACHE_CONTROL } });
}

/**
 * The preview card of a /p/ page for a shared period, `/p/<people>/og?from=1978&to=1993`, or for one
 * quote of the Clippings (an artist's or a critic's), `/p/<people>/og?quote=<id>`. The colocated `opengraph-image` cannot do
 * this, it is only handed `params`. The page's metadata points here when the link carries a period
 * or a quote (see `generateMetadata`).
 *
 * The URL is whatever a visitor typed, so a card has exactly one address here, and every other
 * spelling of it redirects (307, with a relative `Location`) to that address instead of being drawn:
 *
 *  - An unknown person or a bad slug is a 404, as on the page.
 *  - The people must be in their canonical slug (`/p/7467-david-fincher+7479-jeff-cronenweth`): a slug
 *    with other text, a missing name, a duplicate id or a different spelling redirects to it, keeping
 *    the period it asked for.
 *  - The period is read as `resolvePeriod` reads it (ends that are not years are dropped, wrong-way-round
 *    ends swapped, ends outside the films' years clamped), and a request with no period left, or one
 *    that covers every year the films span, redirects to `/p/<people>/opengraph-image`, the page's own card.
 *  - A period is then written `?from=YYYY&to=YYYY`, in that order, with nothing else in the query. The
 *    query string is compared with it exactly, so an extra parameter, a different order or an end the
 *    period was clamped to redirects to the canonical query.
 *
 * A quote card follows the same rules, with its own canonical query: `?quote=<id>` and nothing else. The id
 * must be one of the pair's clippings (`clippings.json`) or critics (`essays.json`, ids that start with "critic-"); any
 * other id is no quote, and the request is then read as a period, if it carries one, and otherwise sent to the page's
 * own card. A quote wins over a period
 * in the same query, since a card shows one or the other.
 *
 * Only the canonical address answers 200 with the image, and it never redirects (the target of every
 * redirect is itself canonical). The image carries the same `Cache-Control` as the page's own card.
 *
 * One spelling cannot be told apart here: Next re-serialises the query before the proxy or this
 * handler see it, so an escaped digit (`?from=%31970`) arrives as `?from=1970` and is answered as
 * that. (A query that reaches the handler still escaped is compared as it is, and redirects.) The
 * proxy's per-client limit on this route bounds what such spellings can cost.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ people: string }> }) {
  const { people } = await params;
  // Bad slugs and unknown people end in notFound(), so they answer 404 rather than 500.
  const { timelines, canonical, isCanonical } = await loadPeople(people);
  const base = `/p/${canonical}`;
  // The request's own query string, compared as it is (see above for what Next has already done to it).
  const rawSearch = new URL(request.url).search;

  const ids = timelines.map((t) => t.person.id);
  const quoteId = parseQuoteId(request.nextUrl.searchParams);
  const set = getPairClippingSet(ids);
  const clipping = clippingById(set?.clippings ?? [], quoteId);
  const criticSet = getPairCritics(ids);
  const critic = criticById(criticSet?.critics ?? [], quoteId);
  const quote =
    set && clipping
      ? { id: clipping.id, draw: () => renderQuoteOgImage({ timelines, set, clipping }) }
      : criticSet && critic
        ? { id: critic.id, draw: () => renderCriticOgImage({ timelines, set: criticSet, critic }) }
        : null;
  if (quote) {
    const quoteSearch = quoteCardSearch(quote.id);
    if (!isCanonical || rawSearch !== quoteSearch) return redirectTo(`${base}/og${quoteSearch}`);
    return quote.draw();
  }

  const span = spanOfYears(cardFilms(timelines, todayIso()).films.map((film) => film.year));
  const period = resolvePeriod(parsePeriodParams(request.nextUrl.searchParams), span);
  if (!period) return redirectTo(`${base}/opengraph-image`);

  const canonicalSearch = searchWithPeriod("", period);
  if (!isCanonical || rawSearch !== canonicalSearch) return redirectTo(`${base}/og${canonicalSearch}`);

  return renderPairOgImage({ timelines, period });
}
