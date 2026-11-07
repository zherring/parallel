"use client";

import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { DepthPoster } from "@/components/depth/depth-poster";
import type { CombinedFilmInfo } from "@/lib/combined-track";
import { anchorScrollTop, layerDepth, type DepthFilm, type DepthLayout } from "@/lib/depth-layout";
import { joinNames } from "@/lib/format";
import { isReleased } from "@/lib/released";
import { shortName } from "@/lib/short-name";

interface DepthSceneProps {
  /** The scroller, for the rail, the people pill and the focus field to read and drive. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  layout: DepthLayout;
  people: readonly { id: number; name: string }[];
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

/**
 * The scene: a fixed, full-viewport scroller whose only child is a `preserve-3d` element as tall as the whole track.
 * It holds one list per layer, each pushed `translateZ(-Z)` behind the screen plane; every layer lays its posters on the
 * same document axis, so the browser's perspective does the parallax while the page scrolls.
 *
 * What perspective needs, and what would silently break it: nothing inside the scroller is `position: fixed` (perspective
 * turns it absolute), and the `preserve-3d` element has no `overflow`, `opacity` or `filter` (any of them flattens it).
 * The scroller is the one that clips.
 */
export function DepthScene({ scrollerRef, layout, people, info, outsideIds, selectedId, today, onSelect }: DepthSceneProps) {
  const layers = useMemo(() => {
    const byLayer = new Map<number, DepthFilm[]>();
    for (const item of layout.films) {
      const group = byLayer.get(item.layer);
      if (group) group.push(item);
      else byLayer.set(item.layer, [item]);
    }
    return [...byLayer].map(([layer, films]): Layer => ({ layer, films }));
  }, [layout.films]);

  // Open on the first film made together (or where the latest-starting person begins), not at the oldest year.
  const didInitialScroll = useRef(false);
  const { anchorY, trackHeight } = layout;
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || didInitialScroll.current) return;
    didInitialScroll.current = true;
    scroller.scrollTop = anchorScrollTop(anchorY, scroller.clientHeight, trackHeight);
  }, [scrollerRef, anchorY, trackHeight]);

  const coloured = people.length > 1;

  return (
    <div
      ref={scrollerRef}
      role="region"
      aria-label="Film timeline. Scroll down for later years."
      tabIndex={0}
      className="fixed inset-0 z-10 overflow-y-auto overflow-x-hidden overscroll-contain bg-canvas [perspective-origin:50%_50%] [perspective:1000px] focus-visible:outline-offset-[-3px]"
    >
      <div className="relative w-full [transform-style:preserve-3d]" style={{ height: trackHeight }}>
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
                  onSelect={onSelect}
                />
              );
            })}
          </ol>
        ))}
      </div>
    </div>
  );
}
