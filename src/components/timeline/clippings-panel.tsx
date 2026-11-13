"use client";

import { useSearchParams } from "next/navigation";
import { newsreader } from "@/components/newsreader";
import type { VoicedClippings } from "@/lib/clippings";
import { clippingYear, parseQuoteId, speakerIndex } from "@/lib/clippings-view";
import type { PairCritics } from "@/lib/critics";
import { criticName, criticYear, interleaveQuotes } from "@/lib/critics-view";
import { personColor } from "@/lib/person-colors";
import { quoteExhibitPeople } from "@/lib/quote-exhibit";
import type { PersonPanelAccess } from "@/lib/side-panel";
import { MoreReading } from "./more-reading";
import { PullQuote, quoteElementId } from "./pull-quote";
import { QuoteExhibit, QuoteExhibitSlide } from "./quote-exhibit";
import { QuoteExhibitContext } from "./quote-exhibit-context";
import { QuoteExhibitDeck, type ExhibitSlide } from "./quote-exhibit-deck";

interface ClippingsPanelProps {
  pair: VoicedClippings | null;
  critics: PairCritics | null;
  active: boolean;
  personPanel?: PersonPanelAccess;
}

/** One Quotes experience for artists, critics, and pairs with only further reading. */
export function ClippingsPanel({ pair, critics, active, personPanel }: ClippingsPanelProps) {
  const searchParams = useSearchParams();
  const people = quoteExhibitPeople(pair, critics, personPanel?.entries.map((entry) => entry.person) ?? []);
  const reading = critics?.reading ?? [];
  const entries = interleaveQuotes(pair?.clippings ?? [], critics?.critics ?? []);

  const slides: ExhibitSlide[] = entries.map((entry) => {
    const clipping = entry.kind === "clipping" ? entry.clipping : null;
    const item = entry.kind === "clipping" ? entry.clipping : entry.critic;
    const speaker = entry.kind === "clipping" ? entry.clipping.speaker : criticName(entry.critic);
    const side = clipping && people ? speakerIndex(clipping, people) : null;
    const year = entry.kind === "clipping" ? clippingYear(entry.clipping) : criticYear(entry.critic);
    const author = entry.kind === "critic" ? entry.critic.critic?.trim() : null;
    const background = clipping
      ? [clipping.context, clipping.secondhand ? `Secondhand: ${speaker} is reported by someone else here, not quoted in their own words.` : ""].filter(Boolean).join(" ")
      : `From “${item.title.trim()}”, ${author ? `by ${author}` : `published in ${item.publication}`}.`;

    return {
      id: item.id,
      speakerId: side === null || !people ? null : people[side].id,
      quote: item.quote,
      speaker,
      publication: item.publication,
      year,
      content: (
        <PullQuote
          id={item.id}
          quote={item.quote}
          url={item.url}
          linkTitle={item.title}
          speaker={speaker}
          color={side === null || !people ? "var(--text-muted)" : personColor(people[side].slot)}
          film={clipping?.film}
          publication={item.publication}
          year={year}
          via={item.via}
          explainer={<QuoteExhibitContext text={background} people={people ?? []} personPanel={personPanel} />}
        />
      ),
    };
  });

  return (
    <div className={newsreader.variable} data-quotes-page={active ? "true" : undefined}>
      {active && people && slides.length > 0 ? (
        <QuoteExhibitDeck people={people} slides={slides} quoteId={parseQuoteId(searchParams.toString())} reading={reading} />
      ) : active && people ? (
        <div className="quote-exhibit-deck" data-quote-exhibit-deck>
          <QuoteExhibit people={people} speakerId={null}>
            <QuoteExhibitSlide><MoreReading reading={reading} afterQuotes={false} /></QuoteExhibitSlide>
          </QuoteExhibit>
        </div>
      ) : (
        /* Keep the complete source-linked text in server HTML; only the active view mounts imagery and keyboard listeners. */
        <>
          <ol>{slides.map((slide) => <li key={slide.id} id={quoteElementId(slide.id)}>{slide.content}</li>)}</ol>
          {reading.length > 0 && <MoreReading reading={reading} afterQuotes={slides.length > 0} />}
        </>
      )}
    </div>
  );
}
