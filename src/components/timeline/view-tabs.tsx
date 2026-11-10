"use client";

import { Clapperboard, Quote } from "lucide-react";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "./cn";

/** A plain left click, with no modifier key: the one a page may take over. A click that opens the link elsewhere (a new tab, a new window) is the browser's. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The `onClick` of a link to a view the page shows in place (the flat page's views are panels of the page, see `useViewTab`): a plain click
 * chooses the view here instead of following the link. None without `choose`, and the link then navigates.
 */
export function inPlace(choose: (() => void) | undefined): ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined {
  if (!choose) return undefined;
  return (event) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    choose();
  };
}

/** The page's top level: Films (the Timeline, Focus and Table), and the Quotes for a page that has them. */
export type Section = "films" | "clippings";

const ICON = "size-4 shrink-0";
const SECTION_ICONS: Record<Section, ReactNode> = {
  films: <Clapperboard aria-hidden="true" className={ICON} />,
  clippings: <Quote aria-hidden="true" className={ICON} />,
};
/** What a person reads: the Quotes are `clippings` in the address and the code. */
const SECTION_LABELS: Record<Section, string> = { films: "Films", clippings: "Quotes" };
const SECTIONS: readonly Section[] = ["films", "clippings"];

interface SectionLinksProps {
  /** The section the page is on: Films for the Timeline, Focus and Table. */
  section: Section;
  /** Where Films goes: the films view the visitor used last (see `films-view-pref`). */
  filmsHref: string;
  clippingsHref: string;
  /** When given, a plain click chooses the section in place instead of following the link (see `inPlace`). */
  onFilms?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onClippings?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

function linksOf({ filmsHref, clippingsHref, onFilms, onClippings }: SectionLinksProps) {
  const links: Record<Section, { href: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }> = {
    films: { href: filmsHref, onClick: onFilms },
    clippings: { href: clippingsHref, onClick: onClippings },
  };
  return links;
}

/**
 * The page's top-level navigation at the left edge, under the page bar: Films and Quotes, as text on a thin vertical line that drops from the bar's
 * home circle, the current one marked by a short green tick on the line and bright text, the other muted. Only for a page that has Quotes (the caller
 * leaves it out otherwise, and a page without Quotes has no Films-alone version of it), and not on a phone, where the gear's sheet has the same
 * two links (`SectionTabs`). The Films link goes to the films view last used. They are links, not tabs: Films is three views, one of which (Focus) is
 * another page render.
 *
 * It floats over the page (the Depth view's scene too), so it takes no pointer events but on its links: the page under it stays draggable up to the text.
 */
export function SectionNav(props: SectionLinksProps) {
  const links = linksOf(props);
  return (
    <nav aria-label="Sections" className={cn("pointer-events-none flex flex-col border-l border-border", props.className)}>
      {SECTIONS.map((id) => {
        const current = id === props.section;
        return (
          <Link
            key={id}
            href={links[id].href}
            prefetch={false}
            aria-current={current ? "page" : undefined}
            onClick={links[id].onClick}
            // The text has the page's colour round it, so that it reads over a poster or a mote of dust in the Depth view.
            className={cn(
              "pointer-events-auto relative flex h-8 w-fit items-center pl-4 pr-1 text-sm font-medium no-underline [text-shadow:0_0_6px_var(--bg),0_0_2px_var(--bg)] transition-colors motion-reduce:transition-none",
              current ? "text-strong" : "text-muted hover:text-strong",
            )}
          >
            {/* The tick: two pixels of green over the line's one, as tall as a line of text. */}
            {current && <span aria-hidden="true" className="absolute -left-[1.5px] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent-green" />}
            {SECTION_LABELS[id]}
          </Link>
        );
      })}
    </nav>
  );
}

/** One section's link in the phone's sheet: the same box whichever view the page is on. */
function itemClass(current: boolean): string {
  return cn(
    "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded px-3 text-sm font-medium transition-colors motion-reduce:transition-none",
    current ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
  );
}

/**
 * Films | Quotes as a segmented control of two links with their icons, for the phone's gear sheet (there is no room at the left of a phone for
 * the vertical `SectionNav`). Both are always there: the caller leaves it out for a page without Quotes.
 */
export function SectionTabs(props: SectionLinksProps) {
  const links = linksOf(props);
  return (
    <nav aria-label="Sections" className={props.className}>
      {SECTIONS.map((id) => {
        const current = id === props.section;
        return (
          <Link
            key={id}
            href={links[id].href}
            prefetch={false}
            aria-current={current ? "page" : undefined}
            onClick={links[id].onClick}
            className={itemClass(current)}
          >
            <span className={current ? "text-accent-green" : undefined}>{SECTION_ICONS[id]}</span>
            {SECTION_LABELS[id]}
          </Link>
        );
      })}
    </nav>
  );
}
