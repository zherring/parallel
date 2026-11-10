"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { SWITCHER_LABELS, switcherViews, type PageView } from "@/lib/films-view";
import { cn } from "./cn";

/** The tooltip of each view: the word on the segment, and what it is. */
const TITLES: Record<PageView, string> = {
  depth: "Films · the films as a scene in depth",
  timeline: "Timeline · the films along a horizontal timeline",
  table: "Table · the films as a sortable table",
  clippings: "Quotes · what the pair and their critics have said about each other",
};

interface ViewSwitcherProps {
  /** The view the page is on. */
  view: PageView;
  /** Whether the page has quotes (see `hasClippingsTab`): only then is Quotes the fourth segment. */
  quotes?: boolean;
  /** The address of each view's page. */
  hrefFor: (view: PageView) => string;
  /** When given, a plain click on a view that is chosen here returns its handler (see `inPlace`); none leaves the link to navigate. */
  onClickFor?: (view: PageView) => ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  /** The phone's sheet: the segments share the sheet's width, in a row of 28px links, instead of the bar's `--bar-h` box. */
  sheet?: boolean;
  className?: string;
}

/**
 * The page bar's view switcher: Films, Timeline and Table as one small segmented control of text links, in that order, and Quotes as its fourth
 * segment for a page that has quotes (`quotes`); the one the page is on is filled and `aria-current`, the Quotes' segment on the Quotes like any other.
 * "Films" is the Depth view (`?view=depth`: the address and the code still say `depth`, as they say `clippings` for the Quotes). Each is a link with a title.
 * It is on every view, with the same segments, so that the bar's footprint does not change with the view. On a phone the bar has no room for it and the
 * gear's sheet holds the same segments (`sheet`).
 */
export function ViewSwitcher({ view, quotes = false, hrefFor, onClickFor, sheet = false, className }: ViewSwitcherProps) {
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
      {switcherViews(quotes).map((id) => {
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
            {SWITCHER_LABELS[id]}
          </Link>
        );
      })}
    </nav>
  );
}
