"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  dateFraction,
  dragScrollLeft,
  keyboardScrollLeft,
  minimapTicks,
  scrollLeftForBarClick,
  scrollLeftToCenterTrackX,
  scrollPercent,
  visibleYears,
  windowRect,
  type ScrollGeometry,
} from "@/lib/minimap";
import { xForDate, type Scale } from "@/lib/timeline-layout";
import { cn } from "./cn";
import { scrollBehavior } from "./scroll-behavior";

/** Pointer travel (px) after which a press on a film node counts as a drag instead of a click. */
const NODE_DRAG_SLOP = 4;

export interface MinimapFilm {
  id: number;
  title: string;
  year: number;
  releaseDate: string;
}

interface MinimapBarProps {
  /** The timeline's scrolling container; the minimap reads and writes its scrollLeft. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** The sticky lane-header corner, whose width is hidden under the header and not part of the track. */
  cornerRef: RefObject<HTMLDivElement | null>;
  /** id of the scroller, for aria-controls. */
  scrollerId: string;
  scale: Scale;
  /** Films shared by every lane: green nodes you can click (2+ lanes). */
  sharedFilms: MinimapFilm[];
  /** Muted ticks, one per film; shown when there are no shared films so the bar is never empty. */
  filmTicks: MinimapFilm[];
  /** Rendered at the left end of the bar's row, before the track (the lane avatars). */
  leading?: ReactNode;
  /** Rendered at the right end of the bar's row (the zoom controls). */
  children?: ReactNode;
}

/**
 * Sticky overview bar under the timeline, pinned to the bottom of the viewport. It stands for the whole time axis; the highlighted
 * window is the part currently visible, and dragging it (or clicking the bar, or using the
 * keyboard on the handle) scrolls the timeline.
 *
 * Scrolling never re-renders React: the window is moved by writing its style directly from a
 * requestAnimationFrame-throttled scroll listener.
 */
export function MinimapBar({
  scrollerRef,
  cornerRef,
  scrollerId,
  scale,
  sharedFilms,
  filmTicks,
  leading,
  children,
}: MinimapBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  const drag = useRef<{ pointerId: number; startX: number; startScrollLeft: number; barWidth: number } | null>(null);
  const pendingNode = useRef<{ pointerId: number; startX: number } | null>(null);
  /** Set when a press on a node became a drag, so the click that may follow does not also jump. */
  const suppressClick = useRef(false);

  const [barWidth, setBarWidth] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const [stuck, setStuck] = useState(false);

  const readGeometry = useCallback((): ScrollGeometry | null => {
    const scroller = scrollerRef.current;
    if (!scroller) return null;
    const inset = cornerRef.current?.offsetWidth ?? 0;
    return {
      scrollLeft: scroller.scrollLeft,
      viewport: Math.max(0, scroller.clientWidth - inset),
      track: Math.max(0, scroller.scrollWidth - inset),
    };
  }, [scrollerRef, cornerRef]);

  /** Moves the window to match the scroller. Direct DOM writes: this runs on every scroll frame. */
  const sync = useCallback(() => {
    const box = windowRef.current;
    const geometry = readGeometry();
    if (!box || !geometry) return;
    const rect = windowRect(geometry);
    box.style.left = `${rect.left * 100}%`;
    box.style.width = `${rect.width * 100}%`;
    box.setAttribute("aria-valuenow", String(scrollPercent(geometry)));
    const years = visibleYears(geometry, scaleRef.current);
    box.setAttribute("aria-valuetext", years.from === years.to ? String(years.from) : `${years.from} to ${years.to}`);
  }, [readGeometry]);

  // The scale changes with zoom and the minor toggle, which resizes the scroller's content.
  useLayoutEffect(() => {
    scaleRef.current = scale;
    sync();
  }, [scale, sync]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      observer.observe(scroller);
      if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    }
    schedule();
    return () => {
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollerRef, sync]);

  // Bar width, for choosing which year labels fit.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setBarWidth(Math.round(track.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  // The bar's own height: how far up from the viewport's bottom edge it needs to be fully in view.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => setBarHeight(Math.round(bar.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // Border and shadow only while pinned to the bottom of the viewport: a sentinel at the bar's
  // natural place (just above it) is below the viewport's bottom edge, less the bar's height,
  // exactly while the bar has been pushed up from where it would rest under the timeline.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || barHeight === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top > 0),
      { rootMargin: `0px 0px -${barHeight}px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [barHeight]);

  const ticks = useMemo(() => minimapTicks(scale, { barWidth }), [scale, barWidth]);
  const sharedNodes = useMemo(
    () => sharedFilms.map((film) => ({ film, fraction: dateFraction(scale, film.releaseDate) })).sort((a, b) => a.fraction - b.fraction),
    [sharedFilms, scale],
  );
  const tickMarks = useMemo(() => filmTicks.map((film) => dateFraction(scale, film.releaseDate)), [filmTicks, scale]);

  const setScrollLeft = (value: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollLeft = value;
    sync();
  };

  /**
   * Starts dragging from a press at `clientX`. A press on the bar outside the window first
   * centres the window there, so click-and-drag on the bar behaves like grabbing the window.
   */
  const beginDrag = (pointerId: number, clientX: number) => {
    const track = trackRef.current;
    const box = windowRef.current;
    const geometry = readGeometry();
    if (!track || !box || !geometry) return;

    const rect = track.getBoundingClientRect();
    const windowBox = box.getBoundingClientRect();
    let startScrollLeft = geometry.scrollLeft;
    if (clientX < windowBox.left || clientX > windowBox.right) {
      startScrollLeft = scrollLeftForBarClick(clientX - rect.left, rect.width, geometry.track, geometry.viewport);
      setScrollLeft(startScrollLeft);
    }
    drag.current = { pointerId, startX: clientX, startScrollLeft, barWidth: rect.width };
    track.setPointerCapture(pointerId);
    box.focus({ preventScroll: true });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClick.current = false;
    if ((event.target as Element).closest("[data-minimap-node]")) {
      // A press on a film node is a click (jump to the film) unless it turns into a drag.
      pendingNode.current = { pointerId: event.pointerId, startX: event.clientX };
      return;
    }
    event.preventDefault();
    beginDrag(event.pointerId, event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pending = pendingNode.current;
    if (pending && pending.pointerId === event.pointerId && Math.abs(event.clientX - pending.startX) > NODE_DRAG_SLOP) {
      pendingNode.current = null;
      suppressClick.current = true;
      beginDrag(pending.pointerId, pending.startX);
    }

    const state = drag.current;
    const geometry = readGeometry();
    if (!state || state.pointerId !== event.pointerId || !geometry) return;
    setScrollLeft(
      dragScrollLeft({
        startScrollLeft: state.startScrollLeft,
        deltaPx: event.clientX - state.startX,
        barWidth: state.barWidth,
        track: geometry.track,
        viewport: geometry.viewport,
      }),
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (pendingNode.current?.pointerId === event.pointerId) pendingNode.current = null;
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (trackRef.current?.hasPointerCapture(event.pointerId)) trackRef.current.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const geometry = readGeometry();
    if (!geometry) return;
    const next = keyboardScrollLeft(event.key, geometry.scrollLeft, geometry.track, geometry.viewport);
    if (next === null) return;
    event.preventDefault();
    setScrollLeft(next);
  };

  const jumpToFilm = (film: MinimapFilm) => {
    const scroller = scrollerRef.current;
    const geometry = readGeometry();
    if (!scroller || !geometry) return;
    const left = scrollLeftToCenterTrackX(xForDate(scaleRef.current, film.releaseDate), geometry.track, geometry.viewport);
    scroller.scrollTo({ left, behavior: scrollBehavior() });
  };

  const showNodes = sharedNodes.length > 0;

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="-mb-px h-px" />
      <div
        ref={barRef}
        data-minimap-bar
        className={cn(
          // The bar is rendered after the timeline and pins to the bottom of the viewport while any of the timeline is on
          // screen, resting right under it otherwise. Opaque, above the lanes and below the film panel and hover card.
          "sticky bottom-0 z-30 -mx-4 flex items-center gap-3 bg-canvas px-4 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5",
          stuck ? "border-t border-border shadow-[0_-8px_10px_-8px_rgb(0_0_0/0.8)]" : "border-t border-transparent",
        )}
      >
        {leading}
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
          className="relative h-9 min-w-0 flex-1 cursor-pointer touch-pan-y select-none rounded-md border border-border bg-surface sm:h-8"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {ticks.map((tick) => (
              <span key={tick.year}>
                {tick.decade && (
                  <span className="absolute bottom-0 h-1.5 w-px bg-muted/60" style={{ left: `${tick.fraction * 100}%` }} />
                )}
                {tick.label && (
                  <span
                    className="absolute bottom-1.5 -translate-x-1/2 text-[9px] leading-none tabular-nums text-muted"
                    style={{ left: tick.labelX }}
                  >
                    {tick.label}
                  </span>
                )}
              </span>
            ))}
            {!showNodes &&
              tickMarks.map((fraction, index) => (
                <span
                  key={index}
                  className="absolute top-1.5 h-2 w-px bg-muted/70"
                  style={{ left: `${fraction * 100}%` }}
                />
              ))}
          </div>

          <div
            ref={windowRef}
            role="scrollbar"
            tabIndex={0}
            aria-label="Timeline position"
            aria-orientation="horizontal"
            aria-controls={scrollerId}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
            onKeyDown={onKeyDown}
            className="absolute inset-y-0 left-0 w-full min-w-3 cursor-grab touch-none rounded-[5px] border border-strong/70 bg-strong/15 active:cursor-grabbing"
          />

          {showNodes &&
            sharedNodes.map(({ film, fraction }) => (
              <button
                key={film.id}
                type="button"
                data-minimap-node
                tabIndex={-1}
                aria-label={`Center the timeline on ${film.title} (${film.year})`}
                title={`${film.title} (${film.year})`}
                onClick={() => {
                  if (suppressClick.current) suppressClick.current = false;
                  else jumpToFilm(film);
                }}
                className="group absolute top-0 z-10 flex h-[62%] w-4 -translate-x-1/2 cursor-pointer items-center justify-center"
                style={{ left: `${fraction * 100}%` }}
              >
                <span className="size-2 rounded-full bg-lit shadow-[0_0_6px_var(--lit-glow)] ring-1 ring-canvas group-hover:scale-125" />
              </button>
            ))}
        </div>
        {children}
      </div>
    </>
  );
}
