"use client";

import { useCallback, useEffect, useRef, useState, ViewTransition, type ReactNode, type RefObject } from "react";
import { PeoplePill, type PillPerson } from "@/components/depth/people-pill";
import { HomeLink } from "@/components/home-link";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/components/timeline/cn";
import { ExportButton, type ExportList } from "@/components/timeline/export-button";
import { FilmSettings } from "@/components/timeline/film-settings";
import { ShareMenu } from "@/components/timeline/share-menu";
import { ViewLinks, ViewTabs } from "@/components/timeline/view-tabs";
import { isFilmView, type View } from "@/lib/films-view";
import type { ShareInput } from "@/lib/share";

interface PeopleBarProps {
  people: readonly PillPerson[];
  /** The Depth view's scroller, for the pill to close on. None on the flat pages: the window scrolls there. */
  scrollerRef?: RefObject<HTMLDivElement | null>;
  /** The views the page offers, in order: Timeline and Table, and Clippings for a pair that has quotes or critics (see `availableViews`). */
  views: readonly View[];
  /** The view this page is on (the Depth view is the Timeline's). */
  view: View;
  /** The address of each view's page. */
  hrefFor: (view: View) => string;
  /**
   * The flat page's views are panels of the page: the bar's views are tabs of them (the panels carry the ids, see `FilmsSection`), which choose the view
   * in place. Without it (the Depth view, whose Table and Clippings are the flat page) they are links.
   */
  panels?: { idBase: string; onSelect: (view: View) => void };
  /**
   * The layout control (Focus, Combined), for the views that have it in the bar: the Timeline, flat and Depth (Focus). `labelled` is the
   * sheet's wider one, with its words. The flat page passes it on every view and says on which it applies (`layoutShown`).
   */
  layoutToggle?: (labelled: boolean) => ReactNode;
  /**
   * Whether the layout control applies to the view the page is on (the flat Table and Clippings are not about the timeline's layout). The
   * flat page keeps the control mounted, out of sight and inert, on those, so that choosing between the Timeline and the other views fades it
   * in and out in place instead of making it jump. The Depth view's is always shown.
   */
  layoutShown?: boolean;
  /**
   * The Depth view's year rail is at the right edge (3.75rem wide, 28px on a phone), and the gear, with the layout control before it, sits clear of it.
   * Without a rail (the flat pages) the gear hugs the right edge, with the same gutter the home pill has at the left.
   */
  rail?: boolean;
  /** "Show all films", as on the flat page. */
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  includeMinor: boolean;
  onIncludeMinorChange: (include: boolean) => void;
  /** What the settings announce, politely, after the minor credits are turned on or off ("Showing 43 films together"). */
  settingsMessage: string;
  /** What the Share menu posts about. */
  share: ShareInput;
  /** The films Export writes, with what the file is named for: Export is in the settings on every view but the Clippings, which it is not about. */
  exportList: ExportList;
  /** A backing under the bar, so that a page scrolling beneath it does not show through between the controls. The Depth view has none: its scene is what is behind the bar. */
  backdrop?: boolean;
}

/**
 * The look of the bar's controls over a page that moves: a hairline and the page's colour, a little see-through. Not blurred behind, as the pill is:
 * a backdrop filter over a scene that moves on every frame is the costliest thing a browser can be asked to do there (Safari most of all).
 */
export const FLOATING = "border border-border bg-canvas/90";
/** Steps out of the way while the people pill is open: its field and card take the room the bar's controls would be in. */
const STEPS_ASIDE =
  "transition-[opacity,visibility] duration-150 motion-reduce:transition-none group-has-[[data-people-pill][data-open]]/bar:invisible group-has-[[data-people-pill][data-open]]/bar:opacity-0";

/**
 * The page bar of a `/p/` page, fixed to the top of the screen, the same on every view (the flat Timeline, Table and Clippings, and the Depth
 * view): a small pill home (the site's header is hidden on these pages, see globals.css), the people pill and the page's views beside it at the
 * left, and at the right the gear, and in front of it, on the Depth view, the layout control (Focus, Combined). Everything at the left is in the
 * same place and size on every view. The gear is where its view puts it: on the Depth view clear of the year rail (`rail`), with the layout
 * control before it; on the flat pages, which have no rail, at the right edge, with the gutter the home pill has at the left. Between the flat
 * views it does not move; between a flat view and the Depth view it glides (and the layout control comes and goes), as a view transition: the
 * bar is a different one on each page, so the gear and the control are named for React to pair them up across the navigation (see `ViewTransition`
 * and the `bar-` rules in globals.css). The Depth view puts the bar before its scroller, never inside it (perspective would turn `fixed` into
 * `absolute`); the bar takes no pointer events of its own, only what is in it does, so the scene is draggable up to the controls' edges.
 *
 * The gear opens the film settings (Show all films and Include minor credits), Share (with its Period choice) and Export (the list as a CSV
 * file), on every view alike. On a phone there is no room for the home pill, the views and the layout control on the bar, so the bar holds
 * the pill's heads and the gear alone, and the gear's sheet holds the views, the layout control and the way home too.
 *
 * The bar is as wide as the page's viewport (`inset-x-0`: a flat page with a scrollbar of its own ends the bar at the scrollbar, where the gear's
 * gutter is measured from; the Depth view's scroller hides its own) and sits over the page at `z-30`, under the panels and dialogs.
 */
export function PeopleBar({
  people,
  scrollerRef,
  views,
  view,
  hrefFor,
  panels,
  layoutToggle,
  layoutShown = true,
  rail = false,
  showAll,
  onShowAllChange,
  includeMinor,
  onIncludeMinorChange,
  settingsMessage,
  share,
  exportList,
  backdrop = false,
}: PeopleBarProps) {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * Whether the layout control fades when it comes or goes in place. Off until the page has settled: the flat page reads its view from the
   * address bar once it has hydrated (a link to `?view=table` is the Timeline's HTML first), and that is not a change to animate.
   */
  const [settled, setSettled] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  /** What Share and Export report (a link copied, a file downloaded), in the sheet, for a few seconds; a live region, so it is also spoken. */
  const announce = useCallback((message: string) => {
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = setTimeout(() => setStatus(""), 4000);
  }, []);

  const sectionTitle = "mb-2 text-xs font-medium uppercase tracking-wide text-muted";
  const exports = isFilmView(view);

  return (
    <div
      data-people-bar
      className="group/bar pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-3 pt-3"
    >
      {backdrop && (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[4.5rem] bg-gradient-to-b from-canvas via-canvas/90 to-transparent" />
      )}
      <div className="flex min-w-0 items-start gap-3">
        {/*
          The way home, now that the site's header is gone: a small pill of its own, before the people pill. It does not step aside for the
          open pill, whose field and card start at the people pill's own left edge, clear of it. Not on a phone: there the open card is as wide
          as the screen less the margins (it would run off the right edge with this before it), and the heads should have the room, so the
          gear's sheet holds the link instead.
        */}
        <HomeLink
          className={cn(
            "pointer-events-auto mt-2 inline-flex h-[34px] shrink-0 items-center rounded-full px-3.5 no-underline transition-colors hover:bg-surface motion-reduce:transition-none max-sm:hidden",
            FLOATING,
          )}
        >
          <Wordmark className="text-base" />
        </HomeLink>
        <PeoplePill people={people} scrollerRef={scrollerRef} />
        {panels ? (
          <ViewTabs
            idBase={panels.idBase}
            view={view}
            views={views}
            onChange={panels.onSelect}
            compact
            className={cn("pointer-events-auto mt-1.5 inline-flex shrink-0 rounded-md p-0.5 max-sm:hidden", FLOATING, STEPS_ASIDE)}
          />
        ) : (
          <ViewLinks
            views={views}
            view={view}
            hrefFor={hrefFor}
            compact
            className={cn("pointer-events-auto mt-1.5 inline-flex shrink-0 rounded-md p-0.5 max-sm:hidden", FLOATING, STEPS_ASIDE)}
          />
        )}
      </div>
      {/*
        At the right edge, or, on the Depth view, left of the year rail (3.75rem wide, 28px on a phone) with a gap: nothing there is ever over it.
        The cluster takes no pointer events itself, so that the layout control, out of sight on the Table and Clippings, does not shield what is under it.
      */}
      <div className={cn("pointer-events-none mt-2 flex shrink-0 items-center gap-2 max-sm:mt-1.5", rail && "mr-[3.75rem] max-sm:mr-6", STEPS_ASIDE)}>
        {layoutToggle && (
          <ViewTransition name="people-bar-layout" share="bar-glide" enter="bar-control-in" exit="bar-control-out" default="none">
            <div
              inert={!layoutShown}
              className={cn(
                "pointer-events-auto max-sm:hidden",
                settled && "transition-[opacity,visibility] duration-200 motion-reduce:transition-none",
                !layoutShown && "invisible opacity-0",
              )}
            >
              {layoutToggle(false)}
            </div>
          </ViewTransition>
        )}
        <ViewTransition name="people-bar-gear" share="bar-glide" default="none">
          <div className="pointer-events-auto flex shrink-0">
            <FilmSettings
              label="Settings"
              buttonClassName={cn("size-[34px]", FLOATING)}
              scrollable={false}
              showAll={showAll}
              onShowAllChange={onShowAllChange}
              includeMinor={includeMinor}
              onIncludeMinorChange={onIncludeMinorChange}
              message={settingsMessage}
              before={
                <div className="sm:hidden">
                  <h2 className={sectionTitle}>Views</h2>
                  {/* Choosing a view on the flat page leaves the sheet over it: it closes (see `FilmSettings`). */}
                  <div data-close-sheet>
                    <ViewLinks
                      views={views}
                      view={view}
                      hrefFor={hrefFor}
                      onSelect={panels?.onSelect}
                      className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-surface p-0.5"
                    />
                  </div>
                  {layoutToggle && layoutShown && (
                    <>
                      <h2 className={cn(sectionTitle, "mt-3")}>Layout</h2>
                      {layoutToggle(true)}
                    </>
                  )}
                  <hr className="my-3 border-border" />
                </div>
              }
              after={
                <div className="mt-3 border-t border-border pt-3">
                  <h2 className={sectionTitle}>{exports ? "Share and export" : "Share"}</h2>
                  <div className="flex flex-col gap-2">
                    <ShareMenu input={share} onStatus={announce} className="w-full" />
                    {exports && <ExportButton {...exportList} onStatus={announce} className="w-full" />}
                  </div>
                  <p role="status" aria-live="polite" className="mt-2 min-h-4 text-xs text-muted">
                    {status}
                  </p>
                  {/* On a phone the bar has no home pill (see above): the way home is here, last. */}
                  <div className="mt-3 border-t border-border pt-3 sm:hidden">
                    <HomeLink className="flex h-9 items-center gap-1.5 rounded-md bg-surface px-3 no-underline hover:bg-border">
                      <Wordmark className="text-base" />
                      <span className="text-sm text-muted">home</span>
                    </HomeLink>
                  </div>
                </div>
              }
            />
          </div>
        </ViewTransition>
      </div>
    </div>
  );
}
