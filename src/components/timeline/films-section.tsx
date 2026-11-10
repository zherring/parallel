"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { VoicedClippings } from "@/lib/clippings";
import type { PairCritics } from "@/lib/critics";
import type { TableRow } from "@/lib/film-rows";
import { hasClippingsTab, isFilmView, quoteIdsOf, showsPeriodNote, type View } from "@/lib/films-view";
import { ClippingsPanel } from "./clippings-panel";
import { cn } from "./cn";
import { FilmsTable } from "./films-table";
import type { BioPerson } from "./person-bio";
import type { FilmsTableModel } from "./use-films-table";
import { useViewTab } from "./use-view-tab";

/**
 * The Table and the Quotes are read in a column (72rem wide, with the gutter the page has), centred; the Timeline is not in the flow at all: it is the
 * whole screen.
 */
const COLUMN = "mx-auto w-full max-w-[70.5rem] px-1";

/** The id of a view's panel: the page's links to the views (see `PeopleBar`) are what choose which is shown. */
export const viewPanelId = (headingId: string, view: View) => `${headingId}-panel-${view}`;

/** Where the bar's bottom edge is (px from the top of the screen), and a little room: a view chosen from far down the page brings the section back to here. */
const BAR_CLEARANCE_PX = 72;

interface FilmsSectionProps {
  /** The id of the section's (visually hidden) heading, which names it for assistive technology; also the prefix of the panels' ids. */
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
  /** The Timeline panel: the lanes and the pinned bottom bar. */
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
 * quotes (`clippings`) or critics writing about their collaboration (`critics`)). The links to the views are in the page bar (`PeopleBar`, the
 * same on every view of the page, with Export and Share in its gear); the section is what is under the bar. The Timeline is the whole screen, fixed
 * under the bar like the Depth view's scene, with the period note and the empty-state message floating at its top; the Table and the Quotes are in
 * the flow, in a reading column, with the Table's source note under it. The section's heading is for screen readers.
 *
 * The panels are always mounted (the server renders them all, the inactive ones `hidden`): the table's
 * film titles and credits are in the HTML whichever view is selected, and the timeline keeps its
 * zoom and scroll position while the table is shown. The server and the first
 * client render show the Timeline; the address bar (`?view=`) is read after hydration, see
 * `useViewTab`.
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
      {/* The line the Table and the Quotes start under (the Timeline is out of the flow: it is the screen's). */}
      <div className="min-h-5" />

      {rows.length === 0 && isFilmView(view) && view !== "timeline" && (
        <div className={COLUMN}>
          <p className="mt-4 max-w-xl text-body">{empty}</p>
        </div>
      )}

      <div
        id={viewPanelId(headingId, "timeline")}
        hidden={hidden("timeline")}
        data-fullscreen-panel
        // The Timeline is the whole screen, as the Depth view's scene is: fixed, edge to edge, under the page bar that is over its top. Its own layers (its
        // controls are `z-[65]` and above) stay in its own stacking context, under the bar, as they are under everything else outside it.
        className="fixed inset-0 z-10 isolate"
      >
        {timeline}
        {/*
          What the page says about the films, under the bar and over the track: the period it is showing ("Showing 1966–1981 · Show full career") and, for a pair
          that made none together, what to do. They take the pointer themselves, and the rest of the strip does not (the track under it is draggable).
        */}
        {(note || rows.length === 0) && (
          <div
            className="pointer-events-none absolute inset-x-0 z-[70] flex flex-col items-center gap-2 px-3"
            style={{ top: "calc(0.75rem + var(--bar-h) + 0.5rem)" }}
          >
            {note && showsPeriodNote(view) && (
              <div className="pointer-events-auto rounded-full border border-border bg-canvas/90 px-3 py-1 text-sm text-body">{note}</div>
            )}
            {rows.length === 0 && (
              <p className="pointer-events-auto max-w-xl rounded-lg border border-border bg-canvas/90 px-3 py-2 text-sm text-body">{empty}</p>
            )}
          </div>
        )}
      </div>

      <div id={viewPanelId(headingId, "table")} hidden={hidden("table")} className={cn("mt-2", COLUMN)}>
        {rows.length === 0 ? <p className="text-sm text-muted">There are no films to list.</p> : <FilmsTable caption={caption} table={table} onSelect={onSelect} />}
        {children}
      </div>

      {clippingsTab && (
        <div id={viewPanelId(headingId, "clippings")} hidden={hidden("clippings")} className={cn("mt-2", COLUMN)}>
          <ClippingsPanel pair={clippings} critics={critics} active={view === "clippings"} bioPeople={bioPeople} />
        </div>
      )}

      <div hidden={view !== "table"} className={cn("mt-5", COLUMN)}>
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
