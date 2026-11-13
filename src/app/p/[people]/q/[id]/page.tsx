import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QuoteEmbed } from "@/components/embed/quote-embed";
import { criticAbout } from "@/lib/critics-view";
import { loadPeople } from "@/lib/people";
import { PLAYER_SIZE, embedPath, findQuoteIndex, quoteInPairPath, quotePath } from "@/lib/quote-embed";
import { pairQuotes } from "@/lib/quote-embed-data";
import { embedQuoteText, peopleSocial, quoteImagePath } from "@/lib/seo";

// Seconds this function may run; why this value: see REQUEST_DEADLINE_MS in src/lib/tmdb.ts.
export const maxDuration = 20;

type Props = { params: Promise<{ people: string; id: string }> };

/**
 * The share URL of one quote, `/p/<people>/q/<id>`: what a post on X links to, and the page a visitor who follows the link
 * lands on. Its tags make X draw the quote in the post itself, as a player (`twitter:card=player`, the player being the
 * embed at `/embed/q/<people>/<id>`) with the quote's card image as the poster, and are the same Open Graph tags as the
 * link to the Clippings tab on the quote has everywhere else. The crawler must be answered with this page at this exact
 * address (200, no redirect), so a spelling of the people other than the canonical one, which the share button never makes,
 * is the only thing that redirects. A quote the pair does not have is a 404.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { people, id } = await params;
  const { timelines, canonical } = await loadPeople(people);
  const quotes = pairQuotes(timelines);
  const index = findQuoteIndex(quotes, id);
  if (index < 0) return {};

  const quote = quotes[index];
  const { title, description } = embedQuoteText(quote);
  const image = { path: quoteImagePath(canonical, quote.id), alt: title };
  return {
    title,
    description,
    // The quote is a view of the pair's page, not another page: search engines are pointed at the whole one.
    alternates: { canonical: `/p/${canonical}` },
    ...peopleSocial(title, description, quotePath(canonical, quote.id), image, { path: embedPath(canonical, quote.id), ...PLAYER_SIZE }),
  };
}

export default async function QuotePage({ params }: Props) {
  const { people, id } = await params;
  const { timelines, canonical, isCanonical } = await loadPeople(people);
  const quotes = pairQuotes(timelines);
  const start = findQuoteIndex(quotes, id);
  if (start < 0) notFound();
  if (!isCanonical) redirect(quotePath(canonical, quotes[start].id));

  const pair = criticAbout(timelines.map((t) => t.person));
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-14">
      <QuoteEmbed slug={canonical} pair={pair} quotes={quotes} start={start} variant="card" />
      <p className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
        <Link href={quoteInPairPath(canonical, quotes[start].id)} className="underline decoration-border underline-offset-4 hover:decoration-strong">
          Every quote on {pair}
        </Link>
        <Link href={`/p/${canonical}`} className="underline decoration-border underline-offset-4 hover:decoration-strong">
          Their films on a timeline
        </Link>
      </p>
    </div>
  );
}
