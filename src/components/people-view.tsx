"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FilmPanel } from "@/components/film-panel/film-panel";
import { PersonSearch } from "@/components/person-search/person-search";
import { ShareActions } from "@/components/timeline/share-actions";
import { Timeline, type LaneData } from "@/components/timeline/timeline";
import { Together } from "@/components/timeline/together";
import { joinNames } from "@/lib/format";
import { canAddPerson } from "@/lib/lanes";
import { sharedFilms, sharedFilmsPairwise, type PairShared } from "@/lib/shared";
import type { PersonTimeline, SharedFilm } from "@/lib/types";

interface Props {
  timelines: PersonTimeline[];
  /** Films all people share, non-minor credits only. */
  shared: SharedFilm[];
  /** Per-pair shared films; empty unless there are 3 or more people. */
  pairwise: PairShared[];
}

export function PeopleView(props: Props) {
  // A different set of people is a different page: start over (zoom, selection, scroll).
  const key = props.timelines.map((t) => t.person.id).join("+");
  return <PeopleViewInner key={key} {...props} />;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function PeopleViewInner({ timelines, shared, pairwise }: Props) {
  const [includeMinor, setIncludeMinor] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [today] = useState(todayUtc);
  const triggerRef = useRef<HTMLElement | null>(null);

  const people = useMemo(() => timelines.map((t) => ({ id: t.person.id, name: t.person.name })), [timelines]);
  const multi = timelines.length > 1;

  // The server sends the default (non-minor) lists; recompute only when the toggle is on.
  const sharedNow = useMemo(
    () => (includeMinor ? sharedFilms(timelines, { includeMinor: true }) : shared),
    [includeMinor, shared, timelines],
  );
  const pairwiseNow = useMemo(
    () => (includeMinor ? sharedFilmsPairwise(timelines, { includeMinor: true }) : pairwise),
    [includeMinor, pairwise, timelines],
  );
  const minorExtra = useMemo(
    () => (multi && !includeMinor && shared.length === 0 ? sharedFilms(timelines, { includeMinor: true }).length : 0),
    [multi, includeMinor, shared.length, timelines],
  );
  const litIds = useMemo(() => new Set(sharedNow.map((film) => film.id)), [sharedNow]);

  const lanes: LaneData[] = useMemo(
    () =>
      timelines.map(({ person, films }) => {
        const visible = includeMinor ? films : films.filter((film) => !film.minor);
        return { person, films: visible, hiddenMinor: films.length - visible.length };
      }),
    [timelines, includeMinor],
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

  const names = people.map((p) => p.name);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8">
      <h1 className="break-words text-2xl font-semibold text-strong sm:text-3xl">{joinNames(names)}</h1>

      <div className="mt-6">
        <Timeline
          lanes={lanes}
          people={people}
          litIds={litIds}
          includeMinor={includeMinor}
          onIncludeMinorChange={setIncludeMinor}
          today={today}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {canAddPerson(people.length) && (
        <div className="mt-6 max-w-md">
          <p className="mb-2 text-sm font-medium text-strong">Add person</p>
          <PersonSearch peopleInView={people} size="compact" />
        </div>
      )}

      {multi ? (
        <Together people={people} shared={sharedNow} pairwise={pairwiseNow} minorExtra={minorExtra} onSelect={handleSelect}>
          <ShareActions shared={sharedNow} names={names} canExport />
        </Together>
      ) : (
        <div className="mt-8">
          <ShareActions shared={[]} names={names} canExport={false} />
        </div>
      )}

      <FilmPanel filmId={selectedId} peopleInView={people} onClose={handleClose} />
    </div>
  );
}
