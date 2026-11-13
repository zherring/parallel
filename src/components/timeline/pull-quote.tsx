"use client";

import { ExternalLink, Info } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { PersonAvatar } from "@/components/person-avatar";
import { cn } from "./cn";
import { QuoteShareButton } from "./quote-share-button";

/** The headshot beside a quote: in the gutter from md up, in the attribution below that. `w185` serves both sizes. */
const GUTTER_AVATAR = 52;
const INLINE_AVATAR = 36;

/** The column all of a quote's lines share: the measure of a pull quote, not of the page. */
export const COLUMN = "max-w-[44rem]";

/** The `id` of a quote's list item, which the page scrolls to when a link names the quote. */
export const quoteElementId = (id: string) => `quote-${id}`;

/** The round picture beside a quote: a photo with the initials of `name` under it (see `PersonAvatar`). */
export interface PullQuoteAvatar {
  name: string;
  profilePath: string | null;
}

export interface PullQuoteProps {
  /** The quote's stable id: what its share link names. */
  id: string;
  /** Verbatim, set between the marks. */
  quote: string;
  /** Where it was published: the quote's `cite`, and where the source line leads. */
  url: string;
  /** The tooltip of the source link: the headline of the piece. */
  linkTitle: string;
  /** Who is speaking, and who they are speaking of: the line under the quote reads "{speaker} on {about}". */
  speaker: string;
  /** What the line says in place of `speaker` (the name as a link to the biography); `speaker` itself is what a share carries. */
  speakerLabel?: ReactNode;
  about: ReactNode;
  /**
   * A CSS colour for the marks, the dot before the name and the ring of the avatar: a person's colour on the Timeline
   * for an artist, a quiet neutral for anyone else (a critic).
   */
  color: string;
  /** The picture in the gutter (from md up) and ahead of the name below that; none for a speaker who has none. */
  avatar: PullQuoteAvatar | null;
  /** The film the remark is about, when it is about one. */
  film?: string | null;
  /** The source line: the publication as the link, the year after it, and the site a reprint came from. */
  publication: string;
  year: number | null;
  via: string | null;
  /** What the ⓘ unfolds: where and why it was said, or the piece a critic's line comes from. Empty for no ⓘ. */
  background: string;
  /**
   * For a quote that is our translation: the quiet note at the end of the source line ("Translated from Italian"), and the
   * words as the source prints them, its tooltip (the caller puts them in `background` too, for a touch screen).
   */
  translation?: { label: string; original: string } | null;
  highlighted: boolean;
}

/**
 * One pull quote of the Clippings tab, an artist's or a critic's, which differ only in what they are handed: the
 * big serif quote between marks, a round picture in the gutter beside it, the speaker and who it is on in small
 * type under it, the source line (film, publication and year as the link, reprint site), the ⓘ and the share
 * button. The caller says whose colour it is (`color`) and gives the picture (a headshot, or initials).
 */
export function PullQuote({
  id,
  quote,
  url,
  linkTitle,
  speaker,
  speakerLabel,
  about,
  color,
  avatar,
  film,
  publication,
  year,
  via,
  background,
  translation,
  highlighted,
}: PullQuoteProps) {
  const [showContext, setShowContext] = useState(false);
  const contextId = useId();
  // The lines under the name start under it: past the headshot below md (36px and the 12px gap), past the dot from md up.
  const indent = avatar ? "pl-12 md:pl-4" : "pl-4";

  return (
    <div
      className={cn(
        "-mx-3 rounded-2xl px-3 py-9 transition-colors duration-700 sm:-mx-5 sm:px-5 sm:py-12 motion-reduce:transition-none",
        highlighted && "bg-surface",
      )}
    >
      <figure className="relative md:pl-[4.75rem]">
        {/* From md up the speaker's headshot hangs in the gutter, level with the quote's first line; below that it is in the attribution. */}
        {avatar && (
          <span className="absolute left-1 top-1.5 hidden md:block">
            <PersonAvatar
              name={avatar.name}
              profilePath={avatar.profilePath}
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
            "font-serif text-[21px] leading-[1.42] text-quote text-pretty sm:text-[25px] sm:leading-[1.4] md:text-[28px] md:leading-[1.38]",
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
              {avatar && (
                <span className="shrink-0 md:hidden">
                  <PersonAvatar
                    name={avatar.name}
                    profilePath={avatar.profilePath}
                    size={INLINE_AVATAR}
                    imageSize="w185"
                    ringColor={color}
                  />
                </span>
              )}
              <p className="min-w-0 text-[15px] leading-6">
                <span
                  aria-hidden="true"
                  className={cn("mr-2 size-2 rounded-full align-middle", avatar ? "hidden md:inline-block" : "inline-block")}
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium text-strong">{speakerLabel ?? speaker}</span>{" "}
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
                  aria-label={`Context for ${speaker}'s quote`}
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
              <QuoteShareButton item={{ id, quote, speaker }} />
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
              title={linkTitle}
              className="rounded text-strong underline decoration-border underline-offset-4 transition-colors hover:decoration-strong motion-reduce:transition-none"
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
            {translation && (
              <span className="whitespace-nowrap" title={translation.original}>
                <span aria-hidden="true">&middot;</span> {translation.label}
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
