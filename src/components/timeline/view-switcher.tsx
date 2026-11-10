"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { FILMS_VIEWS, FILMS_VIEW_LABELS, type FilmsView, type PageView } from "@/lib/films-view";
import { cn } from "./cn";

/** The tooltip of each view: the word on the segment, and what it is. */
const TITLES: Record<FilmsView, string> = {
  depth: "Films · the films as a scene in depth",
  timeline: "Timeline · the films along a horizontal timeline",
  table: "Table · the films as a sortable table",
};

interface ViewSwitcherProps {
  /** The view the page is on; the Quotes are none of the three, and then none is current. */
  view: PageView;
  /** The address of each view's page. */
  hrefFor: (view: FilmsView) => string;
  /** When given, a plain click on a view that is chosen here returns its handler (see `inPlace`); none leaves the link to navigate. */
  onClickFor?: (view: FilmsView) => ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  /** The phone's sheet: the segments share the sheet's width, in a row of 28px links, instead of the bar's `--bar-h` box. */
  sheet?: boolean;
  className?: string;
}

/**
 * The page bar's view switcher: Films, Timeline and Table as one small segmented control of text links, in that order, the current one filled. Each
 * is a link with a title, and the current one is `aria-current`. "Films" is the Depth view (`?view=depth`: the address and the code still say
 * `depth`). It is on every view, the Quotes too, where none is current and choosing one goes to that view, so that the bar's footprint does not
 * change with the view. On a phone the bar has no room for it and the gear's sheet holds the same three (`sheet`).
 */
export function ViewSwitcher({ view, hrefFor, onClickFor, sheet = false, className }: ViewSwitcherProps) {
  return (
    <nav
      aria-label="Views"
      // In the bar it is as tall as the bar's other controls (`--bar-h`, see `PeopleBar`); the box's corner radius is the bar's, the active segment's is that
      // less the padding between them (`--switcher-pad`), so the two are concentric. In the phone's sheet a row of 28px links.
      className={cn(
        "inline-flex shrink-0 items-center",
        sheet ? "w-full gap-0.5 rounded-md p-0.5" : "h-(--bar-h) gap-0.5 rounded-(--bar-radius) p-(--switcher-pad) [--switcher-pad:0.25rem]",
        className,
      )}
    >
      {FILMS_VIEWS.map((id) => {
        const current = id === view;
        return (
          <Link
            key={id}
            href={hrefFor(id)}
            prefetch={false}
            aria-current={current ? "page" : undefined}
            title={TITLES[id]}
            onClick={onClickFor?.(id)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center justify-center text-sm font-medium no-underline transition-colors motion-reduce:transition-none",
              sheet ? "h-7 flex-1 rounded px-2.5" : "h-full rounded-[max(0px,calc(var(--bar-radius)-var(--switcher-pad)))] px-3.5",
              current ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
            )}
          >
            {FILMS_VIEW_LABELS[id]}
          </Link>
        );
      })}
    </nav>
  );
}

interface QuotesLinkProps {
  /** The page is on the Quotes. */
  current: boolean;
  href: string;
  /** A plain click that chooses the Quotes here instead of following the link (see `inPlace`). */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** The phone's sheet: a full-width row instead of the bar's `--bar-h` box. */
  sheet?: boolean;
}

/**
 * "Quotes", a text link beside the view switcher, for a page that has quotes (the caller leaves it out otherwise). It is the bar's one other
 * view, the Quotes, so it is current (`aria-current`) on the Quotes and on no other. The same box as the switcher's: `--bar-h` tall, the bar's
 * radius, a hairline. On a phone the gear's sheet holds it, after the three views.
 */
export function QuotesLink({ current, href, onClick, sheet = false }: QuotesLinkProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={current ? "page" : undefined}
      title="Quotes · what the pair and their critics have said about each other"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center border border-border text-sm font-medium no-underline transition-colors motion-reduce:transition-none",
        sheet ? "h-8 w-full rounded-md px-3" : "h-(--bar-h) rounded-(--bar-radius) px-3.5",
        current ? "bg-border text-strong" : "bg-canvas/90 text-muted hover:bg-surface hover:text-strong",
      )}
    >
      Quotes
    </Link>
  );
}
