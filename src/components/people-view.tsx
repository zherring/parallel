"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PillPerson } from "@/components/depth/people-pill";
import { FilmPanel } from "@/components/film-panel/film-panel";
import { PageHeadline } from "@/components/page-headline";
import { cn } from "@/components/timeline/cn";
import { PeopleBar } from "@/components/people-bar";
import { FilmsSection } from "@/components/timeline/films-section";
import type { BioPerson } from "@/components/timeline/person-bio";
import { useFilmPrefs } from "@/components/timeline/use-film-prefs";
import { recordFilmsView } from "@/components/timeline/use-films-view-pref";
import { useFilmsTable } from "@/components/timeline/use-films-table";
import { useUrlPeriod } from "@/components/timeline/use-period";
import { useViewTab } from "@/components/timeline/use-view-tab";
import { Timeline, type LaneData, type TimelineHandle } from "@/components/timeline/timeline";
import { Together } from "@/components/timeline/together";
import { cardFilms } from "@/lib/card-films";
import type { PairClippings } from "@/lib/clippings";
import { voiceClippings } from "@/lib/clippings-view";
import { toggleHidden } from "@/lib/combined-track";
import type { PairCritics } from "@/lib/critics";
import { pageViewHref } from "@/lib/depth-url";
import { effectiveTrackMode } from "@/lib/film-prefs";
import { personRows, sharedRows } from "@/lib/film-rows";
import { hasClippingsTab, parseView, quoteIdsOf, showingMessage, type PageView } from "@/lib/films-view";
import { laneSummary, removePersonHref } from "@/lib/lanes";
import { periodLabel, resolvePeriod, spanOfYears } from "@/lib/period";
import { personColorCss } from "@/lib/person-colors";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import type { ShareInput } from "@/lib/share";
import { sharedFilms, sharedFilmsPairwise, upcomingSharedFilms, type PairShared } from "@/lib/shared";
import type { PersonTimeline, SharedFilm } from "@/lib/types";

interface Props {
  timelines: PersonTimeline[];
  /** Films all people share, non-minor credits only. */
  shared: SharedFilm[];
  /** Per-pair shared films; empty unless there are 3 or more people. */
  pairwise: PairShared[];
  /**
   * yyyy-mm-dd (UTC), computed once on the server. Only films released on or before it are shared
   * or connected; the rest are upcoming. Passed down instead of read from the clock here so the
   * server and the browser lay the timeline out identically.
   */
  today: string;
  /** The quotes the two people of a pair have about each other; null for one person, 3 or more, or a pair without any. */
  clippings: PairClippings | null;
  /** What critics and scholars have written about the collaboration of the two people of a pair (the Clippings tab's critics' quotes and "More reading"); null for one person, 3 or more, or a pair without any. */
  critics: PairCritics | null;
}

export function PeopleView(props: Props) {
  // A different set of people is a different page: start over (zoom, selection, scroll).
  const key = props.timelines.map((t) => t.person.id).join("+");
  return <PeopleViewInner key={key} {...props} />;
}

function PeopleViewInner({ timelines, shared, pairwise, today, clippings, critics }: Props) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // The display preferences are shared with the Depth view (`?view=depth`), which a visitor moves to and from: see `useFilmPrefs`.
  const [{ includeMinor, showAll, trackMode }, setPrefs] = useFilmPrefs(timelines.map((t) => t.person.id).join("+"));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);
  const clippingsTab = hasClippingsTab(clippings, critics);
  const quoteIds = useMemo(() => quoteIdsOf(clippings, critics), [clippings, critics]);
  const [view, setView] = useViewTab(clippingsTab, quoteIds);
  // Visiting a films view records it, by any means (a link, a typed address, the bar): the Films tab goes to the one last used. From the address bar itself,
  // as `useViewTab` reads it: after a client-side navigation to this page the render before the effect can still hold the address it came from.
  useEffect(() => {
    const visited = parseView(window.location.search, quoteIds);
    if (visited !== "clippings") recordFilmsView(visited);
  }, [view, quoteIds]);
  /** Counts up each time the visitor chooses a view: the films section brings the page back to its top (see `FilmsSection`). */
  const [revealTick, setRevealTick] = useState(0);
  const [urlPeriod, setPeriod] = useUrlPeriod();
  // The people whose eye (in the people pill) is off: their films are not on the timeline. Everyone is shown to begin with.
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(() => new Set());

  const people = useMemo(() => timelines.map((t) => ({ id: t.person.id, name: t.person.name })), [timelines]);
  const multi = timelines.length > 1;
  // The Clippings tab draws each speaker in the colour and with the headshot the page gives them, resolved by TMDB id.
  const voicedClippings = useMemo(
    () => (clippings ? voiceClippings(clippings, timelines.map((t) => t.person)) : null),
    [clippings, timelines],
  );
  // Lanes are parked (see `LANES_ENABLED`): whatever track mode is held, the flat timeline is the one combined track.
  const shownTrackMode = effectiveTrackMode(trackMode);
  const combined = multi && shownTrackMode === "combined";

  // The server sends the default (non-minor) lists; recompute only when the toggle is on.
  const sharedNow = useMemo(
    () => (includeMinor ? sharedFilms(timelines, { includeMinor: true, today }) : shared),
    [includeMinor, shared, timelines, today],
  );
  const pairwiseNow = useMemo(
    () => (includeMinor ? sharedFilmsPairwise(timelines, { includeMinor: true, today }) : pairwise),
    [includeMinor, pairwise, timelines, today],
  );
  const minorExtra = useMemo(
    () =>
      multi && !includeMinor && shared.length === 0 ? sharedFilms(timelines, { includeMinor: true, today }).length : 0,
    [multi, includeMinor, shared.length, timelines, today],
  );
  // Films they share that are not out yet: not counted, so with nothing else shared the empty state says so.
  const upcomingExtra = useMemo(
    () => (multi && sharedNow.length === 0 ? upcomingSharedFilms(timelines, { includeMinor, today }).length : 0),
    [multi, sharedNow.length, timelines, includeMinor, today],
  );
  // One person: their own films, as the lane lists them (minor credits hidden unless the toggle is on).
  const soloRows = useMemo(() => (multi ? [] : personRows(timelines[0], includeMinor)), [multi, timelines, includeMinor]);
  // Films whose every credit is minor: what the toggle would add to an otherwise empty list.
  const soloMinorExtra = !multi && !includeMinor && soloRows.length === 0 ? timelines[0].films.length : 0;
  // The films the table lists (and the headline counts, and Export writes): the films the people share, or one person's films. The table's state
  // is held here, not in the section, so that Export (in the page bar's gear) writes them in the order the table is sorted in right now.
  const rows = useMemo(() => (multi ? sharedRows(sharedNow, people) : soloRows), [multi, sharedNow, people, soloRows]);
  const table = useFilmsTable(rows, today);

  const lanes: LaneData[] = useMemo(
    () =>
      timelines.map(({ person, films }) => {
        const visible = includeMinor ? films : films.filter((film) => !film.minor);
        return {
          person,
          films: visible,
          hiddenMinorIds: includeMinor ? [] : films.filter((film) => film.minor).map((film) => film.id),
        };
      }),
    [timelines, includeMinor],
  );

  // Combined: the people whose eye is on.
  const visibleLanes = useMemo(() => lanes.filter((lane) => !hiddenIds.has(lane.person.id)), [lanes, hiddenIds]);
  // The people pill's rows. A person's palette slot is their lane's position (the URL order, see `personSlots`).
  const pillPeople: PillPerson[] = useMemo(
    () =>
      lanes.map(({ person, films }, index) => ({
        person,
        slot: index,
        roles: laneSummary(films, person, includeMinor).roles,
        filmCount: films.length,
        removeHref: removePersonHref(people, person.id),
        visible: !hiddenIds.has(person.id),
      })),
    [lanes, includeMinor, hiddenIds, people],
  );

  // The names in the Clippings tab open the same biography dialog as the people pill's rows, with the same roles.
  const bioPeople: BioPerson[] = useMemo(
    () => pillPeople.map(({ person, roles }) => ({ person, roles })),
    [pillPeople],
  );

  // Hiding someone changes the axis (it spans the films shown): keep the year in the middle where it is.
  const handleToggleVisible = useCallback(
    (personId: number) => {
      timelineRef.current?.rememberCenter();
      setHiddenIds((prev) => toggleHidden(prev, personId, people.map((p) => p.id)));
    },
    [people],
  );
  // Filtering can change the axis; keep the year in the middle before updating either view.
  const handleIncludeMinorChange = useCallback((next: boolean) => {
    timelineRef.current?.rememberCenter();
    setPrefs({ includeMinor: next });
  }, [setPrefs]);
  const handleShowAllChange = useCallback((next: boolean) => setPrefs({ showAll: next }), [setPrefs]);

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

  // The years of the films a shared link is about (the ones its preview card shows): the Share menu's Period
  // choices, and what the page's own `?from=&to=` is resolved against, so the server and the browser agree.
  const filmYears = useMemo(() => cardFilms(timelines, today).films.map((film) => film.year), [timelines, today]);
  const periodSpan = useMemo(() => spanOfYears(filmYears), [filmYears]);
  const period = useMemo(() => resolvePeriod(urlPeriod, periodSpan), [urlPeriod, periodSpan]);

  // The link opens the default view, so the share text counts the non-minor films, not what the toggle shows.
  const soloFilmCount = timelines[0].films.filter((film) => !film.minor).length;
  const share = useMemo<ShareInput>(
    () => ({ people, count: multi ? shared.length : soloFilmCount, years: filmYears }),
    [people, multi, shared.length, soloFilmCount, filmYears],
  );

  // The page bar's views are links to this page's addresses (the period kept): the Timeline, Table and Clippings are panels of this page, which the
  // bar chooses in place with a plain click; Focus (the same page on `?view=depth`) is another render of it, so a link that navigates.
  const hrefFor = useCallback((next: PageView) => pageViewHref(pathname, search, next), [pathname, search]);
  const selectView = useCallback(
    (next: PageView) => {
      if (next === view || next === "depth") return;
      setRevealTick((tick) => tick + 1);
      setView(next);
    },
    [view, setView],
  );
  const exportList = useMemo(
    () => ({ films: table.rows, today, names: people.map((person) => person.name) }),
    [table.rows, today, people],
  );

  // The note over the panels: it says what the page is showing and takes the period away. Its line is kept (see `FilmsSection`),
  // so that choosing a period with the brush does not push the timeline down.
  const periodNote = period && (
    <p>
      Showing <span className="font-semibold text-strong">{periodLabel(period)}</span>
      <span aria-hidden="true" className="mx-2 text-muted">
        &middot;
      </span>
      <button
        type="button"
        onClick={() => setPeriod(null)}
        className="cursor-pointer rounded text-strong underline-offset-2 hover:underline"
      >
        Show full career
      </button>
    </p>
  );

  const timeline = (
    <Timeline
      ref={timelineRef}
      active={view === "timeline"}
      lanes={visibleLanes}
      combined={combined}
      showAll={showAll}
      startInset={clippingsTab}
      people={people}
      includeMinor={includeMinor}
      today={today}
      selectedId={selectedId}
      onSelect={handleSelect}
      period={period}
      periodSpan={periodSpan}
      periodYears={filmYears}
      onPeriodChange={setPeriod}
    />
  );

  return (
    <>
      {/*
        The page bar, the same on every view of the page, and the Depth view's too (see `PeopleBar`): fixed to the top of the screen, over the page, whose
        top the page's content clears (`pt-[4.5rem]`). The site's header is hidden on these pages (globals.css). It is before the page's content, so first in the tab order.
      */}
      <PeopleBar
        people={pillPeople}
        // The eyes are the pill's, where the films they show and hide are: the Timeline of several people (the Table and Clippings list films the
        // eyes do not change, and Focus draws them all).
        onToggleVisible={multi && view === "timeline" ? handleToggleVisible : undefined}
        clippings={clippingsTab}
        view={view}
        hrefFor={hrefFor}
        onSelect={selectView}
        filmCount={rows.length}
        showAll={showAll}
        onShowAllChange={handleShowAllChange}
        includeMinor={includeMinor}
        onIncludeMinorChange={handleIncludeMinorChange}
        settingsMessage={showingMessage(multi ? sharedNow.length : soloRows.length, multi)}
        share={share}
        exportList={exportList}
        backdrop
      />
      {/*
        The headline, for screen readers and search engines only (sr-only): the names and the film count the table lists (it follows the checkbox, like
        the table does; the server renders the default, the checkbox off, so the first client render matches). The page's content starts under the bar
        (about 4rem tall, over the top of the page).
      */}
      <PageHeadline people={people} count={rows.length} />
      {/*
        As wide as the page, with the bar's own gutter (12px): the Timeline spans it, and the Table and Quotes keep a reading column (see `FilmsSection`). A page
        that has Quotes has the section nav at the left edge from `sm` (see `PeopleBar`: it is about 100px wide), which the content clears with 7rem of padding.
      */}
      <div className={cn("w-full min-w-0 px-3 pb-8 pt-[4.5rem]", clippingsTab && "sm:pl-28")}>
        {/* The combined timeline's colours, as custom properties (src/lib/person-colors.ts): the hover card is in a portal. */}
        {multi && <style>{personColorCss()}</style>}

        {multi ? (
          <Together
            people={people}
            rows={rows}
            table={table}
            revealTick={revealTick}
            pairwise={pairwiseNow}
            minorExtra={minorExtra}
            upcomingExtra={upcomingExtra}
            note={periodNote}
            timeline={timeline}
            onSelect={handleSelect}
            clippings={voicedClippings}
            critics={critics}
            bioPeople={bioPeople}
          />
        ) : (
          <FilmsSection
            headingId="films"
            together={false}
            rows={rows}
            caption={`Films ${people[0].name} worked on`}
            table={table}
            revealTick={revealTick}
            note={periodNote}
            empty={
              <>
                No films found on TMDB.
                {soloMinorExtra > 0 && ` Turning on "${MINOR_TOGGLE_LABEL}" would add ${soloMinorExtra}.`}
              </>
            }
            timeline={timeline}
            onSelect={handleSelect}
          />
        )}

        <FilmPanel filmId={selectedId} peopleInView={people} onClose={handleClose} />
      </div>
    </>
  );
}
