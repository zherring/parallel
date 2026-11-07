"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DepthScene } from "@/components/depth/depth-scene";
import { DustMotes } from "@/components/depth/dust-motes";
import { PeoplePill, type PillPerson } from "@/components/depth/people-pill";
import { YearRail } from "@/components/depth/year-rail";
import { FilmPanel } from "@/components/film-panel/film-panel";
import { useUrlPeriod } from "@/components/timeline/use-period";
import { cardFilms } from "@/lib/card-films";
import { combineLanes, combinedMinimapFilms, describeCombined } from "@/lib/combined-track";
import { depthLayout } from "@/lib/depth-layout";
import { DEPTH_VIEW, withDepth } from "@/lib/depth-url";
import { laneSummary, removePersonHref } from "@/lib/lanes";
import { outsidePeriodIds, resolvePeriod, spanOfYears } from "@/lib/period";
import { personColorCss, personSlots } from "@/lib/person-colors";
import type { PairShared } from "@/lib/shared";
import type { PersonTimeline, SharedFilm } from "@/lib/types";

interface Props {
  timelines: PersonTimeline[];
  /** Films all people share (the flat view's headline and table; the Depth view works them out from the lanes). */
  shared: SharedFilm[];
  /** Per-pair shared films; empty unless there are 3 or more people. */
  pairwise: PairShared[];
  /** yyyy-mm-dd (UTC), computed once on the server, so the server and the browser lay the scene out identically. */
  today: string;
}

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

function DepthViewInner({ timelines, today }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollerId = useId();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [urlPeriod] = useUrlPeriod();

  // The scene hides the site's header and footer (see globals.css) for as long as it is on screen.
  useLayoutEffect(() => {
    document.documentElement.dataset.view = DEPTH_VIEW;
    return () => {
      delete document.documentElement.dataset.view;
    };
  }, []);

  const people = useMemo(() => timelines.map((t) => ({ id: t.person.id, name: t.person.name })), [timelines]);
  // Minor credits stay hidden: the scene has no toggle for them.
  const lanes = useMemo(
    () => timelines.map(({ person, films }) => ({ person, films: films.filter((film) => !film.minor) })),
    [timelines],
  );
  const slots = useMemo(() => personSlots(people), [people]);
  const entries = useMemo(() => combineLanes(lanes, slots, today), [lanes, slots, today]);
  const info = useMemo(() => describeCombined(entries, lanes, false), [entries, lanes]);
  const layout = useMemo(() => depthLayout(entries, people.length, today), [entries, people.length, today]);
  // The people pill's rows. Removing someone stays in the Depth view, unless it was the last person (that goes home).
  const pillPeople = useMemo(
    () =>
      lanes.map(({ person, films }): PillPerson => {
        const removeHref = removePersonHref(people, person.id);
        return {
          id: person.id,
          name: person.name,
          profilePath: person.profilePath,
          slot: slots.get(person.id) ?? 0,
          roles: laneSummary(films, person, false).roles,
          filmCount: films.length,
          removeHref: people.length > 1 ? withDepth(removeHref) : removeHref,
        };
      }),
    [lanes, people, slots],
  );
  const railFilms = useMemo(() => combinedMinimapFilms(entries), [entries]);

  // A link to a period dims the films outside it. It is resolved against the films the page's preview card shows,
  // so the server and the browser agree on it (as `PeopleView` does).
  const periodSpan = useMemo(() => spanOfYears(cardFilms(timelines, today).films.map((film) => film.year)), [timelines, today]);
  const period = useMemo(() => resolvePeriod(urlPeriod, periodSpan), [urlPeriod, periodSpan]);
  const outsideIds = useMemo(() => outsidePeriodIds(entries.map((entry) => entry.film), period), [entries, period]);

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

  return (
    <>
      {/* The palette as custom properties (src/lib/person-colors.ts): the hover card and the panel are in portals. */}
      <style>{personColorCss()}</style>
      {/* First in the tab order, as the site's header was; fixed chrome is a sibling of the scroller, never inside it. */}
      <PeoplePill people={pillPeople} scrollerRef={scrollerRef} />
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
