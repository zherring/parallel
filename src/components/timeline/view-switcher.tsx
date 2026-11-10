"use client";

import { ChartNoAxesGantt, Layers, Table2 } from "lucide-react";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { FILMS_VIEWS, FILMS_VIEW_LABELS, type FilmsView, type PageView } from "@/lib/films-view";
import { cn } from "./cn";

interface Option {
  /** What a screen reader names the link. It contains the word that is shown beside the icon in the phone's sheet. */
  ariaLabel: string;
  /** The tooltip: the view and what it is. */
  title: string;
  icon: ReactNode;
}

const ICON = "size-4 shrink-0";
const OPTIONS: Record<FilmsView, Option> = {
  timeline: {
    ariaLabel: "Timeline view",
    title: "Timeline · the films along a horizontal timeline",
    icon: <ChartNoAxesGantt aria-hidden="true" className={ICON} />,
  },
  depth: {
    ariaLabel: "Focus view",
    title: "Focus · the films as a scene in depth",
    icon: <Layers aria-hidden="true" className={ICON} />,
  },
  table: {
    ariaLabel: "Table view",
    title: "Table · the films as a sortable table",
    icon: <Table2 aria-hidden="true" className={ICON} />,
  },
};

interface ViewSwitcherProps {
  /** The view the page is on; the Clippings are none of the three, and then none is current. */
  view: PageView;
  /** The address of each view's page. */
  hrefFor: (view: FilmsView) => string;
  /** When given, a plain click on a view that is chosen here returns its handler (see `inPlace`); none leaves the link to navigate. */
  onClickFor?: (view: FilmsView) => ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined;
  /** Words beside the icons, for where there is room (the phone's sheet). */
  labelled?: boolean;
  className?: string;
}

/**
 * The page bar's view switcher: Timeline, Focus and Table as one small segmented control of icon links. Each is a link with a title and an
 * aria-label, and the current one is `aria-current`. It is on every view, the Clippings too, where none is current and choosing one goes to
 * that view, so that the bar's footprint does not change with the view. On a phone the bar has no room for it and the gear's sheet holds the
 * same three, with their words (`labelled`).
 */
export function ViewSwitcher({ view, hrefFor, onClickFor, labelled = false, className }: ViewSwitcherProps) {
  return (
    <nav aria-label="Films view" className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-md p-0.5", className)}>
      {FILMS_VIEWS.map((id) => {
        const option = OPTIONS[id];
        const current = id === view;
        return (
          <Link
            key={id}
            href={hrefFor(id)}
            prefetch={false}
            aria-label={option.ariaLabel}
            aria-current={current ? "page" : undefined}
            title={option.title}
            onClick={onClickFor?.(id)}
            className={cn(
              "inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded text-sm font-medium no-underline transition-colors motion-reduce:transition-none",
              labelled ? "flex-1 px-2.5" : "w-7",
              current ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
            )}
          >
            <span className={current ? "text-accent-green" : undefined}>{option.icon}</span>
            {labelled && FILMS_VIEW_LABELS[id]}
          </Link>
        );
      })}
    </nav>
  );
}
