"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FilmPanel } from "@/components/film-panel/film-panel";
import { PersonSearch } from "@/components/person-search/person-search";
import { FilmsSection } from "@/components/timeline/films-section";
import { FilmSettings } from "@/components/timeline/film-settings";
import { PeoplePanel, type PanelLayout, type PanelPerson } from "@/components/timeline/people-panel";
import type { BioPerson } from "@/components/timeline/person-bio";
import { TrackModeToggle, type TrackMode } from "@/components/timeline/track-mode-toggle";
import { useUrlPeriod } from "@/components/timeline/use-period";
import { useViewTab } from "@/components/timeline/use-view-tab";
import { Timeline, type LaneData, type TimelineHandle } from "@/components/timeline/timeline";
import { Together } from "@/components/timeline/together";
import { cardFilms } from "@/lib/card-films";
import type { PairClippings } from "@/lib/clippings";
import { voiceClippings } from "@/lib/clippings-view";
import { toggleHidden } from "@/lib/combined-track";
import type { PairCritics } from "@/lib/critics";
import { personRows } from "@/lib/film-rows";
import { hasClippingsTab, headlineCount, quoteIdsOf, showingMessage } from "@/lib/films-view";
import { laneSummary, removePersonHref } from "@/lib/lanes";
import { periodLabel, resolvePeriod, spanOfYears } from "@/lib/period";
import { personColorCss } from "@/lib/person-colors";
import { MINOR_TOGGLE_LABEL } from "@/lib/roles";
import { pageHeading } from "@/lib/short-name";
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
  const [includeMinor, setIncludeMinor] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);
  const [view] = useViewTab(hasClippingsTab(clippings, critics), quoteIdsOf(clippings, critics));
  const [urlPeriod, setPeriod] = useUrlPeriod();
  // Start with one shared track; separating changes only how the people's films are drawn.
  const [trackMode, setTrackMode] = useState<TrackMode>("combined");
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<number>>(() => new Set());
  const [openIds, setOpenIds] = useState<ReadonlySet<number>>(() => new Set());
  // Full-height docking is an explicit choice of the top control, not a side effect of opening the last row.
  const [panelLayout, setPanelLayout] = useState<PanelLayout>("condense");

  const people = useMemo(() => timelines.map((t) => ({ id: t.person.id, name: t.person.name })), [timelines]);
  const multi = timelines.length > 1;
  // The Clippings tab draws each speaker in the colour and with the headshot the page gives them, resolved by TMDB id.
  const voicedClippings = useMemo(
    () => (clippings ? voiceClippings(clippings, timelines.map((t) => t.person)) : null),
    [clippings, timelines],
  );
  const combined = multi && trackMode === "combined";

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

  // Combined: the people whose eye is on, and what the people column says of everyone.
  const visibleLanes = useMemo(() => lanes.filter((lane) => !hiddenIds.has(lane.person.id)), [lanes, hiddenIds]);
  // A person's palette slot is their lane's position (the URL order, see `personSlots`).
  const panelPeople: PanelPerson[] = useMemo(
    () =>
      lanes.map(({ person, films }, index) => {
        const { roles, facts } = laneSummary(films, person, includeMinor);
        return {
          person,
          slot: index,
          roles,
          facts,
          filmCount: films.length,
          visible: !hiddenIds.has(person.id),
          removeHref: removePersonHref(people, person.id),
        };
      }),
    [lanes, includeMinor, hiddenIds, people],
  );

  // The names in the Clippings tab open the same biography dialog as the people column, with the same roles.
  const bioPeople: BioPerson[] = useMemo(
    () => panelPeople.map(({ person, roles }) => ({ person, roles })),
    [panelPeople],
  );

  // Hiding someone changes the axis (it spans the films shown): keep the year in the middle where it is.
  const handleToggleVisible = useCallback(
    (personId: number) => {
      timelineRef.current?.rememberCenter();
      setHiddenIds((prev) => toggleHidden(prev, personId, people.map((p) => p.id)));
    },
    [people],
  );
  const handleToggleOpen = useCallback((personId: number) => {
    // Leaving the docked column adds the floating inset to --lane-head. Preserve the year
    // under the viewport's centre before that width changes, even for an individual caret.
    if (panelLayout === "stack") timelineRef.current?.rememberCenter();
    setPanelLayout("condense");
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(personId)) next.add(personId);
      return next;
    });
  }, [panelLayout]);

  const handleTrackModeChange = useCallback((mode: TrackMode) => {
    timelineRef.current?.rememberCenter();
    setTrackMode(mode);
  }, []);

  const handlePanelLayoutChange = useCallback((layout: PanelLayout) => {
    timelineRef.current?.rememberCenter();
    setPanelLayout(layout);
    setOpenIds(new Set(layout === "stack" ? people.map((person) => person.id) : []));
  }, [people]);

  // Filtering can change the axis; keep the year in the middle before updating either view.
  const handleIncludeMinorChange = useCallback((next: boolean) => {
    timelineRef.current?.rememberCenter();
    setIncludeMinor(next);
  }, []);

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
  // Three or more people: family names only, with the full names on hover.
  const heading = pageHeading(people);
  // The headline's count is the table's: the films they share, or the films listed for one person. It follows the
  // checkbox like the table does; the server renders the default (checkbox off), so the first client render matches.
  const filmCount = headlineCount(multi ? sharedNow.length : soloRows.length);

  // The note in the toolbar: it says what the page is showing and takes the period away. It is in the toolbar's row
  // (not above it) so that choosing a period with the brush does not push the timeline down.
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

  const settingsControl = (
    <FilmSettings
      showAll={showAll}
      onShowAllChange={setShowAll}
      includeMinor={includeMinor}
      onIncludeMinorChange={handleIncludeMinorChange}
      message={showingMessage(multi ? sharedNow.length : soloRows.length, multi)}
    />
  );

  const timeline = (
    <Timeline
      ref={timelineRef}
      active={view === "timeline"}
      lanes={visibleLanes}
      combined={combined}
      showAll={showAll}
      settingsControl={settingsControl}
      layoutToggle={multi ? <TrackModeToggle mode={trackMode} onChange={handleTrackModeChange} /> : undefined}
      sidebarExpanded={panelLayout === "stack"}
      sidebar={
        // The people column belongs to both layouts: the eye and the details stay where they were
        // when the track switches between combined and separate.
        multi
          ? (
              <PeoplePanel
                people={panelPeople}
                layout={panelLayout}
                onLayoutChange={handlePanelLayoutChange}
                openIds={openIds}
                onToggleOpen={handleToggleOpen}
                onToggleVisible={handleToggleVisible}
              />
            )
          : undefined
      }
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
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8">
      {/* The combined timeline's colours, as custom properties (src/lib/person-colors.ts): the hover card is in a portal. */}
      {multi && <style>{personColorCss()}</style>}
      {/*
        The title row: the headline (the names and, muted, the film count the table lists) and the Add
        a person field. They share a row while the headline leaves room for the field; a longer
        headline takes the whole row and the field drops under it, at the right (wrapping, not
        shrinking: the headline keeps its width until it is wider than the row). On a one-person page
        the field offers the person's frequent collaborators when it is focused while empty (a
        dropdown over the page, so nothing in the row ever changes size or moves).
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <h1
          title={heading.full ?? undefined}
          className="max-w-full shrink-0 break-words text-2xl font-semibold text-strong sm:text-3xl"
        >
          {heading.text}
          {filmCount && <span className="font-normal text-muted">, {filmCount}</span>}
        </h1>
        <div className="w-full lg:ml-auto lg:w-72 lg:shrink-0">
          <PersonSearch
            peopleInView={people}
            size="compact"
            ariaLabel="Add a person"
            suggestFor={multi ? undefined : people[0].id}
            wideMenu
          />
        </div>
      </div>

      {multi ? (
        <Together
          people={people}
          shared={sharedNow}
          pairwise={pairwiseNow}
          minorExtra={minorExtra}
          upcomingExtra={upcomingExtra}
          shareCount={shared.length}
          shareYears={filmYears}
          note={periodNote}
          today={today}
          timeline={timeline}
          settingsControl={settingsControl}
          onSelect={handleSelect}
          clippings={voicedClippings}
          critics={critics}
          bioPeople={bioPeople}
        />
      ) : (
        <FilmsSection
          headingId="films"
          together={false}
          rows={soloRows}
          names={[people[0].name]}
          caption={`Films ${people[0].name} worked on`}
          share={{ people, count: soloFilmCount, years: filmYears }}
          note={periodNote}
          today={today}
          timeline={timeline}
          settingsControl={settingsControl}
          empty={
            <>
              No films found on TMDB.
              {soloMinorExtra > 0 && ` Turning on "${MINOR_TOGGLE_LABEL}" would add ${soloMinorExtra}.`}
            </>
          }
          onSelect={handleSelect}
        />
      )}

      <FilmPanel filmId={selectedId} peopleInView={people} onClose={handleClose} />
    </div>
  );
}
