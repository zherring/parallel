"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { QuoteShareButton } from "./quote-share-button";

export const quoteElementId = (id: string) => `quote-${id}`;

interface PullQuoteProps {
  id: string;
  quote: string;
  url: string;
  linkTitle: string;
  speaker: string;
  color: string;
  film?: string | null;
  publication: string;
  year: number | null;
  via: string | null;
  explainer: ReactNode;
  /**
   * For a quote that is our translation: the quiet note at the end of the source line ("Translated from Italian"), and the
   * words as the source prints them, its tooltip (the caller puts them in the explainer too, for a touch screen).
   */
  translation?: { label: string; original: string } | null;
}

/** Verbatim words, source-linked prose, and sharing. Portraits belong to the stationary pane. */
export function PullQuote({ id, quote, url, linkTitle, speaker, color, film, publication, year, via, explainer, translation }: PullQuoteProps) {
  return (
    <figure className="relative">
      <div className="quote-exhibit-actions">
        <QuoteShareButton item={{ id, quote, speaker }} />
      </div>
      <blockquote cite={url} className="quote-exhibit-words font-serif text-pretty">
        <p>
          <span aria-hidden="true" style={{ color }}>&ldquo;</span>
          {quote}
          <span aria-hidden="true" style={{ color }}>&rdquo;</span>
        </p>
      </blockquote>
      <figcaption>
        <p className="sr-only">Quote by {speaker}.</p>
        <p className="quote-exhibit-context">{explainer}</p>
        <p className="quote-exhibit-source">
          {film && <><i>{film}</i><span aria-hidden="true">&middot;</span></>}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={linkTitle}
            className="rounded text-strong underline decoration-border underline-offset-4 transition-colors hover:decoration-strong motion-reduce:transition-none"
          >
            {publication}
            <span className="whitespace-nowrap">
              {year !== null && <> &middot; {year}</>}
              <ExternalLink aria-hidden="true" className="ml-1 inline size-3 align-[-0.1em]" />
              <span className="sr-only"> (opens in a new tab)</span>
            </span>
          </a>
          {via && <span className="whitespace-nowrap"><span aria-hidden="true">&middot;</span> via {via}</span>}
          {translation && (
            <span className="whitespace-nowrap" title={translation.original}>
              <span aria-hidden="true">&middot;</span> {translation.label}
              <span className="sr-only"> (original: {translation.original})</span>
            </span>
          )}
        </p>
      </figcaption>
    </figure>
  );
}
