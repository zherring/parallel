import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DepthView } from "@/components/depth/depth-view";
import { PeopleView } from "@/components/people-view";
import { cardFilms } from "@/lib/card-films";
import { isDepthView, redirectSearch } from "@/lib/depth-url";
import { loadPeople } from "@/lib/people";
import { parsePeriodParams, resolvePeriod, searchWithPeriod, spanOfYears } from "@/lib/period";
import { todayIso } from "@/lib/released";
import { peopleDescription, peopleSocial, peopleTitle, periodImagePath, periodTitle } from "@/lib/seo";
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
  const [{ people }, query] = await Promise.all([params, searchParams]);
  const { timelines, canonical, isCanonical } = await loadPeople(people);
  // A link typed with a shorthand slug still opens on its period (and on the Depth view, if it asked for it).
  if (!isCanonical) redirect(`/p/${canonical}${redirectSearch(query)}`);

  // Computed once, here, and handed to the client: only released films count as shared or connected,
  // and the browser must draw the same timeline the server did, so it never reads the clock itself.
  const opts = { includeMinor: false, today: todayIso() };
  const view = {
    timelines,
    shared: sharedFilms(timelines, opts),
    pairwise: sharedFilmsPairwise(timelines, opts),
    today: opts.today,
  };
  // `?view=depth` draws the same people and films as the vertical perspective scene instead of the Timeline and Table.
  return isDepthView(query.view) ? <DepthView {...view} /> : <PeopleView {...view} />;
}
