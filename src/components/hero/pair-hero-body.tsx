"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { PillPerson } from "@/components/depth/people-pill";
import { PersonPortrait } from "@/components/person-portrait";
import { cn } from "@/components/timeline/cn";
import { PersonBio } from "@/components/timeline/person-bio";
import { splitCitations } from "@/lib/citations";
import { truncateQuote } from "@/lib/clippings-view";
import { CHIP_LIMIT, visibleChips, type HeroChip, type HeroNote } from "@/lib/pair-hero";
import { personColor } from "@/lib/person-colors";

/** The longest a quote is set in the hero; the link under it goes to the whole of it. */
const QUOTE_CHARS = 240;

interface PairHeroBodyProps {
  people: readonly PillPerson[];
  /** The quote, description or blurb beside the portraits; none when the pair has nothing to say (nothing is made up). */
  note: HeroNote | null;
  /** The address of the featured quote in the Quotes view, when the note is that quote. */
  quoteHref: string | null;
  /** A plain click on the quote's link chooses the Quotes in place (see `inPlace`); none leaves the link to navigate. */
  onQuoteClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** The films, one chip each, in release order. */
  chips: readonly HeroChip[];
  /** Whether the chips are the films the people made together (a pair) or a person's own films: it words the group's name. */
  together: boolean;
  /** A chip pressed: the view brings that film into sight, or opens its panel (`trigger` is the chip, for the panel to hand focus back to). */
  onChip: (filmId: number, trigger: HTMLElement) => void;
  className?: string;
}

/**
 * The pair hero's body, under the bar's row: a portrait for each person (a button that opens their biography, as their name does), beside them the note
 * (the pair's first quote, else a curated description, else the pair's one-line blurb: see `pickHeroNote`), and a chip for each film. On a phone it stacks
 * (smaller portraits, the note below them, the chips in one row that scrolls sideways).
 *
 * The first `CHIP_LIMIT` chips are shown; "+N more" is the rest, which it opens inline. A chip takes the view to its film (see the views' own jump); the
 * hero is expanded when the visitor arrives and collapses as they scroll (see `useHeroCollapse`), at which point the people pill takes the names' place in the bar.
 */
export function PairHeroBody({ people, note, quoteHref, onQuoteClick, chips, together, onChip, className }: PairHeroBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const { shown, hidden } = visibleChips(chips, expanded);

  // "+N more" is gone once pressed, and the focus with it: it goes to the first chip it added.
  useEffect(() => {
    if (expanded) chipsRef.current?.querySelectorAll<HTMLElement>("[data-hero-chip]")[CHIP_LIMIT]?.focus({ preventScroll: true });
  }, [expanded]);

  return (
    <div data-hero-body className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex min-w-0 items-center gap-5 max-sm:flex-col max-sm:items-start max-sm:gap-3">
        <ul className="m-0 flex list-none items-start gap-3.5 p-1 max-sm:gap-3">
          {people.map(({ person, roles, slot }) => (
            <li key={person.id} data-hero-portrait={person.id} className="inline-flex">
              {/* The portrait opens the biography, as the name does (and as the people pill's rows and the Quotes' names do). */}
              <PersonBio
                person={person}
                roles={roles}
                portraitClassName="rounded-(--bar-radius)"
                portrait={
                  <PersonPortrait
                    name={person.name}
                    profilePath={person.profilePath}
                    ringColor={personColor(slot)}
                    className="h-28 w-[4.75rem] max-sm:h-[4.5rem] max-sm:w-12 max-sm:text-base"
                  />
                }
              />
            </li>
          ))}
        </ul>
        {note && <HeroNoteBlock note={note} quoteHref={quoteHref} onQuoteClick={onQuoteClick} />}
      </div>

      {chips.length > 0 && (
        <div
          ref={chipsRef}
          role="group"
          aria-label={together ? "Films made together" : "Films"}
          // One row that scrolls sideways on a phone; wrapped rows beside it. `relative`: the visually hidden words of "+N more" are absolutely positioned, and without
          // a positioned box round them the scroller does not contain them (they would widen the page to where they sit, past the last chip).
          className="relative flex flex-wrap items-center gap-2 p-0.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none]"
        >
          {shown.map((chip) => (
            <button
              key={chip.id}
              type="button"
              data-hero-chip={chip.id}
              title={`${chip.title} (${chip.year})`}
              onClick={(event) => onChip(chip.id, event.currentTarget)}
              className={CHIP}
            >
              <span className="truncate">{chip.title}</span>
              <span className="text-xs tabular-nums text-muted/80">{chip.year}</span>
            </button>
          ))}
          {hidden > 0 && (
            <button type="button" data-hero-more aria-expanded={false} onClick={() => setExpanded(true)} className={CHIP}>
              +{hidden} more
              <span className="sr-only"> films</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The chips of the Quotes' filter ("All", "Spielberg on Williams"), unselected: a hairline pill that brightens on hover. */
const CHIP =
  "inline-flex h-8 max-w-[16rem] shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border px-3.5 text-sm font-medium text-muted transition-colors hover:border-muted hover:text-strong motion-reduce:transition-none";

function HeroNoteBlock({ note, quoteHref, onQuoteClick }: Pick<PairHeroBodyProps, "quoteHref" | "onQuoteClick"> & { note: HeroNote }) {
  if (note.kind === "quote") {
    return (
      <figure data-hero-note="quote" className="m-0 min-w-0 max-w-xl">
        <blockquote className="m-0 text-[0.9375rem] italic leading-snug text-quote max-sm:text-sm">
          &ldquo;{truncateQuote(note.quote, QUOTE_CHARS)}&rdquo;
        </blockquote>
        <figcaption className="mt-1.5 text-xs text-muted">
          {quoteHref ? (
            <Link
              href={quoteHref}
              prefetch={false}
              onClick={onQuoteClick}
              title="Read it in the Quotes"
              className="rounded text-muted underline-offset-2 hover:text-strong hover:underline"
            >
              {note.speaker} on {note.about}
            </Link>
          ) : (
            <>
              {note.speaker} on {note.about}
            </>
          )}
        </figcaption>
      </figure>
    );
  }
  if (note.kind === "description") {
    return (
      <p data-hero-note="description" className="m-0 min-w-0 max-w-xl text-sm leading-snug text-body">
        {splitCitations(note.text, note.sources.length).map((part, index) => {
          if (part.kind === "text") return part.text;
          const source = note.sources[part.n - 1];
          return (
            // A footnote, as Wikipedia sets them: the number in brackets, raised and small, a link to the page the sentence rests on.
            <sup key={index} className="ml-px text-[0.7em] leading-none">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                data-hero-citation={part.n}
                aria-label={`Source ${part.n}: ${source.title}`}
                title={source.title}
                className="rounded-sm text-muted no-underline hover:text-strong hover:underline focus-visible:text-strong"
              >
                [{part.n}]
              </a>
            </sup>
          );
        })}
      </p>
    );
  }
  return (
    <p data-hero-note="blurb" className="m-0 min-w-0 max-w-xl text-sm leading-snug text-body">
      {note.text}
    </p>
  );
}
