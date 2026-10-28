import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PeopleView } from "@/components/people-view";
import { loadPeople } from "@/lib/people";
import { todayIso } from "@/lib/released";
import { peopleDescription, peopleSocial, peopleTitle } from "@/lib/seo";
import { sharedFilms, sharedFilmsPairwise } from "@/lib/shared";

type Props = { params: Promise<{ people: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { people } = await params;
  const { timelines, canonical } = await loadPeople(people);

  const title = peopleTitle(timelines.map((t) => t.person.name));
  const shared = sharedFilms(timelines, { includeMinor: false, today: todayIso() });
  const description = peopleDescription(timelines, shared);
  const url = `/p/${canonical}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    ...peopleSocial(title, description, url),
  };
}

export default async function PeoplePage({ params }: Props) {
  const { people } = await params;
  const { timelines, canonical, isCanonical } = await loadPeople(people);
  if (!isCanonical) redirect(`/p/${canonical}`);

  // Computed once, here, and handed to the client: only released films count as shared or connected,
  // and the browser must draw the same timeline the server did, so it never reads the clock itself.
  const opts = { includeMinor: false, today: todayIso() };
  return (
    <PeopleView
      timelines={timelines}
      shared={sharedFilms(timelines, opts)}
      pairwise={sharedFilmsPairwise(timelines, opts)}
      today={opts.today}
    />
  );
}
