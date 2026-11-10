"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DepthScene } from "@/components/depth/depth-scene";
import { DustMotes } from "@/components/depth/dust-motes";
import { DepthChrome } from "@/components/depth/depth-chrome";
import type { PillPerson } from "@/components/depth/people-pill";
import { YearRail } from "@/components/depth/year-rail";
import { FilmPanel } from "@/components/film-panel/film-panel";
import { PairHeroBody } from "@/components/hero/pair-hero-body";
import { useHeroCollapse } from "@/components/hero/use-hero-collapse";
import { usePairHero } from "@/components/hero/use-pair-hero";
import { scrollBehavior } from "@/components/timeline/scroll-behavior";
import { PageHeadline } from "@/components/page-headline";
import type { ExportList } from "@/components/timeline/export-button";
import { useFilmPrefs } from "@/components/timeline/use-film-prefs";
import { useUrlPeriod } from "@/components/timeline/use-period";
import { cardFilms } from "@/lib/card-films";
import type { PairClippings } from "@/lib/clippings";
import { combineLanes, combinedMinimapFilms, describeCombined } from "@/lib/combined-track";
import type { PairCritics } from "@/lib/critics";
import { DEPTH, HERO_ROOM_PX, depthLayout } from "@/lib/depth-layout";
import { demoteMinor, minorOnlyIds } from "@/lib/depth-minor";
import { DEPTH_VIEW, withDepth } from "@/lib/depth-url";
import { personRows, sharedRows } from "@/lib/film-rows";
import { DEFAULT_SORT, sortFilms } from "@/lib/films-table";
import { hasClippingsTab, showingMessage } from "@/lib/films-view";
import { scrollLeftToCenterTrackX } from "@/lib/minimap";
import { quoteHref, type HeroNote } from "@/lib/pair-hero";
import { laneSummary, removePersonHref } from "@/lib/lanes";
import { outsidePeriodIds, resolvePeriod, spanOfYears } from "@/lib/period";
import { personColorCss, personSlots } from "@/lib/person-colors";
import { postersLeftOut } from "@/lib/poster-cap";
import type { ShareInput } from "@/lib/share";
import { sharedFilms, type PairShared } from "@/lib/shared";
import { centerYear, scrollLeftForCenter } from "@/lib/timeline-layout";
import type { PersonTimeline, SharedFilm } from "@/lib/types";

interface Props {
  timelines: PersonTimeline[];
  /** Films all people share, non-minor credits only (the flat view's headline and table: the Depth view's headline counts them too, and Export writes them). */
  shared: SharedFilm[];
  /** Per-pair shared films; empty unless there are 3 or more people. */
  pairwise: PairShared[];
  /** yyyy-mm-dd (UTC), computed once on the server, so the server and the browser lay the scene out identically. */
  today: string;
  /** The quotes the two people of a pair have about each other, or null: whether the page has a Clippings view (the links to it). */
  clippings: PairClippings | null;
  /** What critics have written about the pair's collaboration, or null: the same. */
  critics: PairCritics | null;
  /** What the pair hero says beside the portraits (the pair's first quote, a curated description or its blurb), worked out on the server; null for none. */
  heroNote: HeroNote | null;
}

/** No film is minor: the usual scene. */
const NO_MINOR: ReadonlySet<number> = new Set();
/** No film is left without a poster: every film of the page is in the scene. */
const NO_FILMS_LEFT_OUT: ReadonlySet<number> = new Set();

/**
 * The Depth view of a `/p/` page (`?view=depth`): the same films as the Timeline, drawn as a vertical scene with
 * parallax, the first collaboration in the middle of the screen. It takes the page's props as `PeopleView` does so
 * the page can swap one for the other.
 */
export function DepthView(props: Props) {
  // A different set of people is a different page: start over (selection, scroll).
  const key = props.timelines.map((t) => t.person.id).join("+");
  return <DepthViewInner key={key} {...props} />;
}

function DepthViewInner({ timelines, shared, today, clippings, critics, heroNote }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollerId = useId();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [urlPeriod] = useUrlPeriod();
  // "Include minor credits" and "Show all films" are the flat page's settings, held for both views (see `useFilmPrefs`).
  const [{ includeMinor, showAll }, setPrefs] = useFilmPrefs(timelines.map((t) => t.person.id).join("+"));

  // The scene hides the site's header and footer (see globals.css) for as long as it is on screen.
  useLayoutEffect(() => {
    document.documentElement.dataset.view = DEPTH_VIEW;
    return () => {
      delete document.documentElement.dataset.view;
    };
  }, []);

  const people = useMemo(() => timelines.map((t) => ({ id: t.person.id, name: t.person.name })), [timelines]);
  // Minor credits are left out unless the settings include them; with them in, a film that is minor for everyone who has it is a background poster.
  const lanes = useMemo(
    () => timelines.map(({ person, films }) => ({ person, films: includeMinor ? films : films.filter((film) => !film.minor) })),
    [timelines, includeMinor],
  );
  const minorIds = useMemo(() => (includeMinor ? minorOnlyIds(lanes) : NO_MINOR), [includeMinor, lanes]);
  const slots = useMemo(() => personSlots(people), [people]);
  // Every film of the page, oldest first: what the flat page lists and counts.
  const everyEntry = useMemo(() => demoteMinor(combineLanes(lanes, slots, today), minorIds), [lanes, slots, today, minorIds]);
  // With "Show all films" off, the films the flat timeline would leave as bare nodes (the same packing, at its default zoom) have no poster here:
  // the scene is only the films that do, and a page of hundreds of credits is a few dozen posters. On, every film is in the scene.
  const cappedOut = useMemo(() => postersLeftOut(lanes, slots, today), [lanes, slots, today]);
  const leftOut = showAll ? NO_FILMS_LEFT_OUT : cappedOut;
  const entries = useMemo(
    () => (leftOut.size === 0 ? everyEntry : everyEntry.filter((entry) => !leftOut.has(entry.film.id))),
    [everyEntry, leftOut],
  );
  const info = useMemo(() => describeCombined(entries, lanes, includeMinor), [entries, lanes, includeMinor]);
  // The scene has room over its first year for the pair hero's band, which is over its top when it opens.
  const layout = useMemo(
    () => depthLayout(entries, people.length, today, { minorIds, pad: DEPTH.pad + HERO_ROOM_PX }),
    [entries, people.length, today, minorIds],
  );
  // The people pill's rows. Removing someone stays in the Depth view, unless it was the last person (that goes home).
  const pillPeople = useMemo(
    () =>
      lanes.map(({ person, films }): PillPerson => {
        const removeHref = removePersonHref(people, person.id);
        return {
          person,
          slot: slots.get(person.id) ?? 0,
          roles: laneSummary(films, person, includeMinor).roles,
          filmCount: films.length,
          removeHref: people.length > 1 ? withDepth(removeHref) : removeHref,
        };
      }),
    [lanes, people, slots, includeMinor],
  );
  const railFilms = useMemo(() => combinedMinimapFilms(entries), [entries]);

  // A link to a period dims the films outside it. It is resolved against the films the page's preview card shows,
  // so the server and the browser agree on it (as `PeopleView` does).
  const filmYears = useMemo(() => cardFilms(timelines, today).films.map((film) => film.year), [timelines, today]);
  const periodSpan = useMemo(() => spanOfYears(filmYears), [filmYears]);
  const period = useMemo(() => resolvePeriod(urlPeriod, periodSpan), [urlPeriod, periodSpan]);
  const outsideIds = useMemo(() => outsidePeriodIds(entries.map((entry) => entry.film), period), [entries, period]);

  // The settings' footing: whether the page has Clippings (a pair that has some), and what Share posts about, as on the flat page: the
  // films a pair made together, or a person's films, as the link opens them (minor credits out).
  const multi = people.length > 1;
  const clippingsTab = hasClippingsTab(clippings, critics);
  const share = useMemo<ShareInput>(
    () => ({ people, count: multi ? shared.length : timelines[0].films.filter((film) => !film.minor).length, years: filmYears }),
    [people, multi, shared.length, timelines, filmYears],
  );
  // The count the flat page's checkbox announces: every film (the cap leaves a film without a poster, it does not take it off the page).
  const settingsMessage = showingMessage(multi ? everyEntry.filter((entry) => entry.shared).length : everyEntry.length, multi);

  // The flat page's list, which the headline counts and Export writes (the gear has it on every view): the films the people share, or one person's
  // films, minor credits in only when the settings include them. The server sends the default list; it is worked out again only when they do.
  const sharedNow = useMemo(
    () => (includeMinor ? sharedFilms(timelines, { includeMinor: true, today }) : shared),
    [includeMinor, shared, timelines, today],
  );
  const rows = useMemo(
    () => (multi ? sharedRows(sharedNow, people) : personRows(timelines[0], includeMinor)),
    [multi, sharedNow, people, timelines, includeMinor],
  );
  // The table's default order, which is what the flat page's Export writes before a column is sorted.
  const exportList = useMemo<ExportList>(
    () => ({ films: sortFilms(rows, DEFAULT_SORT, new Map(), today), today, names: people.map((person) => person.name) }),
    [rows, today, people],
  );

  // The year at the middle of the screen stays there when the settings redraw the scene (the axis may grow or shrink at its ends).
  const keptCenter = useRef<number | null>(null);
  const rememberCenter = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller) keptCenter.current = centerYear(scroller.scrollTop, scroller.clientHeight, layout.scale);
  }, [layout.scale]);
  useLayoutEffect(() => {
    const year = keptCenter.current;
    const scroller = scrollerRef.current;
    keptCenter.current = null;
    if (year === null || !scroller) return;
    scroller.scrollTop = Math.max(0, Math.round(scrollLeftForCenter(year, scroller.clientHeight, layout.scale)));
  }, [layout.scale]);
  const handleIncludeMinorChange = useCallback(
    (next: boolean) => {
      rememberCenter();
      setPrefs({ includeMinor: next });
    },
    [rememberCenter, setPrefs],
  );
  // Only when films are on the cap's line does the scene change: with none, there is nothing to redraw and no centre to restore.
  const capHasEffect = cappedOut.size > 0;
  const handleShowAllChange = useCallback(
    (next: boolean) => {
      if (capHasEffect) rememberCenter();
      setPrefs({ showAll: next });
    },
    [capHasEffect, rememberCenter, setPrefs],
  );

  const handleSelect = useCallback((id: number, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setSelectedId(id);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    const trigger = triggerRef.current;
    triggerRef.current = null;
    // Put focus back where the keyboard user left off.
    if (trigger?.isConnected) requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
  }, []);

  // ---- the pair hero ------------------------------------------------------------------------------------------------------------------
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { subtitle, chips } = usePairHero({ timelines, rows, includeMinor });
  // The scene is the main scroller. It lands on the first collaboration (mid-career), so the hero collapses 48px from there, not from the top.
  const getHeroScroller = useCallback(() => scrollerRef.current, []);
  const { collapsed, collapse } = useHeroCollapse({ getScroller: getHeroScroller, axis: "y", resetKey: DEPTH_VIEW });
  const forwardWheel = useCallback(
    (deltaX: number, deltaY: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const top = scroller.scrollTop;
      scroller.scrollBy(deltaX, deltaY);
      // A scene that is at its end does not move; the hero gives way all the same.
      if (scroller.scrollTop === top) collapse();
    },
    [collapse],
  );
  /**
   * A chip pressed: the scene scrolls (smoothly unless the visitor asked for less motion) so that the film's poster is in the middle, as the year rail's dots do,
   * and the poster's button is focused. The hero collapses, so that it is not over the poster. A film that is not in the scene (a poster the cap left out) opens its panel.
   */
  const jumpToFilm = useCallback(
    (filmId: number, trigger: HTMLElement) => {
      const scroller = scrollerRef.current;
      const item = layout.films.find((candidate) => candidate.film.id === filmId);
      const poster = scroller?.querySelector<HTMLElement>(`[data-film="${filmId}"]`);
      if (!scroller || !item || !poster) {
        handleSelect(filmId, trigger);
        return;
      }
      scroller.scrollTo({ top: scrollLeftToCenterTrackX(item.y, layout.trackHeight, scroller.clientHeight), behavior: scrollBehavior() });
      poster.focus({ preventScroll: true });
      collapse();
    },
    [layout.films, layout.trackHeight, handleSelect, collapse],
  );
  const heroBody = (
    <PairHeroBody
      people={pillPeople}
      note={heroNote}
      quoteHref={heroNote?.kind === "quote" ? quoteHref(pathname, search, heroNote.id) : null}
      chips={chips}
      together={multi}
      onChip={jumpToFilm}
    />
  );

  return (
    <>
      {/* The palette as custom properties (src/lib/person-colors.ts): the hover card and the panel are in portals. */}
      <style>{personColorCss()}</style>
      {/* First in the tab order, as the site's header was; fixed chrome is a sibling of the scroller, never inside it. */}
      <DepthChrome
        people={pillPeople}
        hero={{ subtitle, collapsed, body: heroBody, onWheel: forwardWheel }}
        scrollerRef={scrollerRef}
        clippings={clippingsTab}
        showAll={showAll}
        onShowAllChange={handleShowAllChange}
        includeMinor={includeMinor}
        onIncludeMinorChange={handleIncludeMinorChange}
        settingsMessage={settingsMessage}
        share={share}
        exportList={exportList}
      />
      {/* The page's h1, for screen readers and search engines only (sr-only): outside the scene, which has nothing of it to place. */}
      <PageHeadline people={people} count={rows.length} />
      {/* Beneath the scroller, which is transparent: a mote is never drawn over a poster. */}
      <DustMotes scrollerRef={scrollerRef} />
      <DepthScene
        scrollerRef={scrollerRef}
        scrollerId={scrollerId}
        layout={layout}
        people={people}
        lanes={lanes}
        slots={slots}
        info={info}
        outsideIds={outsideIds}
        includeMinor={includeMinor}
        selectedId={selectedId}
        today={today}
        onSelect={handleSelect}
      />
      <YearRail
        scrollerRef={scrollerRef}
        scrollerId={scrollerId}
        scale={layout.scale}
        trackHeight={layout.trackHeight}
        shared={railFilms.shared}
        ticks={railFilms.ticks}
      />
      <FilmPanel filmId={selectedId} peopleInView={people} onClose={handleClose} />
    </>
  );
}
