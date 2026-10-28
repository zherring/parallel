"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FilmPanel } from "@/components/film-panel/film-panel";
import { PersonSearch } from "@/components/person-search/person-search";
import { FilmsSection } from "@/components/timeline/films-section";
import { useViewTab } from "@/components/timeline/use-view-tab";
import { Timeline, type LaneData, type TimelineHandle } from "@/components/timeline/timeline";
import { Together } from "@/components/timeline/together";
import { personRows } from "@/lib/film-rows";
import { headlineCount } from "@/lib/films-view";
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
}

export function PeopleView(props: Props) {
  // A different set of people is a different page: start over (zoom, selection, scroll).
  const key = props.timelines.map((t) => t.person.id).join("+");
  return <PeopleViewInner key={key} {...props} />;
}

function PeopleViewInner({ timelines, shared, pairwise, today }: Props) {
  const [includeMinor, setIncludeMinor] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);
  const [view] = useViewTab();

  const people = useMemo(() => timelines.map((t) => ({ id: t.person.id, name: t.person.name })), [timelines]);
  const multi = timelines.length > 1;

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
  const litIds = useMemo(() => new Set(sharedNow.map((film) => film.id)), [sharedNow]);

  const lanes: LaneData[] = useMemo(
    () =>
      timelines.map(({ person, films }) => {
        const visible = includeMinor ? films : films.filter((film) => !film.minor);
        return { person, films: visible, hiddenMinor: films.length - visible.length };
      }),
    [timelines, includeMinor],
  );

  // The checkbox lives under the panels, away from the timeline: ask the timeline to keep the year in the middle first.
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

  // The link opens the default view, so the share text counts the non-minor films, not what the toggle shows.
  const soloFilmCount = timelines[0].films.filter((film) => !film.minor).length;
  // Three or more people: family names only, with the full names on hover.
  const heading = pageHeading(people);
  // The headline's count is the table's: the films they share, or the films listed for one person. It follows the
  // checkbox like the table does; the server renders the default (checkbox off), so the first client render matches.
  const filmCount = headlineCount(multi ? sharedNow.length : soloRows.length);

  const timeline = (
    <Timeline
      ref={timelineRef}
      active={view === "timeline"}
      lanes={lanes}
      people={people}
      litIds={litIds}
      includeMinor={includeMinor}
      today={today}
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8">
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
          today={today}
          timeline={timeline}
          includeMinor={includeMinor}
          onIncludeMinorChange={handleIncludeMinorChange}
          onSelect={handleSelect}
        />
      ) : (
        <FilmsSection
          headingId="films"
          count={soloRows.length}
          together={false}
          rows={soloRows}
          names={[people[0].name]}
          caption={`Films ${people[0].name} worked on`}
          share={{ people, count: soloFilmCount }}
          today={today}
          timeline={timeline}
          includeMinor={includeMinor}
          onIncludeMinorChange={handleIncludeMinorChange}
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
