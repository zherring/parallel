"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, type RefObject } from "react";
import type { PillPerson } from "@/components/depth/people-pill";
import { FLOATING, PeopleBar } from "@/components/people-bar";
import type { ExportList } from "@/components/timeline/export-button";
import { LayoutToggle, type Layout } from "@/components/timeline/layout-toggle";
import { useLayoutPref } from "@/components/timeline/use-layout-pref";
import { depthSearch, flatSearch } from "@/lib/depth-url";
import type { TrackMode } from "@/lib/film-prefs";
import { searchWithView, type View } from "@/lib/films-view";
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
  /** The films Export writes: the flat page's list, in its default order. */
  exportList: ExportList;
}

/**
 * The Depth view's page bar (`PeopleBar`, the same one the flat pages have), with what is the Depth view's about it: the Timeline is the page it is on
 * (the Focus layout is the Timeline's), the Table and Clippings are links to the flat page on that view, with the people and the period, and the layout
 * control is in the bar (on the flat Timeline it is inside the panel).
 *
 * Choosing a layout other than Focus, or a view other than Timeline, leaves for the flat page (a client-side navigation to the same address
 * without `view=depth`, or with the view): the people and the period go along, and the display preferences are held for the flat page to read
 * (see `useFilmPrefs`). Choosing a layout is also remembered, as the layout the Timeline tab goes to (see `useLayoutPref`).
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
  exportList,
}: DepthChromeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // The layout the visitor last chose: the Timeline link goes to it (the Depth view for Focus, the flat timeline for Combined).
  const [layoutPref, chooseLayout] = useLayoutPref();

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

  return (
    <PeopleBar
      people={people}
      scrollerRef={scrollerRef}
      views={views}
      view="timeline"
      hrefFor={hrefFor}
      layoutToggle={layoutToggle}
      showAll={showAll}
      onShowAllChange={onShowAllChange}
      includeMinor={includeMinor}
      onIncludeMinorChange={onIncludeMinorChange}
      settingsMessage={settingsMessage}
      share={share}
      exportList={exportList}
    />
  );
}
