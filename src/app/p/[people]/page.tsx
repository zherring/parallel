import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { userAgent } from "next/server";
import { DepthView } from "@/components/depth/depth-view";
import { PeopleView } from "@/components/people-view";
import { cardFilms } from "@/lib/card-films";
import { getPairClippingSet } from "@/lib/clippings";
import { clippingById, parseQuoteId, quoteLinkSearch } from "@/lib/clippings-view";
import { getPairCritics } from "@/lib/critics";
import { criticById } from "@/lib/critics-view";
import { opensDepth } from "@/lib/depth-url";
import { parseView, quoteIdsOf, viewParams } from "@/lib/films-view";
import { getHeroNote } from "@/lib/pair-hero-note";
import { loadPeople } from "@/lib/people";
import { parsePeriodParams, rawPeriodSearch, resolvePeriod, searchWithPeriod, spanOfYears } from "@/lib/period";
import { todayIso } from "@/lib/released";
import {
  criticQuoteDescription,
  criticQuoteTitle,
  peopleDescription,
  peopleSocial,
  peopleTitle,
  periodImagePath,
  periodTitle,
  quoteDescription,
  quoteImagePath,
  quoteTitle,
} from "@/lib/seo";
import { sharedFilms, sharedFilmsPairwise } from "@/lib/shared";

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 20;

type Query = Record<string, string | string[] | undefined>;
type Props = {
  params: Promise<{ people: string }>;
  searchParams: Promise<Query>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ people }, query] = await Promise.all([params, searchParams]);
  const { timelines, canonical } = await loadPeople(people);

  const today = todayIso();
  const baseTitle = peopleTitle(timelines.map((t) => t.person.name));
  const shared = sharedFilms(timelines, { includeMinor: false, today });
  const url = `/p/${canonical}`;

  // A link to one quote of the Clippings (`?view=clippings&quote=<id>`), an artist's or a critic's (whose ids start with
  // "critic-"), gets the quote's card and words. An id the pair does not have is ignored, as it is on the page; a quote
  // wins over a period, since a link names one or the other. The card is promised only where the page opens on the quote:
  // the Clippings, which a valid `quote` opens without `view=clippings` (see `parseView`), but not a link that names
  // another view.
  const ids = timelines.map((t) => t.person.id);
  const clippingSet = getPairClippingSet(ids);
  const criticSet = getPairCritics(ids);
  const opensClippings = parseView(query, quoteIdsOf(clippingSet, criticSet)) === "clippings";
  const quoteId = opensClippings ? parseQuoteId(query) : null;
  const clipping = clippingById(clippingSet?.clippings ?? [], quoteId);
  const critic = criticById(criticSet?.critics ?? [], quoteId);
  const quote = clipping
    ? { id: clipping.id, title: quoteTitle(clipping), description: quoteDescription(clipping) }
    : critic && criticSet
      ? { id: critic.id, title: criticQuoteTitle(critic), description: criticQuoteDescription(critic, criticSet.people) }
      : null;
  if (quote) {
    const image = { path: quoteImagePath(canonical, quote.id), alt: quote.title };
    return {
      title: quote.title,
      description: quote.description,
      // The quote is a view of the page, not another page: search engines are pointed at the whole one.
      alternates: { canonical: url },
      ...peopleSocial(quote.title, quote.description, `${url}${quoteLinkSearch(quote.id)}`, image),
    };
  }

  // A link to a stretch of years (`?from=1978&to=1993`) gets a card and words of its own. The
  // period is resolved against the films the card shows, so it reads the same here and in `/og`.
  const span = spanOfYears(cardFilms(timelines, today).films.map((film) => film.year));
  const period = resolvePeriod(parsePeriodParams(query), span);
  if (!period) {
    const description = peopleDescription(timelines, shared);
    return { title: baseTitle, description, alternates: { canonical: url }, ...peopleSocial(baseTitle, description, url) };
  }

  const title = periodTitle(baseTitle, period);
  const description = peopleDescription(timelines, shared, period);
  const image = { path: periodImagePath(canonical, period), alt: title };
  return {
    title,
    description,
    // The period is a view of the page, not another page: search engines are pointed at the whole one.
    alternates: { canonical: url },
    ...peopleSocial(title, description, `${url}${searchWithPeriod("", period)}`, image),
  };
}

/** The query a redirect to the canonical address keeps: the link's period (in canonical order), then its view, sort and quote as written. Nothing else is the page's. */
function redirectSearch(query: Query): string {
  const params = new URLSearchParams(rawPeriodSearch(parsePeriodParams(query)));
  for (const [name, value] of viewParams(query)) params.set(name, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * Whether the request comes from a phone: the user agent's device type is `mobile`. A tablet is not one (it gets the Timeline), nor is a bot, so that a search
 * engine's crawler, whose smartphone agent says mobile, reads the Timeline's page, which has the table in its HTML. It is the device, not the window:
 * a narrow desktop window is still a desktop and gets the Timeline.
 */
function fromPhone(requestHeaders: Headers): boolean {
  const { device, isBot } = userAgent({ headers: requestHeaders });
  return device.type === "mobile" && !isBot;
}

export default async function PeoplePage({ params, searchParams }: Props) {
  const [{ people }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const { timelines, canonical, isCanonical } = await loadPeople(people);
  // A link typed with a shorthand slug still opens on its period, view (the Depth view too), sort and quote.
  if (!isCanonical) redirect(`/p/${canonical}${redirectSearch(query)}`);

  // Computed once, here, and handed to the client: only released films count as shared or connected,
  // and the browser must draw the same timeline the server did, so it never reads the clock itself.
  const opts = { includeMinor: false, today: todayIso() };
  const shown = {
    timelines,
    shared: sharedFilms(timelines, opts),
    pairwise: sharedFilmsPairwise(timelines, opts),
    today: opts.today,
    clippings: getPairClippingSet(timelines.map((t) => t.person.id)),
    critics: getPairCritics(timelines.map((t) => t.person.id)),
    heroNote: getHeroNote(timelines.map((t) => t.person.id)),
  };
  // `?view=depth` draws the same people and films as the vertical perspective scene (Films) instead of the Timeline, Table and Quotes. A link that names no
  // view opens Films on a phone and the Timeline elsewhere, decided here so that the page never flashes the other; a view the link names always wins.
  return opensDepth(query, quoteIdsOf(shown.clippings, shown.critics), fromPhone(requestHeaders)) ? <DepthView {...shown} /> : <PeopleView {...shown} />;
}
