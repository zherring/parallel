"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { VoicedClippings } from "@/lib/clippings";
import type { TableRow } from "@/lib/film-rows";
import { availableViews, isFilmView, showsPeriodNote, type View } from "@/lib/films-view";
import type { ShareInput } from "@/lib/share";
import { ClippingsPanel } from "./clippings-panel";
import { FilmsTable } from "./films-table";
import { ShareActions } from "./share-actions";
import { useFilmsTable } from "./use-films-table";
import { useViewTab } from "./use-view-tab";
import { ViewTabs, viewPanelId, viewTabId } from "./view-tabs";

interface FilmsSectionProps {
  /** The id of the section's (visually hidden) heading, which names it for assistive technology; also the prefix of the tab ids. */
  headingId: string;
  /** The films are the ones several people made together: it words the section's heading. */
  together: boolean;
  rows: TableRow[];
  /** Names in lane order, for the CSV file name. */
  names: string[];
  /** What the table is, for screen readers: "Films Harrison Ford made". */
  caption: string;
  /** What the Share menu posts about. */
  share: ShareInput;
  /** A short note in the toolbar between the tabs and the buttons ("Showing 1966–1981 · Show full career"); nothing when null. */
  note?: ReactNode;
  /** yyyy-mm-dd, the page's date (computed once on the server). */
  today: string;
  /** What to say instead of a table when there are no films. */
  empty: ReactNode;
  /** The Timeline tab: the legend, the lanes and the pinned bottom bar. */
  timeline: ReactNode;
  /** The same film preferences as the timeline, accessible from the Table toolbar too. */
  settingsControl: ReactNode;
  onSelect: (id: number, trigger: HTMLElement) => void;
  /** The pair's quotes about each other, which add a Clippings tab; none (the default) for a page without any. */
  clippings?: VoicedClippings | null;
  /** More content under the table, in the Table tab (the "By pair" lists). */
  children?: ReactNode;
}

/**
 * The films of a page as one section with two views, Timeline and Table, shown one at a time as
 * tabs: the tabs and Export and Share on one row (the section's heading is for screen readers; the
 * page headline above carries the film count), then the selected view and the small source note.
 * Preferences live in the timeline's gear or, for Table, beside its tabs. A pair with curated quotes
 * (`clippings`) has a third tab, Clippings; it is not about the films, so while it is selected the
 * period note, Export, the settings control and the source note are left out (Share stays).
 *
 * The panels are always mounted (the server renders them all, the inactive ones `hidden`): the table's
 * film titles and credits are in the HTML whichever tab is selected, and the timeline keeps its
 * zoom, scroll position and expanded lanes while the table is shown. The server and the first
 * client render show the Timeline; the address bar (`?view=`) is read after hydration, see
 * `useViewTab`.
 */
export function FilmsSection({
  headingId,
  together,
  rows,
  names,
  caption,
  share,
  note,
  today,
  empty,
  timeline,
  settingsControl,
  onSelect,
  clippings = null,
  children,
}: FilmsSectionProps) {
  const table = useFilmsTable(rows, today);
  const views = availableViews(clippings !== null);
  const [view, setView] = useViewTab(clippings !== null);
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
        <ViewTabs idBase={headingId} view={view} views={views} onChange={select} />
        {note && showsPeriodNote(view) && <div className="min-w-0 text-sm text-body">{note}</div>}
        <ShareActions
          // The export follows the table: the films in the order they are sorted in right now.
          films={table.rows}
          today={today}
          names={names}
          share={share}
          showExport={isFilmView(view)}
        />
        {view === "table" && <div className="ml-auto sm:ml-0">{settingsControl}</div>}
      </div>

      {rows.length === 0 && isFilmView(view) && <p className="mt-4 max-w-xl text-body">{empty}</p>}

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

      {clippings && (
        <div
          role="tabpanel"
          id={viewPanelId(headingId, "clippings")}
          aria-labelledby={viewTabId(headingId, "clippings")}
          hidden={hidden("clippings")}
          className="mt-4"
        >
          <ClippingsPanel pair={clippings} active={view === "clippings"} />
        </div>
      )}

      <div hidden={!isFilmView(view)} className="mt-5">
        {rows.length > 0 && (
          <p className="text-xs text-muted">
            Rating and box office from TMDB: the audience score, and the worldwide gross with how many times it covered
            the budget. Awards are Oscars and major festival prizes.
          </p>
        )}
      </div>
    </section>
  );
}
