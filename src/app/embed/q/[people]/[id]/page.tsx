import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { QuoteEmbed } from "@/components/embed/quote-embed";
import { loadPeople } from "@/lib/people";
import { embedPath, findQuoteIndex } from "@/lib/quote-embed";
import { pairQuotes } from "@/lib/quote-embed-data";
import { criticAbout } from "@/lib/critics-view";

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 20;

// A frame in a post is not a page to find: the share URL (`/p/<people>/q/<id>`) is the one that is.
export const metadata: Metadata = { title: "Quote", robots: { index: false, follow: false } };

type Props = { params: Promise<{ people: string; id: string }> };

/**
 * The page X frames in a post for a link to one quote (`twitter:player` of `/p/<people>/q/<id>`): that quote, large, with the
 * pair's other quotes to step through, and no site header, footer or search (`SiteChrome`). It is sent with the CSP that lets
 * X frame it (`embedHeaders`, from `next.config.ts`), and uses no cookie. A quote the pair does not have is a 404, and a
 * spelling of the people other than the canonical one redirects to it, as on the pair page.
 */
export default async function QuoteEmbedPage({ params }: Props) {
  const { people, id } = await params;
  const { timelines, canonical, isCanonical } = await loadPeople(people);
  const quotes = pairQuotes(timelines);
  const start = findQuoteIndex(quotes, id);
  if (start < 0) notFound();
  if (!isCanonical) redirect(embedPath(canonical, quotes[start].id));

  return (
    <QuoteEmbed
      slug={canonical}
      pair={criticAbout(timelines.map((t) => t.person))}
      quotes={quotes}
      start={start}
      variant="frame"
    />
  );
}
