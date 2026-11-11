"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, ViewTransition, type ReactNode, type RefObject } from "react";
import { REDUCED_MOTION, useMediaQuery } from "@/components/depth/use-media";
import { PeoplePill, flipTransform, type PillPerson } from "@/components/depth/people-pill";
import { PairTitle } from "@/components/hero/pair-title";
import { springEasing } from "@/components/landing/hero-motion";
import { HomeLink } from "@/components/home-link";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/components/timeline/cn";
import { ExportButton, type ExportList } from "@/components/timeline/export-button";
import { FilmSettings } from "@/components/timeline/film-settings";
import { ShareMenu } from "@/components/timeline/share-menu";
import { inPlace } from "@/components/timeline/view-tabs";
import { ViewSwitcher } from "@/components/timeline/view-switcher";
import { DEPTH_VIEW, isFilmsView, type PageView } from "@/lib/films-view";
import type { ShareInput } from "@/lib/share";

/** What the pair hero asks of the bar (see `PairHeroBody` and `useHeroCollapse`). */
export interface PeopleBarHero {
  /** The line under the names in the expanded title: each person's main role, and the films together. */
  subtitle: string;
  /** The hero has collapsed into the compact bar: the people pill is where the title was. */
  collapsed: boolean;
  /**
   * The hero's body (portraits, note, chips) for a view that is the whole screen, the Timeline and Films: it is drawn in the bar's own band, over the
   * top of the view, on a solid canvas with a soft edge, and eases away when the hero collapses. Null for the Table and the Quotes, whose body is in the
   * page, above the content, and scrolls away with it.
   */
  body: ReactNode;
  /** The band is solid, so a wheel over it is passed on to the view under it, which is what moves (and collapses the hero). */
  onWheel?: (deltaX: number, deltaY: number) => void;
}

interface PeopleBarProps {
  people: readonly PillPerson[];
  hero: PeopleBarHero;
  /** The Depth view's scroller, for the pill to close on. None on the flat pages: the window scrolls there. */
  scrollerRef?: RefObject<HTMLDivElement | null>;
  /** Whether the page has Quotes: a pair with quotes or critics (see `hasClippingsTab`). Only then is Quotes the fourth segment of the bar's control. */
  clippings: boolean;
  /** The view this page is on: Films (the Depth view, `depth`), Timeline or Table, or the Quotes (`clippings`). */
  view: PageView;
  /** The address of each view's page. */
  hrefFor: (view: PageView) => string;
  /**
   * The flat page's views (Timeline, Table, Clippings) are panels of the page, which the bar's links choose in place (see `useViewTab`), as
   * a plain click: the link still opens in a new tab with a modifier. Films is another page render, so it is always a plain link. Without this
   * (the Films page, whose every other view is the flat page) every view is a link.
   */
  onSelect?: (view: PageView) => void;
  /**
   * The Films view's year rail is at the right edge (3.75rem wide, 28px on a phone), and the gear, with the view switcher before it, sits clear of it.
   * Without a rail (the flat pages) the gear hugs the right edge, with the same gutter the bar's first control (the home square, the people pill on a phone) has at the left.
   */
  rail?: boolean;
  /** Shows or hides a person's films: the eye in the people pill's rows, on the views that have films to hide (see `PeoplePill`). None: no eyes. */
  onToggleVisible?: (personId: number) => void;
  /** "Show all films", as on the flat page. */
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  includeMinor: boolean;
  onIncludeMinorChange: (include: boolean) => void;
  /** What the settings announce, politely, after the minor credits are turned on or off ("Showing 43 films together"). */
  settingsMessage: string;
  /** What the Share menu posts about. */
  share: ShareInput;
  /** The films Export writes, with what the file is named for: Export is in the settings on every view but the Quotes, which it is not about. */
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
 * The page bar of a `/p/` page, fixed to the top of the screen, the same on every view (the flat Timeline, Table and Quotes, and the Films view,
 * which is the Depth view): at the left a small square home (a back arrow to the landing page), from `sm` up (the site's header is hidden on these
 * pages, see globals.css), and the people pill; at the right the view switcher (Films, Timeline, Table as one segmented control of text, and Quotes as
 * its fourth segment for a page that has quotes) and the gear. Everything at the left is in the same place and size on every view, and so is everything at the
 * right but for what the Films view's rail asks of it: the controls sit clear of the year rail there (`rail`), and at the right edge on the flat
 * pages, with the gutter the bar's first control has at the left.
 * Between the flat views they do not move; between a flat view and Films they glide, as a view transition: the bar is a different one on each page,
 * so the gear and the switcher are named for React to pair them up across the navigation (see `ViewTransition` and the `bar-` rules in globals.css).
 * The Depth view puts the bar before its scroller, never inside it (perspective would turn `fixed` into `absolute`); the bar takes no pointer events
 * of its own, only what is in it does, so the scene is draggable up to the controls' edges.
 *
 * The switcher is on every view with the same segments, Quotes included (its segment is the current one on the Quotes, like any other): that keeps the
 * bar's footprint the same on every view.
 *
 * The gear opens the film settings (Show all films and Include minor credits), Share (with its Period choice) and Export (the list as a CSV
 * file), on every view alike. On a phone there is no room for the home square and the switcher on the bar, so the bar holds the people
 * pill and the gear, and the gear's sheet holds the views (Quotes among them) and the way home too.
 *
 * The bar is as wide as the page's viewport (`inset-x-0`: a flat page with a scrollbar of its own ends the bar at the scrollbar, where the gear's
 * gutter is measured from; the Depth view's scroller hides its own) and sits over the page at `z-30`, under the panels and dialogs.
 */
export function PeopleBar({
  people,
  hero,
  scrollerRef,
  clippings,
  view,
  hrefFor,
  onSelect,
  rail = false,
  onToggleVisible,
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

  const reduced = useMediaQuery(REDUCED_MOTION);
  const barRef = useRef<HTMLDivElement>(null);
  const overlay = hero.body !== null;
  const expanded = !hero.collapsed;
  /**
   * Where the hero's band ends on the right: at the screen's edge, or, on the Films view, at the year rail's left edge (the rail runs the full height of the screen,
   * from its top, over nothing of the band: it is not pushed down by the hero, and the band, which is solid, never hides it).
   */
  const bandEnd = rail ? "right-[3.75rem] max-sm:right-7" : "right-0";

  // The hero collapses: each person's avatar in the pill flies in from where their portrait is, shrinking to the pill's size (FLIP, with the pill's spring).
  // Expanding is the reverse by cross-fade alone. Not for a visitor who asked for less motion, and not from a portrait that is off the screen.
  const wasCollapsed = useRef(hero.collapsed);
  useLayoutEffect(() => {
    if (wasCollapsed.current === hero.collapsed) return;
    wasCollapsed.current = hero.collapsed;
    const bar = barRef.current;
    if (!hero.collapsed || reduced || !bar) return;
    let index = 0;
    bar.querySelectorAll<HTMLElement>("[data-pill-head]").forEach((head) => {
      const portrait = document.querySelector<HTMLElement>(`[data-hero-portrait="${head.getAttribute("data-pill-head")}"]`);
      if (!portrait) return;
      const from = portrait.getBoundingClientRect();
      const to = head.getBoundingClientRect();
      if (from.width === 0 || to.width === 0 || from.bottom < 0 || from.top > window.innerHeight) return;
      const flown = flipTransform(from, to);
      head.animate(
        [
          { transform: flown, transformOrigin: "top left" },
          { transform: "none", transformOrigin: "top left" },
        ],
        { duration: 360, delay: index * 35, easing: springEasing(), fill: "backwards" },
      );
      index += 1;
    });
  }, [hero.collapsed, reduced]);

  return (
    <div
      ref={barRef}
      data-people-bar
      data-hero={expanded ? "expanded" : "collapsed"}
      data-hero-placement={overlay ? "band" : "page"}
      // The bar's controls are all `--bar-h` tall (the root's, see globals.css), so they line up.
      className="group/bar pointer-events-none fixed inset-x-0 top-0 z-30 flex flex-col px-3 pt-3"
      onWheel={overlay && expanded && hero.onWheel ? (event) => hero.onWheel?.(event.deltaX, event.deltaY) : undefined}
    >
      {backdrop && (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[4.5rem] bg-gradient-to-b from-canvas via-canvas/90 to-transparent" />
      )}
      {overlay && (
        <>
          {/* The band: solid canvas behind the title and the body while the hero is open (it takes the pointer, so what is under it is not hovered or pressed), a soft edge below it. */}
          <div
            aria-hidden="true"
            data-hero-band
            className={cn(
              "absolute inset-y-0 left-0 -z-10 bg-canvas transition-opacity duration-300 motion-reduce:transition-none",
              bandEnd,
              expanded ? "pointer-events-auto opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-full h-6 bg-gradient-to-b from-canvas to-transparent transition-opacity duration-300 motion-reduce:transition-none",
              bandEnd,
              expanded ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/*
            The way home, now that the site's header is gone: a rounded square (the bar's radius) with a back arrow, before the people pill, named "Back to
            Parallel home" (it links to the landing page, it does not go back in history). On a desktop it does not step aside for the open pill, whose field
            and card start at the people pill's own left edge, clear of it. Not on a phone: the bar's room there is the people pill's, so the pill starts at the
            bar's own left edge, the same on every view, and the gear's sheet has the way home, with the name.
          */}
          <HomeLink
            label="Back to Parallel home"
            title="Back to Parallel home"
            className={cn(
              "pointer-events-auto inline-flex size-(--bar-h) shrink-0 items-center justify-center rounded-(--bar-radius) text-muted no-underline transition-colors hover:bg-surface hover:text-strong motion-reduce:transition-none",
              FLOATING,
              "max-sm:hidden",
            )}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </HomeLink>
          {/*
            The title and the people pill share one place: the pair hero's title (the names joined with ×, and what each did) while the hero is expanded, the
            pill once it has collapsed. Both stay mounted, one over the other, and cross-fade; the one that is not shown is inert, so neither can be tabbed to or pressed.
          */}
          <div className="grid min-w-0">
            <div
              inert={expanded}
              className={cn("col-start-1 row-start-1 min-w-0 transition-[opacity,visibility] duration-200 motion-reduce:transition-none", expanded && "invisible opacity-0")}
            >
              <PeoplePill people={people} scrollerRef={scrollerRef} onToggleVisible={onToggleVisible} />
            </div>
            <div
              inert={!expanded}
              // Collapsed it takes no room either (a title of several lines on a narrow screen would make the compact bar taller than its controls).
              className={cn("col-start-1 row-start-1 min-w-0 transition-[opacity,visibility] duration-200 motion-reduce:transition-none", !expanded && "invisible h-0 overflow-hidden opacity-0")}
            >
              <PairTitle people={people} subtitle={hero.subtitle} />
            </div>
          </div>
        </div>
        {/*
          At the right edge, or, on the Films view, left of the year rail (3.75rem wide, 28px on a phone) with a gap: nothing there is ever over it.
          The cluster takes no pointer events itself, so that what is between its controls does not shield what is under it.
        */}
        <div className={cn("pointer-events-none flex shrink-0 items-center gap-2", rail && "mr-[3.75rem] max-sm:mr-6", STEPS_ASIDE)}>
          <ViewTransition name="people-bar-views" share="bar-glide" default="none">
            <div className="pointer-events-auto max-sm:hidden">
              <ViewSwitcher view={view} quotes={clippings} hrefFor={hrefFor} onClickFor={clickFor} className={FLOATING} />
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
                    <div data-close-sheet>
                      <ViewSwitcher view={view} quotes={clippings} hrefFor={hrefFor} onClickFor={clickFor} sheet className="bg-surface" />
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
      {overlay && (
        // The body eases open and shut (the grid row from its content's height to nothing, no measuring); shut, it is inert and not shown.
        <div
          inert={!expanded}
          className={cn(
            "grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
            expanded ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
          )}
        >
          {/* On the Films view the body ends where the gear does, clear of the year rail (3.75rem wide, 28px on a phone): its right padding is the rail's width. */}
          <div className={cn("-mx-1.5 min-h-0 overflow-hidden px-1.5", rail && "mr-[3.375rem] max-sm:mr-[1.125rem]")}>
            <div className="pointer-events-auto pb-3 pt-3 max-sm:pb-2 max-sm:pt-1.5">
              {hero.body}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
