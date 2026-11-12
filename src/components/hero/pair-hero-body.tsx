"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { PillPerson } from "@/components/depth/people-pill";
import { PersonPortrait } from "@/components/person-portrait";
import { cn } from "@/components/timeline/cn";
import { PersonBio } from "@/components/timeline/person-bio";
import { splitCitations } from "@/lib/citations";
import { CHIP_LIMIT, fitChipCount, splitLastWord, visibleChips, type HeroChip, type HeroNote } from "@/lib/pair-hero";
import { personColor } from "@/lib/person-colors";
import type { OpenPerson } from "@/lib/side-panel";
import type { PersonSummary } from "@/lib/types";

interface PairHeroBodyProps {
  people: readonly PillPerson[];
  /** The quote, description, blurb or (for one person) biography beside the portraits; none when there is nothing to say (nothing is made up). */
  note: HeroNote | null;
  /** The address of the featured quote in the Quotes view, when the note is that quote. */
  quoteHref: string | null;
  /** A plain click on the quote's link chooses the Quotes in place (see `inPlace`); none leaves the link to navigate. */
  onQuoteClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** The films, one chip each, in release order. */
  chips: readonly HeroChip[];
  /** Whether the chips are the films the people made together (a pair) or a person's own films: it words the group's name. */
  together: boolean;
  /** A chip pressed: the view brings that film into sight, or opens its panel (which hands focus back to the chip itself). */
  onChip: (filmId: number) => void;
  /** A portrait pressed: open the person's details in the slide-out panel. */
  onOpenPerson: OpenPerson;
  className?: string;
}

/**
 * The pair hero's body, under the bar's row: a portrait for each person (a button that opens their details in the slide-out panel, as their name does), beside them the note
 * (the pair's first artist quote that fits whole, set uncut, else a curated description, else the pair's one-line blurb, else, for one person, the start of their biography with a More
 * that opens their panel: see `pickHeroNote`), and a chip for each film. It is the masthead of a page of one person as it is the pair's: the same body with one portrait. On a phone it is
 * a two-column layout too: upright portraits overlap at the left, the note stays entirely at the right, and the film chips sit underneath both.
 *
 * The chips are on one line at every width: as many of the first `CHIP_LIMIT` as fit whole (a chip may give up the end of its title, but keeps ten characters of it: `fitChipCount`), so a phone
 * shows one or two and a desktop three, and "+N more" is every film left out, which it opens inline (and then they wrap). A chip takes the view to its film (see the views' own jump); the
 * hero is expanded when the visitor arrives and collapses as they scroll (see `useHeroCollapse`), at which point the people pill takes the names' place in the bar.
 */
export function PairHeroBody({ people, note, quoteHref, onQuoteClick, chips, together, onChip, onOpenPerson, className }: PairHeroBodyProps) {
  // How many chips were on the line when "+N more" was pressed (null: it has not been): the focus goes to the next one, the first it added.
  const [opened, setOpened] = useState<number | null>(null);
  const expanded = opened !== null;
  // How many chips fit the line, measured in the browser before the first paint it is seen in, and again whenever the line or the chips change size. Until then (the server's markup, and
  // the first render that matches it) the line is laid out by CSS alone: three chips from `sm` up, one on a phone, so that what the measure settles on is nearly always what was already there.
  const [fit, setFit] = useState<number | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const total = chips.length;
  const settled = fit !== null;
  const { shown, hidden } = visibleChips(chips, expanded, fit ?? CHIP_LIMIT);
  // What a phone shows before it is measured: one chip and the rest in "+N more"; with nothing to hide on a desktop (three films or fewer) that chip is still there on the phone.
  const phoneHidden = Math.max(0, total - 1);
  const rulerChips = chips.slice(0, CHIP_LIMIT);
  // The chips the measure is of, as a value that only changes with them (`rulerChips` is a new array on every render).
  const signature = rulerChips.map((chip) => chip.id).join(",");

  // "+N more" is gone once pressed, and the focus with it: it goes to the first chip it added.
  useEffect(() => {
    if (opened !== null) chipsRef.current?.querySelectorAll<HTMLElement>("[data-hero-chip]")[opened]?.focus({ preventScroll: true });
  }, [opened]);

  // Which chips fit the line, from the widths the ruler gives (the film chips and the widest "+N more", set out of sight at their own widths: they do not depend on the chips that are shown).
  // Measured in a layout effect, so that a page that opens in the browser is never painted with the wrong count, and again when the line (a rotated phone, a resized window) or the ruler
  // (the font arriving) changes size. A line that has no width (the hero is not on the screen) is left as it was.
  useLayoutEffect(() => {
    const line = chipsRef.current;
    const ruler = rulerRef.current;
    if (expanded || !line || !ruler) return;
    const widthOf = (element: Element) => element.getBoundingClientRect().width;
    const measure = () => {
      if (line.clientWidth === 0) return;
      const style = getComputedStyle(line);
      const widths = [...ruler.querySelectorAll("[data-ruler-chip]")].map(widthOf);
      const more = ruler.querySelector("[data-ruler-more]");
      const available = line.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setFit(fitChipCount({ widths, moreWidth: more ? widthOf(more) : 0, films: total, available, gap: parseFloat(style.columnGap) || 0 }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(line);
    observer.observe(ruler);
    return () => observer.disconnect();
    // `signature` stands for the chips on the ruler, a new array on every render.
  }, [expanded, total, signature]);

  return (
    <div data-hero-body className={cn("flex min-w-0 flex-col gap-3", className)}>
      {/* Keep every line of the note beside the portrait stack, never wrapping underneath it. */}
      <div className="flex min-w-0 items-center gap-5 max-sm:items-start max-sm:gap-3.5">
        <ul className={cn("m-0 flex shrink-0 -space-x-5 list-none items-start p-1", people.length > 2 ? "max-sm:-space-x-8" : "max-sm:-space-x-4")}>
          {people.map(({ person, slot }) => (
            <li key={person.id} data-hero-portrait={person.id} className="relative inline-flex shrink-0 hover:z-10 focus-within:z-10">
              {/* The portrait opens the person's details, as the name does (and as the people pill's rows and the Quotes' names do). */}
              <PersonBio
                person={person}
                onOpen={onOpenPerson}
                portraitClassName="rounded-(--bar-radius) shadow-[0_6px_14px_-6px_rgb(0_0_0/0.7)]"
                portrait={
                  <PersonPortrait
                    name={person.name}
                    profilePath={person.profilePath}
                    ringColor={personColor(slot)}
                    className="h-28 w-[4.75rem] max-sm:h-20 max-sm:w-14 max-sm:text-lg"
                  />
                }
              />
            </li>
          ))}
        </ul>
        {note && <HeroNoteBlock note={note} quoteHref={quoteHref} onQuoteClick={onQuoteClick} person={people[0]?.person} onOpenPerson={onOpenPerson} />}
      </div>

      {chips.length > 0 && (
        <div
          ref={chipsRef}
          role="group"
          aria-label={together ? "Films made together" : "Films"}
          // One line while "+N more" is closed: the chips that fit whole, and the button (see `fitChipCount`); the last chip gives up the end of its title, with an ellipsis, before a
          // line breaks or scrolls, and the years stay. Once opened, the rest wrap. `relative`: the ruler and the visually hidden words of "+N more" are absolutely positioned, and without
          // a positioned box round them they would widen the page to where they sit, past the last chip.
          className={cn("relative flex items-center gap-2 p-0.5 max-sm:gap-1.5", expanded ? "flex-wrap" : "flex-nowrap overflow-hidden")}
        >
          {shown.map((chip, index) => (
            <button
              key={chip.id}
              type="button"
              data-hero-chip={chip.id}
              title={`${chip.title} (${chip.year})`}
              onClick={() => onChip(chip.id)}
              // Only the last chip on the line gives up the end of its title; before the measure a phone has room for the first alone.
              className={cn(CHIP, !settled && index > 0 && "max-sm:hidden", settled && index < shown.length - 1 && "shrink-0")}
            >
              <span className="truncate">{chip.title}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-muted/80">{chip.year}</span>
            </button>
          ))}
          {!expanded && (settled ? hidden > 0 : total > 1) && (
            <button
              type="button"
              data-hero-more
              aria-expanded={false}
              onClick={() => setOpened(shown.length)}
              // Before the measure: with every film in view on a desktop (three or fewer) it is the phone's alone.
              className={cn(CHIP, "shrink-0", !settled && hidden === 0 && "sm:hidden")}
            >
              {settled ? (
                <>+{hidden}</>
              ) : (
                <>
                  <span className="max-sm:hidden">+{hidden}</span>
                  <span className="sm:hidden">+{phoneHidden}</span>
                </>
              )}{" "}
              more
              <span className="sr-only"> films</span>
            </button>
          )}
          {/* The ruler: the chips that can go on the line, and the "+N more" with the most digits, at the widths they would have to themselves; the measure reads them (see `fitChipCount`).
              Out of sight, and in a box with no size of its own that clips them, so that they add nothing to what the line can scroll. */}
          {!expanded && (
            <div aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
              <div ref={rulerRef} className="flex w-max gap-2">
                {rulerChips.map((chip) => (
                  <span key={chip.id} data-ruler-chip className={CHIP_BOX}>
                    <span className="truncate">{chip.title}</span>
                    <span className="shrink-0 text-[13px] tabular-nums">{chip.year}</span>
                  </span>
                ))}
                {total > 1 && (
                  <span data-ruler-more className={CHIP_BOX}>
                    +{total - 1} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** What a chip is, as the measure reads it: the height, the padding and the type, and no more than 16rem wide, so a long title is cut short of that with an ellipsis. */
const CHIP_BOX =
  "inline-flex h-8 min-w-0 max-w-[16rem] items-center gap-2 rounded-full border border-border px-3.5 text-sm font-medium max-sm:h-11 max-sm:gap-1.5 max-sm:px-3";

/** The chips of the Quotes' filter ("All", "Spielberg on Williams"), unselected: a hairline pill that brightens on hover. */
const CHIP = `${CHIP_BOX} cursor-pointer text-muted transition-colors hover:border-muted hover:text-strong motion-reduce:transition-none`;

function HeroNoteBlock({
  note,
  quoteHref,
  onQuoteClick,
  person,
  onOpenPerson,
}: Pick<PairHeroBodyProps, "quoteHref" | "onQuoteClick" | "onOpenPerson"> & { note: HeroNote; person: PersonSummary | undefined }) {
  if (note.kind === "bio") {
    // The start of the biography, in whole sentences, and a More that opens the person's panel, which has all of it. The button is in the line, after the last word, so that it takes no line of
    // its own: it is an atomic box, a place a line may break before, so the last word and the button are set in a span that does not break, and wrap together if they must.
    const [lead, last] = splitLastWord(note.text);
    return (
      <p data-hero-note="bio" className="m-0 min-w-0 max-w-xl text-sm leading-relaxed text-body">
        {lead}
        {lead && " "}
        <span className="whitespace-nowrap">
          {last}
          {person && (
            <>
              {" "}
              <PersonBio person={person} onOpen={onOpenPerson} moreTrigger />
            </>
          )}
        </span>
      </p>
    );
  }
  if (note.kind === "quote") {
    return (
      <figure data-hero-note="quote" className="m-0 min-w-0 max-w-xl">
        <blockquote className="m-0 text-[0.9375rem] italic leading-snug text-quote">
          &ldquo;{note.quote}&rdquo;
        </blockquote>
        <figcaption className="mt-1.5 text-[13px] leading-snug text-muted">
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
      <p data-hero-note="description" className="m-0 min-w-0 max-w-xl text-sm leading-relaxed text-body">
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
    <p data-hero-note="blurb" className="m-0 min-w-0 max-w-xl text-sm leading-relaxed text-body">
      {note.text}
    </p>
  );
}
