"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, type RefObject } from "react";
import type { PillPerson } from "@/components/depth/people-pill";
import { PeopleBar, type PeopleBarHero } from "@/components/people-bar";
import type { ExportList } from "@/components/timeline/export-button";
import { DEPTH_VIEW, pageViewHref } from "@/lib/depth-url";
import type { PageView } from "@/lib/films-view";
import type { ShareInput } from "@/lib/share";
import type { OpenPerson } from "@/lib/side-panel";

interface DepthChromeProps {
  people: readonly PillPerson[];
  /** A name or a portrait in the pill or the title was pressed: open the person's details in the slide-out panel. */
  onOpenPerson: OpenPerson;
  /** The pair hero (see `PeopleBar`): its title, whether it has collapsed, and its body, which the scene is under. */
  hero: PeopleBarHero;
  /** The scene's scroller, for the pill to close on. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Whether the page has Quotes: a pair that has quotes or critics (see `hasClippingsTab`). */
  clippings: boolean;
  /** "Show all films", as on the flat page: off, the films the flat timeline leaves as bare nodes have no poster here (see `postersLeftOut`). */
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
  includeMinor: boolean;
  onIncludeMinorChange: (include: boolean) => void;
  /** What the settings announce, politely, after the minor credits are turned on or off ("Showing 43 films together"). */
  settingsMessage: string;
  /** What the Share menu posts about, as on the flat page. */
  share: ShareInput;
  /** The films Export writes: the flat page's list, in its default order. */
  exportList: ExportList;
}

/**
 * The Depth view's page bar (`PeopleBar`, the same one the flat pages have), with what is the Depth view's about it: Films is the view the page is on
 * (the one of the switcher that is current), the Timeline, Table and Quotes are links to the flat page on that view, with the people and the period,
 * and the bar is clear of the year rail on the right.
 *
 * Choosing another view leaves for the flat page (a client-side navigation to the same address without `view=depth`, or with the view): the people and
 * the period go along, and the display preferences are held for the flat page to read (see `useFilmPrefs`).
 */
export function DepthChrome({
  people,
  onOpenPerson,
  hero,
  scrollerRef,
  clippings,
  showAll,
  onShowAllChange,
  includeMinor,
  onIncludeMinorChange,
  settingsMessage,
  share,
  exportList,
}: DepthChromeProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  const hrefFor = useCallback((view: PageView) => pageViewHref(pathname, search, view), [pathname, search]);

  return (
    <PeopleBar
      people={people}
      onOpenPerson={onOpenPerson}
      hero={hero}
      scrollerRef={scrollerRef}
      clippings={clippings}
      view={DEPTH_VIEW}
      hrefFor={hrefFor}
      rail
      showAll={showAll}
      onShowAllChange={onShowAllChange}
      includeMinor={includeMinor}
      onIncludeMinorChange={onIncludeMinorChange}
      settingsMessage={settingsMessage}
      share={share}
      exportList={exportList}
      backdrop
    />
  );
}
