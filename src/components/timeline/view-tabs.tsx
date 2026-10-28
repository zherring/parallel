"use client";

import { ChartNoAxesGantt, Table2 } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { VIEWS, VIEW_LABELS, viewForKey, type View } from "@/lib/films-view";
import { cn } from "./cn";

const ICONS: Record<View, ReactNode> = {
  timeline: <ChartNoAxesGantt aria-hidden="true" className="size-4 shrink-0" />,
  table: <Table2 aria-hidden="true" className="size-4 shrink-0" />,
};

export const viewTabId = (idBase: string, view: View) => `${idBase}-tab-${view}`;
export const viewPanelId = (idBase: string, view: View) => `${idBase}-panel-${view}`;

interface ViewTabsProps {
  /** Prefix for the element ids, so the tabs and their panels are unique on the page. */
  idBase: string;
  view: View;
  onChange: (view: View) => void;
}

/**
 * The Timeline / Table switch of a films section: a small segmented control that follows the
 * WAI-ARIA tabs pattern with automatic activation (arrow keys move and select, Left and Right
 * wrap, Home and End jump to the ends; only the selected tab is in the Tab order). The panels
 * live in the section (both are in the markup, the inactive one hidden), see `FilmsSection`.
 */
export function ViewTabs({ idBase, view, onChange }: ViewTabsProps) {
  const tabRefs = useRef<Record<View, HTMLButtonElement | null>>({ timeline: null, table: null });

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = viewForKey(event.key, view);
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Films view"
      className="inline-flex shrink-0 rounded-md border border-border bg-canvas p-0.5"
    >
      {VIEWS.map((id) => {
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
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors motion-reduce:transition-none",
              selected ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
            )}
          >
            <span className={selected ? "text-accent-green" : undefined}>{ICONS[id]}</span>
            {VIEW_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
