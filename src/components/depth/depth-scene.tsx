"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, type FocusEvent, type PointerEvent, type RefObject } from "react";
import { DepthPoster } from "@/components/depth/depth-poster";
import { useFocusField } from "@/components/depth/use-focus-field";
import { FilmPopover, useFilmPopover, type PopoverTarget } from "@/components/timeline/film-popover";
import type { CombinedFilmInfo } from "@/lib/combined-track";
import { anchorScrollTop, layerDepth, type DepthFilm, type DepthLayout } from "@/lib/depth-layout";
import { filmCardContent } from "@/lib/film-credits";
import { joinNames } from "@/lib/format";
import { personColor } from "@/lib/person-colors";
import { isReleased } from "@/lib/released";
import { shortName } from "@/lib/short-name";

/** A person and their films, as the hover card's credits read them. */
type CardLanes = Parameters<typeof filmCardContent>[1];

interface DepthSceneProps {
  /** The scroller, for the rail, the people pill and the focus field to read and drive. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** id of the scroller, for the rail's aria-controls. */
  scrollerId: string;
  layout: DepthLayout;
  people: readonly { id: number; name: string }[];
  /** Each person's films (minor credits left out), for the hover card's credits. */
  lanes: CardLanes;
  /** Palette slot of each person, by person id. */
  slots: ReadonlyMap<number, number>;
  /** What the combined track tells of each film (roles, note), by film id. */
  info: ReadonlyMap<number, CombinedFilmInfo>;
  /** Films outside the period a link chose. */
  outsideIds: ReadonlySet<number>;
  selectedId: number | null;
  /** yyyy-mm-dd computed on the server; an announced film is an "upcoming" poster. */
  today: string;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

interface Layer {
  layer: number;
  films: DepthFilm[];
}

/** What a screen reader hears of a layer's list. */
function layerLabel({ layer, films }: Layer, people: DepthSceneProps["people"]): string {
  if (layer === 0) {
    const slots = new Set(films.flatMap((item) => item.slots));
    const names = people.filter((_, slot) => slots.has(slot)).map((person) => shortName(person.name, person.id));
    return `Films ${joinNames(names)} made together`;
  }
  const person = people[layer - 1];
  if (!person) return "Films";
  return people.length > 1 ? `${person.name}'s other films` : `Films ${person.name} worked on`;
}

/** The poster a pointer or focus event is on, if any (posters carry `data-film`). */
function filmElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>("[data-film]") : null;
}

function popoverTargetOf(element: HTMLElement): PopoverTarget {
  return { trigger: element, filmId: Number(element.dataset.film), laneIndex: Number(element.dataset.lane) };
}

/** Whether the browser would draw a focus ring on the element: keyboard focus, not a mouse click. */
function focusIsVisible(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * The scene: a fixed, full-viewport scroller whose only child is a `preserve-3d` element as tall as the whole track.
 * It holds one list per layer, each pushed `translateZ(-Z)` behind the screen plane; every layer lays its posters on the
 * same document axis, so the browser's perspective does the parallax while the page scrolls.
 *
 * What perspective needs, and what would silently break it: nothing inside the scroller is `position: fixed` (perspective
 * turns it absolute), and the `preserve-3d` element has no `overflow`, `opacity` or `filter` (any of them flattens it).
 * The scroller is the one that clips. Its own scrollbar is hidden: the year rail, pinned over that edge, is the scrollbar.
 *
 * The 3D element takes no pointer events: it sits at the screen plane, in front of every layer behind it, and as a hit
 * target it would shadow their posters (a poster's button turns them back on).
 *
 * Hover and focus are handled once, on the scroller, for every poster (the film popover is a portal on the body, which
 * is not inside the scroller either). The field of focus that sharpens the soft posters behind is `useFocusField`.
 */
export function DepthScene({ scrollerRef, scrollerId, layout, people, lanes, slots, info, outsideIds, selectedId, today, onSelect }: DepthSceneProps) {
  const layers = useMemo(() => {
    const byLayer = new Map<number, DepthFilm[]>();
    for (const item of layout.films) {
      const group = byLayer.get(item.layer);
      if (group) group.push(item);
      else byLayer.set(item.layer, [item]);
    }
    return [...byLayer].map(([layer, films]): Layer => ({ layer, films }));
  }, [layout.films]);
  const byId = useMemo(() => new Map(layout.films.map((item) => [item.film.id, item])), [layout.films]);

  // Open on the first film made together (or where the latest-starting person begins), not at the oldest year.
  const didInitialScroll = useRef(false);
  const { anchorY, trackHeight } = layout;
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || didInitialScroll.current) return;
    didInitialScroll.current = true;
    scroller.scrollTop = anchorScrollTop(anchorY, scroller.clientHeight, trackHeight);
  }, [scrollerRef, anchorY, trackHeight]);

  useFocusField(scrollerRef, layout.films, layout.hasShared);

  // ---- hover, focus and the film card ---------------------------------------
  const popoverId = useId();
  const { target: popoverTarget, show: showPopover, hide: hidePopover } = useFilmPopover();
  const hoverElement = useRef<HTMLElement | null>(null);

  const handlePointerOver = (event: PointerEvent<HTMLElement>) => {
    // A finger has no hover: a tap opens the panel.
    if (event.pointerType === "touch") return;
    const element = filmElement(event.target);
    if (!element || element === hoverElement.current) return;
    hoverElement.current = element;
    showPopover(popoverTargetOf(element), "hover");
  };

  const handlePointerOut = (event: PointerEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (!element || element !== hoverElement.current) return;
    if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
    hoverElement.current = null;
    hidePopover(element);
  };

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (element && focusIsVisible(element)) showPopover(popoverTargetOf(element), "focus");
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (element) hidePopover(element);
  };

  // Opening the film panel closes the hover card, whether it was a click or Enter.
  const handleSelect = useCallback(
    (id: number, trigger: HTMLElement) => {
      hidePopover();
      onSelect(id, trigger);
    },
    [hidePopover, onSelect],
  );

  const popoverContent = useMemo(
    () => (popoverTarget ? filmCardContent(popoverTarget.filmId, lanes, { includeMinor: false }) : null),
    [popoverTarget, lanes],
  );

  const coloured = people.length > 1;
  // Only with several people: one person's page has no colours to tell apart.
  const colorOf = useMemo(
    () => (coloured ? (personId: number) => personColor(slots.get(personId) ?? 0) : undefined),
    [coloured, slots],
  );

  return (
    <>
      <div
        ref={scrollerRef}
        id={scrollerId}
        role="region"
        aria-label="Film timeline. Scroll down for later years."
        tabIndex={0}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="fixed inset-0 z-10 overflow-y-auto overflow-x-hidden overscroll-contain bg-canvas [scrollbar-width:none] [perspective-origin:50%_50%] [perspective:1000px] focus-visible:outline-offset-[-3px]"
      >
        <div className="pointer-events-none relative w-full [transform-style:preserve-3d]" style={{ height: trackHeight }}>
          {layers.map((group) => (
            <ol
              key={group.layer}
              aria-label={layerLabel(group, people)}
              className="absolute inset-x-0 top-0 m-0 list-none p-0"
              style={{ transform: `translateZ(${-layerDepth(group.layer)}px)` }}
            >
              {group.films.map((item) => {
                const film = item.film;
                const about = info.get(film.id);
                return (
                  <DepthPoster
                    key={film.id}
                    item={item}
                    roles={about?.roles ?? ""}
                    note={about?.note ?? ""}
                    upcoming={!isReleased(film.releaseDate, today)}
                    coloured={coloured}
                    hasShared={layout.hasShared}
                    outside={outsideIds.has(film.id)}
                    selected={selectedId === film.id}
                    describedBy={popoverTarget && popoverContent && popoverTarget.filmId === film.id ? popoverId : undefined}
                    onSelect={handleSelect}
                  />
                );
              })}
            </ol>
          ))}
        </div>
      </div>
      {popoverTarget && popoverContent && (
        <FilmPopover
          id={popoverId}
          target={popoverTarget}
          content={popoverContent}
          lit={byId.get(popoverTarget.filmId)?.shared ?? false}
          colorOf={colorOf}
          today={today}
          onDismiss={hidePopover}
        />
      )}
    </>
  );
}
