"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { TableRow } from "@/lib/film-rows";
import { showingMessage, type View } from "@/lib/films-view";
import type { ShareInput } from "@/lib/share";
import { FilmsTable } from "./films-table";
import { MinorToggle } from "./minor-toggle";
import { ShareActions } from "./share-actions";
import { useFilmsTable } from "./use-films-table";
import { useViewTab } from "./use-view-tab";
import { ViewTabs, viewPanelId, viewTabId } from "./view-tabs";

interface FilmsSectionProps {
  /** The id of the section's (visually hidden) heading, which names it for assistive technology; also the prefix of the tab ids. */
  headingId: string;
  /** How many films the table lists, for the checkbox's message (the page headline carries the same number). */
  count: number;
  /** The films are the ones several people made together: it words the section's heading and the checkbox's message. */
  together: boolean;
  rows: TableRow[];
  /** Names in lane order, for the CSV file name. */
  names: string[];
  /** What the table is, for screen readers: "Films Harrison Ford made". */
  caption: string;
  /** What the Share menu posts about. */
  share: ShareInput;
  /** yyyy-mm-dd, the page's date (computed once on the server). */
  today: string;
  /** What to say instead of a table when there are no films. */
  empty: ReactNode;
  /** The Timeline tab: the legend, the lanes and the pinned bottom bar. */
  timeline: ReactNode;
  /** The minor-credits checkbox under the panels; it filters the lanes and the table alike. */
  includeMinor: boolean;
  onIncludeMinorChange: (next: boolean) => void;
  onSelect: (id: number, trigger: HTMLElement) => void;
  /** More content under the table, in the Table tab (the "By pair" lists). */
  children?: ReactNode;
}

/**
 * The films of a page as one section with two views, Timeline and Table, shown one at a time as
 * tabs: the tabs and Export and Share on one row (the section's heading is for screen readers; the
 * page headline above carries the film count), then the selected view, the minor-credits checkbox
 * and the small note about where the numbers come from.
 *
 * Both panels are always mounted (the server renders both, the inactive one `hidden`): the table's
 * film titles and credits are in the HTML whichever tab is selected, and the timeline keeps its
 * zoom, scroll position and expanded lanes while the table is shown. The server and the first
 * client render show the Timeline; the address bar (`?view=`) is read after hydration, see
 * `useViewTab`.
 */
export function FilmsSection({
  headingId,
  count,
  together,
  rows,
  names,
  caption,
  share,
  today,
  empty,
  timeline,
  includeMinor,
  onIncludeMinorChange,
  onSelect,
  children,
}: FilmsSectionProps) {
  const table = useFilmsTable(rows, today);
  const [view, setView] = useViewTab();
  const toolbarRef = useRef<HTMLDivElement>(null);
  /** A tab was chosen by the visitor and the page should be brought back to the tabs once it has re-rendered. */
  const reveal = useRef(false);

  const select = (next: View) => {
    if (next === view) return;
    reveal.current = true;
    setView(next);
  };

  // Switching from far down a long table: the new panel starts at the toolbar, so bring that back
  // into view rather than leaving the visitor at the bottom of a page that has just got shorter.
  useLayoutEffect(() => {
    if (!reveal.current) return;
    reveal.current = false;
    const top = toolbarRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) window.scrollBy(0, top - 8);
  }, [view]);

  const hidden = (panel: View) => view !== panel;

  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h2 id={headingId} className="sr-only">
        {together ? "Films together" : "Films"}
      </h2>
      <div ref={toolbarRef} className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ViewTabs idBase={headingId} view={view} onChange={select} />
        <ShareActions
          // The export follows the table: the films in the order they are sorted in right now.
          films={table.rows}
          today={today}
          names={names}
          share={share}
        />
      </div>

      {rows.length === 0 && <p className="mt-4 max-w-xl text-body">{empty}</p>}

      <div
        role="tabpanel"
        id={viewPanelId(headingId, "timeline")}
        aria-labelledby={viewTabId(headingId, "timeline")}
        hidden={hidden("timeline")}
        className="mt-4"
      >
        {timeline}
      </div>

      <div
        role="tabpanel"
        id={viewPanelId(headingId, "table")}
        aria-labelledby={viewTabId(headingId, "table")}
        hidden={hidden("table")}
        className="mt-4"
      >
        {rows.length === 0 ? <p className="text-sm text-muted">There are no films to list.</p> : <FilmsTable caption={caption} table={table} onSelect={onSelect} />}
        {children}
      </div>

      <div className="mt-5">
        <MinorToggle
          checked={includeMinor}
          onChange={onIncludeMinorChange}
          message={showingMessage(count, together)}
        />
        {rows.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Rating and box office from TMDB: the audience score, and the worldwide gross with how many times it covered
            the budget. Awards are Oscars and major festival prizes.
          </p>
        )}
      </div>
    </section>
  );
}
