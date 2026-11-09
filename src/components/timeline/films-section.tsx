"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { VoicedClippings } from "@/lib/clippings";
import type { PairCritics } from "@/lib/critics";
import type { TableRow } from "@/lib/film-rows";
import { hasClippingsTab, isFilmView, quoteIdsOf, showsPeriodNote, type View } from "@/lib/films-view";
import { ClippingsPanel } from "./clippings-panel";
import { FilmsTable } from "./films-table";
import type { BioPerson } from "./person-bio";
import type { FilmsTableModel } from "./use-films-table";
import { useViewTab } from "./use-view-tab";
import { viewPanelId, viewTabId } from "./view-tabs";

/** Where the bar's bottom edge is (px from the top of the screen), and a little room: a view chosen from far down the page brings the section back to here. */
const BAR_CLEARANCE_PX = 72;

interface FilmsSectionProps {
  /** The id of the section's (visually hidden) heading, which names it for assistive technology; also the prefix of the tab ids (the tabs are in the page bar). */
  headingId: string;
  /** The films are the ones several people made together: it words the section's heading. */
  together: boolean;
  rows: TableRow[];
  /** What the table is, for screen readers: "Films Harrison Ford made". */
  caption: string;
  /** The table's state (the sort, the metrics, the films in sorted order): the page holds it, so that the bar's Export writes the table's order. */
  table: FilmsTableModel;
  /** Counts up each time the visitor chooses a view: the page is brought back to the section (see below). */
  revealTick: number;
  /** A short note over the panels ("Showing 1966–1981 · Show full career"); nothing when null. Its line is kept even then, so that a period chosen with the brush does not push the timeline down. */
  note?: ReactNode;
  /** What to say instead of a table when there are no films. */
  empty: ReactNode;
  /** The Timeline tab: the legend, the lanes and the pinned bottom bar. */
  timeline: ReactNode;
  onSelect: (id: number, trigger: HTMLElement) => void;
  /** The pair's quotes about each other, which add a Clippings tab; none (the default) for a page without any. */
  clippings?: VoicedClippings | null;
  /** What the critics have written about the pair's collaboration, which adds the Clippings tab too (their quotes, and "More reading"); none (the default) for a page without any. */
  critics?: PairCritics | null;
  /** The page's people, for the names in the Clippings tab: each opens their biography (see `ClippingsPanel`). */
  bioPeople?: readonly BioPerson[];
  /** More content under the table, in the Table tab (the "By pair" lists). */
  children?: ReactNode;
}

/**
 * The films of a page as one section with two views, Timeline and Table, shown one at a time (and a third, Clippings, for a pair with curated
 * quotes (`clippings`) or critics writing about their collaboration (`critics`)). The views' tabs are in the page bar (`PeopleBar`, the same
 * on every view of the page, with Export and Share in its gear); the section is what is under the page's headline: a line for the period
 * note, then the selected view, then the small source note. The section's heading is for screen readers; the headline above carries the
 * film count.
 *
 * The panels are always mounted (the server renders them all, the inactive ones `hidden`): the table's
 * film titles and credits are in the HTML whichever tab is selected, and the timeline keeps its
 * zoom, scroll position and expanded lanes while the table is shown. The server and the first
 * client render show the Timeline; the address bar (`?view=`) is read after hydration, see
 * `useViewTab`. While the Clippings are selected the period note and the source note are left out.
 */
export function FilmsSection({
  headingId,
  together,
  rows,
  caption,
  table,
  revealTick,
  note,
  empty,
  timeline,
  onSelect,
  clippings = null,
  critics = null,
  bioPeople,
  children,
}: FilmsSectionProps) {
  const clippingsTab = hasClippingsTab(clippings, critics);
  const [view] = useViewTab(clippingsTab, quoteIdsOf(clippings, critics));
  const sectionRef = useRef<HTMLElement>(null);

  // Switching from far down a long table: the new panel starts at the top of the section, so bring that back into view (under the
  // bar) rather than leaving the visitor at the bottom of a page that has just got shorter.
  useLayoutEffect(() => {
    if (revealTick === 0) return;
    const top = sectionRef.current?.getBoundingClientRect().top ?? BAR_CLEARANCE_PX;
    if (top < BAR_CLEARANCE_PX) window.scrollBy(0, top - BAR_CLEARANCE_PX);
  }, [revealTick]);

  const hidden = (panel: View) => view !== panel;

  return (
    <section ref={sectionRef} aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        {together ? "Films together" : "Films"}
      </h2>
      <div className="min-h-5 min-w-0 text-sm text-body">{note && showsPeriodNote(view) && note}</div>

      {rows.length === 0 && isFilmView(view) && <p className="mt-4 max-w-xl text-body">{empty}</p>}

      <div
        role="tabpanel"
        id={viewPanelId(headingId, "timeline")}
        aria-labelledby={viewTabId(headingId, "timeline")}
        hidden={hidden("timeline")}
        // The timeline's panels (the people column and the controls are `z-[65]` and above) stay in the timeline's own stacking context, under the page bar
        // that is fixed over the top of the page, as they are under everything else outside it.
        className="isolate mt-2"
      >
        {timeline}
      </div>

      <div
        role="tabpanel"
        id={viewPanelId(headingId, "table")}
        aria-labelledby={viewTabId(headingId, "table")}
        hidden={hidden("table")}
        className="mt-2"
      >
        {rows.length === 0 ? <p className="text-sm text-muted">There are no films to list.</p> : <FilmsTable caption={caption} table={table} onSelect={onSelect} />}
        {children}
      </div>

      {clippingsTab && (
        <div
          role="tabpanel"
          id={viewPanelId(headingId, "clippings")}
          aria-labelledby={viewTabId(headingId, "clippings")}
          hidden={hidden("clippings")}
          className="mt-2"
        >
          <ClippingsPanel pair={clippings} critics={critics} active={view === "clippings"} bioPeople={bioPeople} />
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
