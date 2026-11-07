"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DepthScene } from "@/components/depth/depth-scene";
import { FilmPanel } from "@/components/film-panel/film-panel";
import { useUrlPeriod } from "@/components/timeline/use-period";
import { cardFilms } from "@/lib/card-films";
import { combineLanes, describeCombined } from "@/lib/combined-track";
import { DEPTH_VIEW, flatSearch } from "@/lib/depth-url";
import { depthLayout } from "@/lib/depth-layout";
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
      <DepthScene
        scrollerRef={scrollerRef}
        layout={layout}
        people={people}
        info={info}
        outsideIds={outsideIds}
        selectedId={selectedId}
        today={today}
        onSelect={handleSelect}
      />
      <FlatTimelineLink />
      <FilmPanel filmId={selectedId} peopleInView={people} onClose={handleClose} />
    </>
  );
}

/**
 * A way back to the flat timeline, until the people pill (which carries it) exists: the same page without
 * `view=depth`, keeping the period. It is outside the scroller: perspective would turn `fixed` into `absolute`.
 */
function FlatTimelineLink() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <Link
      href={`${pathname}${flatSearch(search)}`}
      prefetch={false}
      className="fixed left-3 top-3 z-30 rounded-md border border-border bg-surface/90 px-3 py-1.5 text-sm font-medium text-strong backdrop-blur hover:bg-surface"
    >
      Flat timeline
    </Link>
  );
}
