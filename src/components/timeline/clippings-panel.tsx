"use client";

import { ExternalLink } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import type { Clipping, PairClippings } from "@/lib/clippings";
import {
  clippingsCountMessage,
  filterClippings,
  filterOptions,
  formatClippingDate,
  speakerIndex,
  type ClippingsFilter,
} from "@/lib/clippings-view";
import { cn } from "./cn";

interface ClippingsPanelProps {
  pair: PairClippings;
}

/** The left edge of a card says who spoke: one accent for the first of the pair, another for the second. */
const SIDE_CLASS = ["border-l-accent-green/70", "border-l-accent-orange/70"] as const;

/**
 * The Clippings tab: what one of the pair has said about the other, a card to a quote with its
 * source linked, oldest first, and a small filter for the direction ("All", "A on B", "B on A") when
 * both have something to say. The quotes are hand-curated (`clippings.json`), see `clippings.ts`.
 */
export function ClippingsPanel({ pair }: ClippingsPanelProps) {
  const { people, clippings } = pair;
  const [filter, setFilter] = useState<ClippingsFilter>("all");
  const [changed, setChanged] = useState(false);

  const options = filterOptions(clippings, people);
  const shown = filterClippings(clippings, people, filter);

  return (
    <div>
      {options.length > 0 && (
        <div
          role="group"
          aria-label="Show clippings by speaker"
          className="inline-flex max-w-full flex-wrap rounded-md border border-border bg-canvas p-0.5"
        >
          {options.map((option) => {
            const selected = option.id === filter;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                title={option.title}
                onClick={() => {
                  setFilter(option.id);
                  setChanged(true);
                }}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded px-3 text-sm font-medium transition-colors motion-reduce:transition-none",
                  selected ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {changed ? clippingsCountMessage(shown.length) : ""}
      </p>

      <ul className={cn("space-y-4", options.length > 0 && "mt-4")}>
        {shown.map((clipping) => (
          <li key={`${clipping.url}#${clipping.quote}`}>
            <ClippingCard clipping={clipping} side={speakerIndex(clipping, people)} />
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-muted">Quotes link to their original sources.</p>
    </div>
  );
}

function ClippingCard({ clipping, side }: { clipping: Clipping; side: 0 | 1 | null }) {
  const { speaker, about, quote, film, said_year, publication, title, date, url, context, secondhand } = clipping;

  // The line under the attribution: the film, when it was said, whether it is reported, and the source.
  const meta: ReactNode[] = [];
  if (film) meta.push(<i key="film">{film}</i>);
  if (said_year !== null) meta.push(<span key="said">said in {said_year}</span>);
  if (secondhand) meta.push(<span key="second">secondhand</span>);
  meta.push(
    <a
      key="source"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="inline-flex items-center gap-1 rounded text-accent-blue underline-offset-2 hover:underline"
    >
      {publication}, {formatClippingDate(date)}
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>,
  );

  return (
    <figure
      className={cn(
        "rounded-lg border border-l-4 border-border bg-surface px-4 py-4 sm:px-5",
        side === null ? "border-l-muted/50" : SIDE_CLASS[side],
      )}
    >
      <blockquote cite={url} className="text-base leading-relaxed text-strong sm:text-lg">
        <p>&ldquo;{quote}&rdquo;</p>
      </blockquote>
      <figcaption className="mt-3 text-sm">
        <p className="text-body">
          &mdash; <span className="font-semibold text-strong">{speaker}</span>, on {about}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
          {meta.map((item, index) => (
            <Fragment key={index}>
              {index > 0 && (
                <span aria-hidden="true" className="text-muted">
                  &middot;
                </span>
              )}
              {item}
            </Fragment>
          ))}
        </p>
        <p className="mt-2 text-xs text-muted">{context}</p>
      </figcaption>
    </figure>
  );
}
