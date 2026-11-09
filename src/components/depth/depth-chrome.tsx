"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { PeoplePill, type PillPerson } from "@/components/depth/people-pill";
import { HomeLink } from "@/components/home-link";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/components/timeline/cn";
import { FilmSettings } from "@/components/timeline/film-settings";
import { LayoutToggle, type Layout } from "@/components/timeline/layout-toggle";
import { ShareMenu } from "@/components/timeline/share-menu";
import { useLayoutPref } from "@/components/timeline/use-layout-pref";
import { VIEW_ICONS } from "@/components/timeline/view-tabs";
import { depthSearch, flatSearch } from "@/lib/depth-url";
import type { TrackMode } from "@/lib/film-prefs";
import { VIEW_LABELS, searchWithView, type View } from "@/lib/films-view";
import { layoutPrefOf } from "@/lib/layout-pref";
import type { ShareInput } from "@/lib/share";

interface DepthChromeProps {
  people: readonly PillPerson[];
  /** The scene's scroller, for the pill to close on. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** The views the page offers, in order: Timeline and Table, and Clippings for a pair that has quotes or critics (see `availableViews`). */
  views: readonly View[];
  /** Several people: Focus and Combined (Lanes too, if it is on offer, see `LANES_ENABLED`). One person's page has the flat timeline alone. */
  several: boolean;
  /** "Show all films", as on the flat page: off, the films the flat timeline leaves as bare nodes have no poster here (see `postersLeftOut`). */
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  includeMinor: boolean;
  onIncludeMinorChange: (include: boolean) => void;
  /** Chooses how the flat timeline draws several people, before the page moves to it (Combined, while Lanes are parked). */
  onTrackModeChange: (mode: TrackMode) => void;
  /** What the settings announce, politely, after the minor credits are turned on or off ("Showing 43 films together"). */
  settingsMessage: string;
  /** What the Share menu posts about, as on the flat page. */
  share: ShareInput;
}

/**
 * The look of the bar's controls over the scene: a hairline and the page's colour, a little see-through. Not blurred behind, as the pill is:
 * a backdrop filter over a scene that moves on every frame is the costliest thing a browser can be asked to do there (Safari most of all).
 */
const FLOATING = "border border-border bg-canvas/90";
/** Steps out of the way while the people pill is open: its field and card take the room the bar's controls would be in. */
const STEPS_ASIDE =
  "transition-[opacity,visibility] duration-150 motion-reduce:transition-none group-has-[[data-people-pill][data-open]]/bar:invisible group-has-[[data-people-pill][data-open]]/bar:opacity-0";

interface ViewLinksProps {
  views: readonly View[];
  /** The address of each view's page. */
  hrefFor: (view: View) => string;
  /** The scene is a layout of the Timeline: that is the view it is on. */
  className?: string;
  /** Words beside the icons only from this width up (the bar has less room than the settings sheet). */
  compact?: boolean;
}

/**
 * The page's views as links, the flat page's tabs in the same order with the same labels, icons and addresses: Timeline (the
 * Focus layout is the Timeline's, so it is the current one here), Table and Clippings, which leave for the flat page on that
 * view with the people and the period. They are links, not tabs: there are no panels to switch between here. Where Timeline
 * goes is the layout the visitor last chose (see `useLayoutPref`): this page for Focus, the flat timeline for Combined.
 */
function ViewLinks({ views, hrefFor, className, compact = false }: ViewLinksProps) {
  return (
    <nav aria-label="Views" className={className}>
      {views.map((view) => {
        const current = view === "timeline";
        return (
          <Link
            key={view}
            href={hrefFor(view)}
            prefetch={false}
            aria-current={current ? "page" : undefined}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded px-3 text-sm font-medium transition-colors motion-reduce:transition-none",
              current ? "bg-border text-strong" : "text-muted hover:bg-surface hover:text-strong",
              compact && "max-lg:px-2.5",
            )}
          >
            <span className={current ? "text-accent-green" : undefined}>{VIEW_ICONS[view]}</span>
            <span className={compact ? "max-lg:sr-only" : undefined}>{VIEW_LABELS[view]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The Depth view's controls, a bar fixed to the top of the screen: a small pill home (the site's header is hidden here), the
 * people pill and the page's views beside it at the left, and at the right, clear of the year rail, the layout control (Focus, Combined) and a gear. The bar is a
 * sibling of the scroller, never inside it (perspective would turn `fixed` into `absolute`), and takes no pointer events
 * of its own: only what is in it does, so the scene is draggable up to the controls' edges.
 *
 * The gear opens the flat page's film settings (Show all films and Include minor credits, which mean here what they mean there) and Share, the
 * flat page's menu with its Period choice. On a phone there is no room for the home pill, the views and the layout control on the
 * bar, so the bar holds the pill's heads and the gear alone, and the gear's sheet holds the views, the layout control and the way home too.
 *
 * Choosing a layout other than Focus, or a view other than Timeline, leaves for the flat page (a client-side navigation to the
 * same address without `view=depth`, or with the view): the people and the period go along, and the display preferences are held
 * for the flat page to read (see `useFilmPrefs`). Choosing a layout is also remembered, as the layout the Timeline tab goes to
 * (see `useLayoutPref`).
 */
export function DepthChrome({
  people,
  scrollerRef,
  views,
  several,
  showAll,
  onShowAllChange,
  includeMinor,
  onIncludeMinorChange,
  onTrackModeChange,
  settingsMessage,
  share,
}: DepthChromeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // The layout the visitor last chose: the Timeline link goes to it (the Depth view for Focus, the flat timeline for Combined).
  const [layoutPref, chooseLayout] = useLayoutPref();
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  /** What the Share menu reports (a link copied, say), in the sheet, for a few seconds; a live region, so it is also spoken. */
  const announce = useCallback((message: string) => {
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = setTimeout(() => setStatus(""), 4000);
  }, []);

  // The flat page's address for a view, as its tabs write it: `?view=table`, `?view=clippings`, the period kept. Timeline is the layout the
  // visitor last chose: this page for Focus, the flat timeline for Combined (what the server writes, before the choice is read).
  const hrefFor = useCallback(
    (view: View) => {
      if (view !== "timeline") return `${pathname}${searchWithView(search, view)}`;
      return `${pathname}${layoutPref === "focus" ? depthSearch(search) : flatSearch(search)}`;
    },
    [pathname, search, layoutPref],
  );

  const handleLayout = (layout: Layout) => {
    chooseLayout(layoutPrefOf(layout));
    if (layout === "focus") return;
    onTrackModeChange(layout);
    // The page as it is now without `view=depth` (read from the address bar: the period may have just been chosen in the Share menu).
    router.push(`${window.location.pathname}${flatSearch(window.location.search)}`);
  };

  const layoutToggle = (labelled: boolean) => (
    <LayoutToggle
      layout="focus"
      several={several}
      onChange={handleLayout}
      labelled={labelled}
      className={labelled ? "w-full" : FLOATING}
    />
  );

  const sectionTitle = "mb-2 text-xs font-medium uppercase tracking-wide text-muted";

  return (
    <div data-depth-chrome className="group/bar pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-3 pt-3">
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
        <ViewLinks
          views={views}
          hrefFor={hrefFor}
          compact
          className={cn("pointer-events-auto mt-1.5 inline-flex shrink-0 rounded-md p-0.5 max-sm:hidden", FLOATING, STEPS_ASIDE)}
        />
      </div>
      {/* Left of the year rail (3.75rem wide, 28px on a phone) with a gap: nothing here is ever over it. */}
      <div className={cn("pointer-events-auto mr-[3.75rem] mt-2 flex shrink-0 items-center gap-2 max-sm:mr-6 max-sm:mt-1.5", STEPS_ASIDE)}>
        <div className="max-sm:hidden">{layoutToggle(false)}</div>
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
              <ViewLinks views={views} hrefFor={hrefFor} className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-surface p-0.5" />
              <h2 className={cn(sectionTitle, "mt-3")}>Layout</h2>
              {layoutToggle(true)}
              <hr className="my-3 border-border" />
            </div>
          }
          after={
            <div className="mt-3 border-t border-border pt-3">
              <h2 className={sectionTitle}>Share</h2>
              <ShareMenu input={share} onStatus={announce} className="w-full" />
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
    </div>
  );
}
