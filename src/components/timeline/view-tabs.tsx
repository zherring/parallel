"use client";

import { ChartNoAxesGantt, Quote, Table2 } from "lucide-react";
import Link from "next/link";
import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { VIEW_LABELS, viewForKey, type View } from "@/lib/films-view";
import { cn } from "./cn";

/** The icon of each view, beside its label (in the page bar's tabs, and in its settings sheet's links to the views). */
export const VIEW_ICONS: Record<View, ReactNode> = {
  timeline: <ChartNoAxesGantt aria-hidden="true" className="size-4 shrink-0" />,
  table: <Table2 aria-hidden="true" className="size-4 shrink-0" />,
  clippings: <Quote aria-hidden="true" className="size-4 shrink-0" />,
};

export const viewTabId = (idBase: string, view: View) => `${idBase}-tab-${view}`;
export const viewPanelId = (idBase: string, view: View) => `${idBase}-panel-${view}`;

/** One view's button or link: the same box whether it is a tab of the flat page or a link of the Depth view, so the bar does not change when the page does. */
function itemClass(current: boolean, compact: boolean): string {
  return cn(
    "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded px-3 text-sm font-medium transition-colors motion-reduce:transition-none",
    current ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
    compact && "max-lg:px-2.5",
  );
}

function ItemContent({ view, current, compact }: { view: View; current: boolean; compact: boolean }) {
  return (
    <>
      <span className={current ? "text-accent-green" : undefined}>{VIEW_ICONS[view]}</span>
      <span className={compact ? "max-lg:sr-only" : undefined}>{VIEW_LABELS[view]}</span>
    </>
  );
}

interface ViewTabsProps {
  /** Prefix for the element ids, so the tabs and their panels are unique on the page. */
  idBase: string;
  view: View;
  /** The tabs, in order: Timeline and Table, and Clippings when the page has quotes or critics (see `availableViews`). */
  views: readonly View[];
  onChange: (view: View) => void;
  /** The tab list's box: the page bar gives it its outline and its place. */
  className?: string;
  /** Words beside the icons only from the large breakpoint up (the bar has less room than a phone's sheet). */
  compact?: boolean;
}

/**
 * The Timeline / Table (/ Clippings) switch of a flat page, in the page bar: a small segmented control that follows the
 * WAI-ARIA tabs pattern with automatic activation (arrow keys move and select, Left and Right
 * wrap, Home and End jump to the ends; only the selected tab is in the Tab order). The panels
 * live in the films section (both are in the markup, the inactive one hidden), see `FilmsSection`.
 */
export function ViewTabs({ idBase, view, views, onChange, className, compact = false }: ViewTabsProps) {
  const tabRefs = useRef<Record<View, HTMLButtonElement | null>>({ timeline: null, table: null, clippings: null });

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = viewForKey(event.key, view, views);
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label="Films view" className={className}>
      {views.map((id) => {
        const selected = id === view;
        return (
          <button
            key={id}
            ref={(element) => {
              tabRefs.current[id] = element;
            }}
            type="button"
            role="tab"
            id={viewTabId(idBase, id)}
            aria-selected={selected}
            aria-controls={viewPanelId(idBase, id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={onKeyDown}
            className={itemClass(selected, compact)}
          >
            <ItemContent view={id} current={selected} compact={compact} />
          </button>
        );
      })}
    </div>
  );
}

interface ViewLinksProps {
  views: readonly View[];
  /** The view this page is on. */
  view: View;
  /** The address of each view's page. */
  hrefFor: (view: View) => string;
  /** When given, a plain click chooses the view here instead of following the link (the flat page's views are panels of the page); a click with a modifier key still opens the link. */
  onSelect?: (view: View) => void;
  className?: string;
  compact?: boolean;
}

/**
 * The page's views as links: the same labels, icons and addresses as the tabs, for where there are no panels to switch between (the Depth
 * view, whose Table and Clippings are the flat page) or no room for the tabs (a phone's settings sheet, which lists them as a row of
 * choices). They are links, not tabs.
 */
export function ViewLinks({ views, view, hrefFor, onSelect, className, compact = false }: ViewLinksProps) {
  return (
    <nav aria-label="Views" className={className}>
      {views.map((id) => {
        const current = id === view;
        const choose = onSelect
          ? (event: MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onSelect(id);
            }
          : undefined;
        return (
          <Link
            key={id}
            href={hrefFor(id)}
            prefetch={false}
            aria-current={current ? "page" : undefined}
            onClick={choose}
            className={itemClass(current, compact)}
          >
            <ItemContent view={id} current={current} compact={compact} />
          </Link>
        );
      })}
    </nav>
  );
}
