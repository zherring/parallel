"use client";

import { useCallback, useEffect, useRef, useState, ViewTransition, type RefObject } from "react";
import { PeoplePill, type PillPerson } from "@/components/depth/people-pill";
import { HomeLink } from "@/components/home-link";
import { TogetherCount } from "@/components/together-count";
import { Wordmark, WordmarkMark } from "@/components/wordmark";
import { cn } from "@/components/timeline/cn";
import { ExportButton, type ExportList } from "@/components/timeline/export-button";
import { FilmSettings } from "@/components/timeline/film-settings";
import { ShareMenu } from "@/components/timeline/share-menu";
import { useFilmsViewPref } from "@/components/timeline/use-films-view-pref";
import { SectionNav, SectionTabs, inPlace } from "@/components/timeline/view-tabs";
import { ViewSwitcher } from "@/components/timeline/view-switcher";
import { DEPTH_VIEW, isFilmsView, type PageView } from "@/lib/films-view";
import type { ShareInput } from "@/lib/share";

interface PeopleBarProps {
  people: readonly PillPerson[];
  /** The Depth view's scroller, for the pill to close on. None on the flat pages: the window scrolls there. */
  scrollerRef?: RefObject<HTMLDivElement | null>;
  /** Whether the page has a Clippings section: a pair with quotes or critics (see `hasClippingsTab`). Without it the bar's Films tab stands alone. */
  clippings: boolean;
  /** The view this page is on: Timeline, Focus (the Depth view, `depth`) or Table, which are Films, or the Clippings. */
  view: PageView;
  /** The address of each view's page. */
  hrefFor: (view: PageView) => string;
  /**
   * The flat page's views (Timeline, Table, Clippings) are panels of the page, which the bar's links choose in place (see `useViewTab`), as
   * a plain click: the link still opens in a new tab with a modifier. Focus is another page render, so it is always a plain link. Without this
   * (the Focus page, whose every other view is the flat page) every view is a link.
   */
  onSelect?: (view: PageView) => void;
  /**
   * The Depth view's year rail is at the right edge (3.75rem wide, 28px on a phone), and the gear, with the view switcher before it, sits clear of it.
   * Without a rail (the flat pages) the gear hugs the right edge, with the same gutter the home pill has at the left.
   */
  rail?: boolean;
  /** Shows or hides a person's films: the eye in the people pill's rows, on the views that have films to hide (see `PeoplePill`). None: no eyes. */
  onToggleVisible?: (personId: number) => void;
  /** The films the page lists (the headline's count, the table's rows): what the pill after the people says, "30 films made together" for a pair. */
  filmCount: number;
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
/** The same, on a phone only: the home square stays beside the open pill there is room for it (the pill's field and card cover its place on a phone, see `PeoplePill`). */
const STEPS_ASIDE_ON_PHONE =
  "max-sm:transition-[opacity,visibility] max-sm:duration-150 max-sm:motion-reduce:transition-none max-sm:group-has-[[data-people-pill][data-open]]/bar:invisible max-sm:group-has-[[data-people-pill][data-open]]/bar:opacity-0";

/**
 * The page bar of a `/p/` page, fixed to the top of the screen, the same on every view (the flat Timeline, Table and Clippings, and the Depth
 * view): a small pill home (the site's header is hidden on these pages, see globals.css), the people pill, the count of the films they made
 * together (`TogetherCount`) and the page's two sections, Films and Clippings, beside it at the left, and at the right the view switcher (Timeline, Focus, Table) and the gear. Everything at the left is in the
 * same place and size on every view, and so is everything at the right but for what the Depth view's rail asks of it: the gear, with the switcher
 * before it, sits clear of the year rail on Focus (`rail`), and at the right edge on the flat pages, with the gutter the home pill has at the left.
 * Between the flat views they do not move; between a flat view and Focus they glide, as a view transition: the bar is a different one on each page,
 * so the gear and the switcher are named for React to pair them up across the navigation (see `ViewTransition` and the `bar-` rules in globals.css).
 * The Depth view puts the bar before its scroller, never inside it (perspective would turn `fixed` into `absolute`); the bar takes no pointer events
 * of its own, only what is in it does, so the scene is draggable up to the controls' edges.
 *
 * The Films link goes to the films view last used (see `films-view-pref`), and the switcher is on the Clippings too, where none of its views is the
 * current one and choosing one goes to it: that keeps the bar's footprint the same on every view.
 *
 * The gear opens the film settings (Show all films and Include minor credits), Share (with its Period choice) and Export (the list as a CSV
 * file), on every view alike. On a phone there is no room for the home pill, the sections and the switcher on the bar, so the bar holds
 * the pill's heads and the gear alone, and the gear's sheet holds the views and the way home too.
 *
 * The bar is as wide as the page's viewport (`inset-x-0`: a flat page with a scrollbar of its own ends the bar at the scrollbar, where the gear's
 * gutter is measured from; the Depth view's scroller hides its own) and sits over the page at `z-30`, under the panels and dialogs.
 */
export function PeopleBar({
  people,
  scrollerRef,
  clippings,
  view,
  hrefFor,
  onSelect,
  rail = false,
  onToggleVisible,
  filmCount,
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
  // The films view the visitor used last: where the Films tab goes (the server and the first client render say the Timeline, as the stored one is read after).
  const filmsView = useFilmsViewPref();

  useEffect(() => () => clearTimeout(timer.current), []);
  /** What Share and Export report (a link copied, a file downloaded), in the sheet, for a few seconds; a live region, so it is also spoken. */
  const announce = useCallback((message: string) => {
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = setTimeout(() => setStatus(""), 4000);
  }, []);

  const sectionTitle = "mb-2 text-xs font-medium uppercase tracking-wide text-muted";
  const exports = isFilmsView(view);
  /** A plain click on a link to `to` chooses it here when the page shows it in place (Focus never is: it is another page render). */
  const clickFor = (to: PageView) => inPlace(onSelect && to !== DEPTH_VIEW ? () => onSelect(to) : undefined);
  const section = view === "clippings" ? "clippings" : "films";

  return (
    <div
      data-people-bar
      // The bar's controls are all `--bar-h` tall (the root's, see globals.css), so they line up.
      className="group/bar pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-3 pt-3"
    >
      {backdrop && (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[4.5rem] bg-gradient-to-b from-canvas via-canvas/90 to-transparent" />
      )}
      <div className="flex min-w-0 items-start gap-3">
        {/*
          The way home, now that the site's header is gone: a rounded square (the bar's radius) with the wordmark's green "ll" alone, before the people pill. On a
          desktop it does not step aside for the open pill, whose field and card start at the people pill's own left edge, clear of it. On a phone
          it is there too (it is square), and the open pill's field and card, which are as wide as the screen less the margins,
          are drawn over its place, so it steps aside for them (see `PeoplePill`); the gear's sheet has the link too, with the name.
        */}
        <HomeLink
          title="Parallel home"
          className={cn(
            "pointer-events-auto inline-flex size-(--bar-h) shrink-0 items-center justify-center rounded-(--bar-radius) no-underline transition-colors hover:bg-surface motion-reduce:transition-none",
            FLOATING,
            STEPS_ASIDE_ON_PHONE,
          )}
        >
          <WordmarkMark className="text-2xl" />
        </HomeLink>
        <PeoplePill people={people} scrollerRef={scrollerRef} onToggleVisible={onToggleVisible} />
        {/* Right after the people: how many films they made together (or, for one person, how many films). It steps aside for the open pill, as the section nav does. */}
        <TogetherCount
          several={people.length > 1}
          count={filmCount}
          className={STEPS_ASIDE}
          pillClassName={FLOATING}
        />
      </div>
      {/*
        The page's sections, Films and Quotes, down the left edge under the home square (the bar's first control), on a thin line that drops from the
        square's middle: out of the bar's row, so the bar's footprint does not depend on it. Only for a page that has Quotes, and not on a phone (the gear's sheet
        has them). It is in the bar so that it steps aside for the open people pill, whose card is over its place. The page's content clears it (`PeopleView`).
      */}
      {clippings && (
        <SectionNav
          section={section}
          filmsHref={hrefFor(filmsView)}
          clippingsHref={hrefFor("clippings")}
          onFilms={clickFor(filmsView)}
          onClippings={clickFor("clippings")}
          className={cn("absolute left-[calc(0.75rem+var(--bar-h)/2)] top-[calc(0.75rem+var(--bar-h)+0.5rem)] max-sm:hidden", STEPS_ASIDE)}
        />
      )}
      {/*
        At the right edge, or, on the Depth view, left of the year rail (3.75rem wide, 28px on a phone) with a gap: nothing there is ever over it.
        The cluster takes no pointer events itself, so that what is between its controls does not shield what is under it.
      */}
      <div className={cn("pointer-events-none flex shrink-0 items-center gap-2", rail && "mr-[3.75rem] max-sm:mr-6", STEPS_ASIDE)}>
        <ViewTransition name="people-bar-views" share="bar-glide" default="none">
          <div className="pointer-events-auto max-sm:hidden">
            <ViewSwitcher view={view} hrefFor={hrefFor} onClickFor={clickFor} className={FLOATING} />
          </div>
        </ViewTransition>
        <ViewTransition name="people-bar-gear" share="bar-glide" default="none">
          <div className="pointer-events-auto flex shrink-0">
            <FilmSettings
              label="Settings"
              buttonClassName={cn("size-[var(--bar-h)]", FLOATING)}
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
                  <div data-close-sheet className="flex flex-col gap-2">
                    {clippings && (
                      <SectionTabs
                        section={section}
                        filmsHref={hrefFor(filmsView)}
                        clippingsHref={hrefFor("clippings")}
                        onFilms={clickFor(filmsView)}
                        onClippings={clickFor("clippings")}
                        className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-surface p-0.5"
                      />
                    )}
                    <ViewSwitcher view={view} hrefFor={hrefFor} onClickFor={clickFor} labelled className="flex w-full bg-surface" />
                  </div>
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
