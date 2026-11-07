"use client";

import { ExternalLink, Info } from "lucide-react";
import { Newsreader } from "next/font/google";
import { useEffect, useId, useState } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import type { Clipping, ClippingsVoice, VoicedClippings } from "@/lib/clippings";
import {
  clippingById,
  clippingYear,
  clippingsCountMessage,
  filterClippings,
  filterOptions,
  parseQuoteId,
  speakerIndex,
  type ClippingsFilter,
} from "@/lib/clippings-view";
import { personColor } from "@/lib/person-colors";
import { cn } from "./cn";
import { QuoteShareButton } from "./quote-share-button";
import { scrollBehavior } from "./scroll-behavior";

/**
 * The serif of the quotes, and of nothing else. One weight, loaded when the tab is first shown rather
 * than preloaded for every /p/ page (most of them have no Clippings, and the tab is not the default).
 * The card of a quote (`og-quote-render.tsx`) draws the same face from a file of its own.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  display: "swap",
  preload: false,
});

/** How long a quote that a link opened on stays highlighted. */
const HIGHLIGHT_MS = 2800;

/**
 * One voice per colour, and the colour is the one the person has on the Timeline (`personColor`, by their position
 * in the page's own people order, see `clippingVoices`). A quote whose speaker is neither of the pair is muted.
 */
const MUTED = "var(--text-muted)";

/** The headshot beside a quote: in the gutter from md up, in the attribution below that. `w185` serves both sizes. */
const GUTTER_AVATAR = 52;
const INLINE_AVATAR = 36;

/** The column all of a quote's lines share: the measure of a pull quote, not of the page. */
const COLUMN = "max-w-[44rem]";

interface ClippingsPanelProps {
  pair: VoicedClippings;
  /** Whether the Clippings tab is the one showing: the panel is always in the page, hidden when it is not. */
  active: boolean;
}

/**
 * The Clippings tab: what one of the pair has said about the other, set as pull quotes (big serif
 * quote between marks in the speaker's colour, the speaker's round headshot in the gutter beside it, small
 * speaker and source under it, space and a hairline between), oldest first, with a small
 * filter for the direction ("All", "A on B", "B on A") when both have something to say. The quotes
 * are hand-curated (`clippings.json`), see `clippings.ts`.
 *
 * A link to one quote (`?view=clippings&quote=<id>`) opens the tab on it: it is scrolled to the middle
 * of the screen and highlighted for a moment. An id that is not one of the pair's is ignored.
 */
export function ClippingsPanel({ pair, active }: ClippingsPanelProps) {
  const { people, clippings } = pair;
  const [filter, setFilter] = useState<ClippingsFilter>("all");
  const [changed, setChanged] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const colorOf = (side: 0 | 1 | null) => (side === null ? MUTED : personColor(people[side].slot));

  const options = filterOptions(clippings, people);
  const shown = filterClippings(clippings, people, filter);

  // The address bar is read once the tab is showing (the server's HTML and the first client render are the Timeline,
  // see `useViewTab`), so a link that names a quote lands here with the tab already un-hidden and its quote on the page.
  useEffect(() => {
    if (!active) return;
    const target = clippingById(clippings, parseQuoteId(window.location.search));
    if (!target) return;

    const reveal = (behavior: ScrollBehavior) =>
      document.getElementById(quoteElementId(target.id))?.scrollIntoView({ block: "center", behavior });
    reveal(scrollBehavior());
    // Newsreader loads on first use, and the quotes above this one reflow when it arrives: centre it again.
    let cancelled = false;
    document.fonts?.load(`28px ${newsreader.style.fontFamily}`).then(
      () => !cancelled && reveal("auto"),
      () => {},
    );
    // Not a render's own work, but the page's reaction to a link it was opened with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlighted(target.id);
    const timer = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Leaving the tab ends the highlight, so that coming back to it does not find a quote still lit.
      setHighlighted(null);
    };
  }, [active, clippings]);

  return (
    <div className={newsreader.variable}>
      {options.length > 0 && (
        <div role="group" aria-label="Show clippings by speaker" className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = option.id === filter;
            const side = option.id === "first" ? 0 : option.id === "second" ? 1 : null;
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
                  "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors motion-reduce:transition-none",
                  selected
                    ? "border-muted/60 bg-border text-strong"
                    : "border-border text-muted hover:border-muted hover:text-strong",
                )}
              >
                {side !== null && (
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: colorOf(side) }} />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {changed ? clippingsCountMessage(shown.length) : ""}
      </p>

      <ul className={cn("divide-y divide-border/70", options.length > 0 && "mt-3")}>
        {shown.map((clipping) => {
          const side = speakerIndex(clipping, people);
          return (
            <li key={clipping.id} id={quoteElementId(clipping.id)} className="group/quote">
              <ClippingQuote
                clipping={clipping}
                voice={side === null ? null : people[side]}
                color={colorOf(side)}
                highlighted={clipping.id === highlighted}
              />
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-xs text-muted">Quotes link to their original sources.</p>
    </div>
  );
}

/** The `id` of a quote's list item, which the page scrolls to when a link names the quote. */
const quoteElementId = (id: string) => `quote-${id}`;

function ClippingQuote({
  clipping,
  voice,
  color,
  highlighted,
}: {
  clipping: Clipping;
  /** The one of the pair who said it; null when it is neither (no headshot, a muted mark). */
  voice: ClippingsVoice | null;
  /** A CSS colour: the speaker's on the Timeline. */
  color: string;
  highlighted: boolean;
}) {
  const { speaker, about, quote, film, publication, title, url, via, context, secondhand } = clipping;
  const [showContext, setShowContext] = useState(false);
  const contextId = useId();
  const year = clippingYear(clipping);
  // The lines under the name start under it: past the dot, which is where the headshot is not (below md, the headshot leads the caption instead).
  const indent = voice ? "md:pl-4" : "pl-4";

  // Where and why it was said; a quote that is reported rather than spoken says so here too, not as a tag on the quote.
  const background = [
    context,
    secondhand ? `Secondhand: ${speaker} is reported by someone else here, not quoted in their own words.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn(
        "-mx-3 rounded-2xl px-3 py-9 transition-colors duration-700 sm:-mx-5 sm:px-5 sm:py-12 motion-reduce:transition-none",
        highlighted && "bg-surface",
      )}
    >
      <figure className="relative md:pl-[4.75rem]">
        {/* From md up the speaker's headshot hangs in the gutter, level with the quote's first line; below that it is in the attribution. */}
        {voice && (
          <span className="absolute left-1 top-1.5 hidden md:block">
            <PersonAvatar
              name={voice.name}
              profilePath={voice.profilePath}
              size={GUTTER_AVATAR}
              imageSize="w185"
              ringColor={color}
            />
          </span>
        )}
        <blockquote
          cite={url}
          className={cn(
            COLUMN,
            "font-serif text-[21px] leading-[1.42] text-strong text-pretty sm:text-[25px] sm:leading-[1.4] md:text-[28px] md:leading-[1.38]",
          )}
        >
          {/* The marks are the quote's first and last characters, in the speaker's colour, so that none hangs out of the column. */}
          <p>
            <span aria-hidden="true" style={{ color }}>
              &ldquo;
            </span>
            {quote}
            <span aria-hidden="true" style={{ color }}>
              &rdquo;
            </span>
          </p>
        </blockquote>

        <figcaption className={COLUMN}>
          {/* Below md the headshot leads the name (it is in the gutter from md up), the lines under it running the full width. */}
          <div className="mt-5 flex items-center justify-between gap-3 md:items-start">
            <div className="flex min-w-0 items-center gap-3">
              {voice && (
                <span className="shrink-0 md:hidden">
                  <PersonAvatar
                    name={voice.name}
                    profilePath={voice.profilePath}
                    size={INLINE_AVATAR}
                    imageSize="w185"
                    ringColor={color}
                  />
                </span>
              )}
              <p className="min-w-0 text-[15px] leading-6">
                <span
                  aria-hidden="true"
                  className={cn("mr-2 size-2 rounded-full align-middle", voice ? "hidden md:inline-block" : "inline-block")}
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium text-strong">{speaker}</span>{" "}
                <span className="whitespace-nowrap text-muted">on {about}</span>
              </p>
            </div>
            {/* Taller than the line they sit beside (touch targets), so they hang out of the row rather than make it taller. */}
            <div className="-my-1.5 flex shrink-0 items-center">
              {background && (
                <button
                  type="button"
                  aria-expanded={showContext}
                  aria-controls={contextId}
                  aria-label="Context"
                  title="Context"
                  onClick={() => setShowContext((open) => !open)}
                  className={cn(
                    "inline-flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:text-strong motion-reduce:transition-none",
                    showContext ? "text-strong" : "text-muted",
                  )}
                >
                  <Info aria-hidden="true" className="size-4" />
                </button>
              )}
              <QuoteShareButton clipping={clipping} />
            </div>
          </div>
          {/* One line where it fits: the film, the source as the link, and the site a reprint came from; wrapping between them if not (on a phone, the longest). */}
          <p className={cn("mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-6 text-muted", indent)}>
            {film && (
              <>
                <i>{film}</i>
                <span aria-hidden="true">&middot;</span>
              </>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={title}
              className="rounded underline decoration-border underline-offset-4 transition-colors hover:text-accent-blue hover:decoration-accent-blue motion-reduce:transition-none"
            >
              {publication}
              {/* The year and the icon stay with the last word of the name, so that neither starts a line. */}
              <span className="whitespace-nowrap">
                {year !== null && <> &middot; {year}</>}
                <ExternalLink aria-hidden="true" className="ml-1 inline size-3 align-[-0.1em]" />
                <span className="sr-only">(opens in a new tab)</span>
              </span>
            </a>
            {via && (
              <span className="whitespace-nowrap">
                <span aria-hidden="true">&middot;</span> via {via}
              </span>
            )}
          </p>
          {background && (
            <p id={contextId} hidden={!showContext} className={cn("mt-3 text-sm leading-6 text-body", indent)}>
              {background}
            </p>
          )}
        </figcaption>
      </figure>
    </div>
  );
}
