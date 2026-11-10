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

/** The page's top level: Films (the Timeline, Focus and Table), and the Clippings for a page that has them. */
export type Section = "films" | "clippings";

const ICON = "size-4 shrink-0";
const SECTION_ICONS: Record<Section, ReactNode> = {
  films: <Clapperboard aria-hidden="true" className={ICON} />,
  clippings: <Quote aria-hidden="true" className={ICON} />,
};
const SECTION_LABELS: Record<Section, string> = { films: "Films", clippings: "Quotes" };

/** One section's link: the same box whichever view the page is on, so the bar does not change when the page does. */
function itemClass(current: boolean, compact: boolean): string {
  return cn(
    "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded px-3 text-sm font-medium transition-colors motion-reduce:transition-none",
    current ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
    compact && "max-lg:px-2.5",
  );
}

interface SectionTabsProps {
  /** Whether the page has Clippings (see `hasClippingsTab`). Without, Films stands alone: the bar's footprint is the same on every page. */
  clippings: boolean;
  /** The section the page is on: Films for the Timeline, Focus and Table. */
  section: Section;
  /** Where Films goes: the films view the visitor used last (see `films-view-pref`). */
  filmsHref: string;
  clippingsHref: string;
  /** When given, a plain click chooses the section in place instead of following the link (see `inPlace`). */
  onFilms?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onClippings?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** The nav's box: the page bar gives it its outline and its place. */
  className?: string;
  /** Words beside the icons only from the large breakpoint up (the bar has less room than a phone's sheet). */
  compact?: boolean;
}

/**
 * The page's top-level navigation, in the page bar: Films and Clippings, a small segmented control of two links (Films alone for a page
 * without Clippings). The Films link is current on the Timeline, Focus and Table; it goes to the films view last used, so a visit to the
 * Clippings is a round trip. They are links, not tabs: Films is three views, one of which (Focus) is another page render.
 */
export function SectionTabs({ clippings, section, filmsHref, clippingsHref, onFilms, onClippings, className, compact = false }: SectionTabsProps) {
  const items: { id: Section; href: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }[] = [
    { id: "films", href: filmsHref, onClick: onFilms },
    ...(clippings ? [{ id: "clippings" as const, href: clippingsHref, onClick: onClippings }] : []),
  ];
  return (
    <nav aria-label="Sections" className={className}>
      {items.map(({ id, href, onClick }) => {
        const current = id === section;
        return (
          <Link
            key={id}
            href={href}
            prefetch={false}
            aria-current={current ? "page" : undefined}
            onClick={onClick}
            className={itemClass(current, compact)}
          >
            <span className={current ? "text-accent-green" : undefined}>{SECTION_ICONS[id]}</span>
            <span className={compact ? "max-lg:sr-only" : undefined}>{SECTION_LABELS[id]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
