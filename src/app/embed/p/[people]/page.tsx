import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PairEmbed } from "@/components/embed/pair-embed";
import { isBaconCard } from "@/lib/bacon-share";
import { buildOgCard } from "@/lib/og-card";
import { buildTreatedPair } from "@/lib/og-treated";
import { loadPeople } from "@/lib/people";
import { pairEmbedPath } from "@/lib/player-cards";
import { todayIso } from "@/lib/released";
import { sharedFilms } from "@/lib/shared";

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 20;

// A frame in a post is not a page to find: the pair's own page (`/p/<people>`) is the one that is.
export const metadata: Metadata = { title: "Films made together", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ people: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The page X frames in a post for a link to a pair (`twitter:player` of `/p/<people>`): the pair's preview card, which opens up into their
 * timeline (see `PairEmbed`), with no site header, footer or search (`SiteChrome`). It is sent with the CSP that lets X frame it (`embedHeaders`, from
 * `next.config.ts`), and uses no cookie. An unknown person or a bad slug is a 404, and a spelling of the people other than the canonical one redirects to it,
 * as on the pair page.
 *
 * The card is the one of the pair's `opengraph-image` (`buildOgCard`, with no period, from the same films), so the page opens on the picture X showed.
 *
 * A link to a pair in Kevin Bacon mode frames `?mode=bacon` (see `bacon-share.ts`): the same card and timeline with the films made together orange, as the card the
 * link unfurls into has them, and a small mark in the bar. The mode counts as on the page: only on two to four people, he one of them; a spelling of the people other
 * than the canonical one redirects with it.
 */
export default async function PairEmbedPage({ params, searchParams }: Props) {
  const [{ people }, query] = await Promise.all([params, searchParams]);
  const { timelines, canonical, isCanonical } = await loadPeople(people);
  const bacon = isBaconCard(query, timelines.map((t) => t.person.id));
  if (!isCanonical) redirect(pairEmbedPath(canonical, bacon));

  // Computed once, here, and handed to the client: only released films count as shared or connected, and the browser must draw the same timeline the server did.
  const today = todayIso();
  const multi = timelines.length > 1;
  const shared = multi ? sharedFilms(timelines, { includeMinor: false, today }).length : 0;
  const count = multi ? (shared > 0 ? shared : null) : timelines[0].films.filter((film) => !film.minor).length || null;

  const card = buildOgCard(timelines, today);
  return (
    <PairEmbed
      slug={canonical}
      timelines={timelines}
      today={today}
      card={card}
      count={count}
      treated={buildTreatedPair(card, timelines, today)}
      baconMode={bacon}
    />
  );
}
