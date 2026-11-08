"use client";

import { useCallback, useId, useLayoutEffect, useMemo, useRef, type FocusEvent, type PointerEvent, type RefObject } from "react";
import { DepthPoster } from "@/components/depth/depth-poster";
import { useFocusField } from "@/components/depth/use-focus-field";
import { SOFT_WINDOW, usePosterImages } from "@/components/depth/use-poster-images";
import { FilmPopover, useFilmPopover, type PopoverTarget } from "@/components/timeline/film-popover";
import { useDragPan, type DragPanOptions } from "@/components/timeline/use-drag-pan";
import type { CombinedFilmInfo } from "@/lib/combined-track";
import { anchorScrollTop, depthSceneCss, layerDepth, posterFactor, type DepthFilm, type DepthLayout } from "@/lib/depth-layout";
import { inWindow } from "@/lib/depth-projection";
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

/** The scene pans by mouse like the flat timeline, but only up and down, and from posters too (a click still opens one; a drag does not). */
const PAN: DragPanOptions = { interactive: null, axis: "y" };

/** The viewport height (px) the posters that are fetched up front are chosen for: the server does not know the real one. */
const NOMINAL_VIEWPORT_H = 900;

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

/**
 * The box of a film made together's poster with its labels (the title above, the year below, each highlighted line by line), or null for any other poster:
 * the hover card opens below the year, or above the title, and never covers either. A label's box is its lines' boxes: the bands
 * of the highlight are inside it (the line-height is over the band's height), so this is the union of the bands to within a pixel.
 */
function labelledRect(element: HTMLElement): { left: number; top: number; right: number; bottom: number } | null {
  const labels = element.querySelectorAll("[data-poster-caption]");
  if (labels.length === 0) return null;
  const { left, top, right, bottom } = element.getBoundingClientRect();
  const box = { left, top, right, bottom };
  for (const label of labels) {
    const rect = label.getBoundingClientRect();
    box.top = Math.min(box.top, rect.top);
    box.bottom = Math.max(box.bottom, rect.bottom);
  }
  return box;
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
 * same document axis, so the browser's perspective does the parallax while the page scrolls. A poster of a layer behind is
 * pushed further back still, by how obscure its film is (its own `translateZ`, see `DepthPoster`), so a layer's list is
 * `preserve-3d` too: without that it would flatten its posters onto its own plane and the push would do nothing.
 *
 * What perspective needs, and what would silently break it: nothing inside the scroller is `position: fixed` (perspective
 * turns it absolute), and the `preserve-3d` elements (the track and each layer's list) have no `overflow`, `opacity` or `filter` (any of them flattens it).
 * The scroller is the one that clips; it has no background, so the dust motes behind it (`DustMotes`) show through and are never over a
 * poster. Its own scrollbar is hidden: the year rail, pinned over that edge, is the scrollbar.
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

  useFocusField(scrollerRef, layout.films, people.length);
  usePosterImages(scrollerRef, layout.films);

  // The posters whose images are in the markup (see `DepthPoster`'s `eager`): those within the fetch window of where the
  // scene opens, worked out for a nominal viewport so the server and the browser agree. The rest wait for `usePosterImages`.
  const eagerIds = useMemo(() => {
    const top = anchorScrollTop(anchorY, NOMINAL_VIEWPORT_H, trackHeight);
    return new Set(
      layout.films
        .filter((item) => inWindow(item.y, top, NOMINAL_VIEWPORT_H, posterFactor(item), SOFT_WINDOW * NOMINAL_VIEWPORT_H))
        .map((item) => item.film.id),
    );
  }, [layout.films, anchorY, trackHeight]);

  // ---- hover, focus and the film card ---------------------------------------
  const popoverId = useId();
  const { target: popoverTarget, show: showPopover, hide: hidePopover } = useFilmPopover();
  const hoverElement = useRef<HTMLElement | null>(null);
  // A background poster brightens in place while the pointer is on it or it has keyboard focus: full opacity and fully sharp (`data-pinned`
  // on its `li` pins its `--focus` to 1, globals.css, whatever the focus field says). It does not move, grow or come forward: it stays at its own
  // depth, behind any film made together that covers it, and so is only hoverable where it shows.
  const pinned = useCallback((element: HTMLElement, on: boolean) => {
    element.closest("[data-poster]")?.toggleAttribute("data-pinned", on);
  }, []);
  // The hover card anchors to the poster; a film made together, to the poster and the labels over and under it, so the card opens below the year.
  const targetOf = (element: HTMLElement): PopoverTarget => ({ ...popoverTargetOf(element), anchor: () => labelledRect(element) });
  // A mouse drag scrolls the scene (touch keeps its native scrolling); the hover card closes when one starts and none opens under it.
  const { isPanning } = useDragPan(
    scrollerRef,
    useCallback(() => {
      hoverElement.current = null;
      hidePopover();
      scrollerRef.current?.querySelectorAll("[data-pinned]").forEach((poster) => poster.removeAttribute("data-pinned"));
    }, [hidePopover, scrollerRef]),
    PAN,
  );

  const handlePointerOver = (event: PointerEvent<HTMLElement>) => {
    // A finger has no hover: a tap opens the panel.
    if (event.pointerType === "touch" || isPanning()) return;
    const element = filmElement(event.target);
    if (!element) return;
    pinned(element, true);
    if (element === hoverElement.current) return;
    hoverElement.current = element;
    showPopover(targetOf(element), "hover");
  };

  const handlePointerOut = (event: PointerEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (!element || element !== hoverElement.current) return;
    if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
    hoverElement.current = null;
    hidePopover(element);
    // Keyboard focus keeps it bright: it was focused before, or still is.
    if (document.activeElement !== element || !focusIsVisible(element)) pinned(element, false);
  };

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (element && focusIsVisible(element)) {
      pinned(element, true);
      showPopover(targetOf(element), "focus");
    }
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const element = filmElement(event.target);
    if (!element) return;
    hidePopover(element);
    // The pointer may still be on it.
    if (hoverElement.current !== element) pinned(element, false);
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

  // The horizontal spacing of every viewport, as CSS (see `depthSceneCss`): one markup for all of them.
  const sceneCss = useMemo(() => depthSceneCss(people.length), [people.length]);

  return (
    <>
      <style>{sceneCss}</style>
      <div
        ref={scrollerRef}
        id={scrollerId}
        data-depth-scene
        role="region"
        aria-label="Film timeline. Scroll down for later years."
        tabIndex={0}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="fixed inset-0 z-10 cursor-grab overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [perspective-origin:50%_50%] [perspective:1000px] focus-visible:outline-offset-[-3px] data-[panning]:select-none [&[data-panning]_*]:cursor-grabbing!"
      >
        <div className="pointer-events-none relative w-full [transform-style:preserve-3d]" style={{ height: trackHeight }}>
          {layers.map((group) => (
            <ol
              key={group.layer}
              aria-label={layerLabel(group, people)}
              className="absolute inset-x-0 top-0 m-0 list-none p-0 [transform-style:preserve-3d]"
              // Everything but the films several people made is behind the screen plane; they are in front of it (a negative depth).
              // A poster's `--f` (how much smaller it is on screen, for its x: see `depthSceneCss`) is its own: it can be further back than the layer.
              // The z-index is for a browser that flattens the 3D context: the films several people made still paint last.
              style={{
                transform: `translateZ(${-layerDepth(group.layer, people.length)}px)`,
                zIndex: group.layer === 0 ? layers.length : 0,
              }}
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
                    outside={outsideIds.has(film.id)}
                    selected={selectedId === film.id}
                    eager={eagerIds.has(film.id)}
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
