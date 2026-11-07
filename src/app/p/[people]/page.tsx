import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PeopleView } from "@/components/people-view";
import { cardFilms } from "@/lib/card-films";
import { getPairClippingSet } from "@/lib/clippings";
import { clippingById, parseQuoteId, quoteLinkSearch } from "@/lib/clippings-view";
import { getPairCritics } from "@/lib/critics";
import { criticById } from "@/lib/critics-view";
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

type Props = {
  params: Promise<{ people: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  // wins over a period, since a link names one or the other.
  const ids = timelines.map((t) => t.person.id);
  const quoteId = parseQuoteId(query);
  const clipping = clippingById(getPairClippingSet(ids)?.clippings ?? [], quoteId);
  const criticSet = getPairCritics(ids);
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

export default async function PeoplePage({ params, searchParams }: Props) {
  const { people } = await params;
  const { timelines, canonical, isCanonical } = await loadPeople(people);
  // A link typed with a shorthand slug still opens on its period.
  if (!isCanonical) redirect(`/p/${canonical}${rawPeriodSearch(parsePeriodParams(await searchParams))}`);

  // Computed once, here, and handed to the client: only released films count as shared or connected,
  // and the browser must draw the same timeline the server did, so it never reads the clock itself.
  const opts = { includeMinor: false, today: todayIso() };
  return (
    <PeopleView
      timelines={timelines}
      shared={sharedFilms(timelines, opts)}
      pairwise={sharedFilmsPairwise(timelines, opts)}
      today={opts.today}
      clippings={getPairClippingSet(timelines.map((t) => t.person.id))}
      critics={getPairCritics(timelines.map((t) => t.person.id))}
    />
  );
}
