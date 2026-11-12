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
  type RefObject,
} from "react";
import { cn } from "@/components/timeline/cn";
import { MINIMAP_COLOR, syncMinimapColors } from "@/components/timeline/minimap-colors";
import { scrollBehavior } from "@/components/timeline/scroll-behavior";
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
  type MinimapFilm,
  type ScrollGeometry,
} from "@/lib/minimap";
import { centerYear, xForDate, type Scale } from "@/lib/timeline-layout";

/** Pointer travel (px) after which a press on a film dot counts as a drag instead of a click. */
const DOT_DRAG_SLOP = 4;
/** A year label that hangs out to the left of a phone's rail is left out where it would be this far (px) from the top of the screen or less: under the compact bar's gear. */
const LABEL_CLEARANCE_PX = 76;
/** On a phone the year readout stays this long (ms) after the scene last moved, then fades. */
const READOUT_HOLD_MS = 800;

interface YearRailProps {
  /** The scene's scroller; the rail reads and writes its scrollTop. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** id of the scroller, for aria-controls. */
  scrollerId: string;
  scale: Scale;
  /** Height (px) of the scroll area: the rail's dots sit at their film's share of it. */
  trackHeight: number;
  /** Films several people made: green dots you can click. */
  shared: readonly MinimapFilm[];
  /** One mark per other film (coloured when one person made it); shown muted when nothing is shared, so the rail is never empty. */
  ticks: readonly MinimapFilm[];
}

/**
 * The year rail: the minimap turned on its side, pinned to the right edge of the screen. It stands for the whole time
 * axis (oldest at the top); the highlighted window is the part of the document in view, and dragging it (or pressing the
 * rail, or using the keyboard on its handle) scrolls the scene. The year under the scene's focus line, the middle of the
 * screen, is read out beside the window, on the scene's side of the rail and level with the window's centre, so it rides
 * with the window and never lands on the rail's own year labels. On a phone it shows only while the scene moves.
 *
 * The geometry is `src/lib/minimap.ts`'s, unchanged: its helpers are one-dimensional and their "left", "width" and
 * "scrollLeft" are this rail's top, height and scrollTop. Scrolling never re-renders React: the window (the readout rides
 * in it), the readout's text and the ARIA values are written straight to the DOM from a requestAnimationFrame-throttled
 * scroll listener.
 *
 * It is a sibling of the scroller, never inside it: perspective would turn its `fixed` into `absolute`.
 */
export function YearRail({ scrollerRef, scrollerId, scale, trackHeight, shared, ticks }: YearRailProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const scaleRef = useRef(scale);
  const trackHeightRef = useRef(trackHeight);
  const drag = useRef<{ pointerId: number; startY: number; startScrollTop: number; barHeight: number } | null>(null);
  const pendingDot = useRef<{ pointerId: number; startY: number } | null>(null);
  /** Set when a press on a dot became a drag, so the click that follows does not also jump. */
  const suppressClick = useRef(false);
  /** The scrollTop the last sync saw, and the timer that ends the phone readout's time on screen after the scene stops. */
  const lastTop = useRef<number | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);

  const [railHeight, setRailHeight] = useState(0);
  /** A drag is in progress: on a phone the year labels, which are too wide for the thin rail, show while it lasts. */
  const [scrubbing, setScrubbing] = useState(false);

  const readGeometry = useCallback((): ScrollGeometry | null => {
    const scroller = scrollerRef.current;
    if (!scroller) return null;
    // The track is the layout's height, the one the dots are placed by, so a film in the middle of the screen is under
    // the middle of the window whatever the browser makes of the 3D layers' overflow.
    return { scrollLeft: scroller.scrollTop, viewport: scroller.clientHeight, track: trackHeightRef.current };
  }, [scrollerRef]);

  /** Moves the window and the readout to match the scroller. Direct DOM writes: this runs on every scroll frame. */
  const sync = useCallback(() => {
    const box = windowRef.current;
    const geometry = readGeometry();
    if (!box || !geometry) return;
    const rect = windowRect(geometry);
    syncMinimapColors(trackRef.current, rect);
    box.style.top = `${rect.left * 100}%`;
    box.style.height = `${rect.width * 100}%`;
    box.setAttribute("aria-valuenow", String(scrollPercent(geometry)));
    const years = visibleYears(geometry, scaleRef.current);
    box.setAttribute("aria-valuetext", years.from === years.to ? String(years.from) : `${years.from} to ${years.to}`);
    box.setAttribute("data-ready", "");
    // The scene moved: on a phone the readout is shown (`data-active`) until it has been still for a moment.
    const root = rootRef.current;
    if (root && lastTop.current !== null && lastTop.current !== geometry.scrollLeft) {
      root.setAttribute("data-active", "");
      window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => root.removeAttribute("data-active"), READOUT_HOLD_MS);
    }
    lastTop.current = geometry.scrollLeft;
    // Where the readout rides: the window's middle, as a share of the rail (the CSS places it, see the readout below, so that it keeps clear of the bar).
    root?.style.setProperty("--readout-frac", String(rect.left + rect.width / 2));
    const readout = readoutRef.current;
    if (readout) {
      // The calendar year the focus line is in: a film of September 1985 in the middle reads 1985, not 1986.
      const text = String(Math.floor(centerYear(geometry.scrollLeft, geometry.viewport, scaleRef.current)));
      if (readout.textContent !== text) readout.textContent = text;
    }
  }, [readGeometry]);

  useLayoutEffect(() => {
    scaleRef.current = scale;
    trackHeightRef.current = trackHeight;
    sync();
  }, [scale, trackHeight, sync, shared, ticks]);

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

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
      // The track (the scene's tall element), found by its mark rather than as the scroller's first child.
      const track = scroller.querySelector("[data-depth-track]");
      if (track) observer.observe(track);
    }
    schedule();
    return () => {
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollerRef, sync]);

  // The rail's height, for choosing which year labels fit.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setRailHeight(track.clientHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const marks = useMemo(
    () => minimapTicks(scale, { barWidth: railHeight, minLabelGap: 26, labelHalfWidth: 6 }),
    [scale, railHeight],
  );
  const dots = useMemo(
    () => shared.map((film) => ({ film, fraction: dateFraction(scale, film.releaseDate) })).sort((a, b) => a.fraction - b.fraction),
    [shared, scale],
  );
  const tickMarks = useMemo(
    () => ticks.map((film) => ({ fraction: dateFraction(scale, film.releaseDate), color: film.color })),
    [ticks, scale],
  );

  const setScrollTop = (value: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = value;
    sync();
  };

  /**
   * Starts dragging from a press at `clientY`. A press on the rail outside the window first centres the window
   * there, so press-and-drag on the rail behaves like grabbing the window.
   */
  const beginDrag = (pointerId: number, clientY: number) => {
    const track = trackRef.current;
    const box = windowRef.current;
    const geometry = readGeometry();
    if (!track || !box || !geometry) return;

    const rect = track.getBoundingClientRect();
    const windowBox = box.getBoundingClientRect();
    let startScrollTop = geometry.scrollLeft;
    if (clientY < windowBox.top || clientY > windowBox.bottom) {
      startScrollTop = scrollLeftForBarClick(clientY - rect.top, rect.height, geometry.track, geometry.viewport);
      setScrollTop(startScrollTop);
    }
    drag.current = { pointerId, startY: clientY, startScrollTop, barHeight: rect.height };
    track.setPointerCapture(pointerId);
    box.focus({ preventScroll: true });
    setScrubbing(true);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClick.current = false;
    if ((event.target as Element).closest("[data-rail-dot]")) {
      // A press on a film dot is a click (jump to the film) unless it turns into a drag.
      pendingDot.current = { pointerId: event.pointerId, startY: event.clientY };
      return;
    }
    event.preventDefault();
    beginDrag(event.pointerId, event.clientY);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pending = pendingDot.current;
    if (pending && pending.pointerId === event.pointerId && Math.abs(event.clientY - pending.startY) > DOT_DRAG_SLOP) {
      pendingDot.current = null;
      suppressClick.current = true;
      beginDrag(pending.pointerId, pending.startY);
    }

    const scrubbingNow = drag.current;
    const geometry = readGeometry();
    if (!scrubbingNow || scrubbingNow.pointerId !== event.pointerId || !geometry) return;
    setScrollTop(
      dragScrollLeft({
        startScrollLeft: scrubbingNow.startScrollTop,
        deltaPx: event.clientY - scrubbingNow.startY,
        barWidth: scrubbingNow.barHeight,
        track: geometry.track,
        viewport: geometry.viewport,
      }),
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (pendingDot.current?.pointerId === event.pointerId) pendingDot.current = null;
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setScrubbing(false);
    if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
  };

  // The rail is vertical: Up and Down are the minimap's Left and Right.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const geometry = readGeometry();
    if (!geometry) return;
    const key = event.key === "ArrowUp" ? "ArrowLeft" : event.key === "ArrowDown" ? "ArrowRight" : event.key;
    const next = keyboardScrollLeft(key, geometry.scrollLeft, geometry.track, geometry.viewport);
    if (next === null) return;
    event.preventDefault();
    setScrollTop(next);
  };

  const jumpToFilm = (film: MinimapFilm) => {
    const scroller = scrollerRef.current;
    const geometry = readGeometry();
    if (!scroller || !geometry) return;
    const top = scrollLeftToCenterTrackX(xForDate(scaleRef.current, film.releaseDate), geometry.track, geometry.viewport);
    scroller.scrollTo({ top, behavior: scrollBehavior() });
  };

  const showDots = dots.length > 0;

  return (
    <div
      ref={rootRef}
      data-depth-rail
      data-scrubbing={scrubbing ? "" : undefined}
      // Only the track takes pointer events: the gaps above, below and beside it are the scene's.
      className="group/rail pointer-events-none fixed inset-y-0 right-0 z-20 w-[3.75rem] max-sm:w-7"
    >
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        // A touch is captured by what it pressed (a dot, the window) until beginDrag moves the capture to the rail; that
        // hand-over is a lost capture on the child, which bubbles here and must not end the drag it just started.
        onLostPointerCapture={(event) => {
          if (event.target === event.currentTarget) endDrag(event);
        }}
        // Match the bottom minimap's 32px thickness, with the years just outside it. The root still reserves room for those labels.
        // It runs from the top of the screen, whether the pair hero is open or collapsed: the band (see `PeopleBar`) stops short of the rail and the bar's controls are left of
        // it, so nothing of the hero is over it and it is not pushed down by it. Only what hangs out to the left of the rail (the readout, the phone's labels) could meet them: see below.
        className="pointer-events-auto absolute bottom-2 right-1 top-0 w-8 cursor-pointer touch-none select-none rounded-md border border-border bg-surface max-sm:left-0 max-sm:w-auto"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {marks.map((mark) => (
            <span key={mark.year}>
              {mark.decade && (
                <span className="absolute left-0 h-px w-1.5 bg-muted/60" style={{ top: `${mark.fraction * 100}%` }} />
              )}
              {mark.label && (
                <span
                  data-rail-year-label
                  className={cn(
                    "absolute right-full mr-1.5 -translate-y-1/2 text-[9px] leading-none tabular-nums text-muted",
                    // A label that would hang out to the left of the rail under the bar's controls (the rail runs to the top of the screen) is left out.
                    mark.labelX < LABEL_CLEARANCE_PX && "max-sm:hidden!",
                    // Too wide for the thin rail: out beside it, and only while a finger is dragging it.
                    "max-sm:hidden max-sm:rounded max-sm:bg-canvas/90 max-sm:px-1 max-sm:py-0.5 max-sm:group-data-[scrubbing]/rail:block",
                  )}
                  style={{ top: mark.labelX }}
                >
                  {mark.label}
                </span>
              )}
            </span>
          ))}
          {/*
            The one line everything is centred on, near the rail's right edge (the bottom bar's near its top): the coloured
            marks of a film of one person (2 x 8, as in the bar) and, over them, the green nodes of the films several people
            made (4 x 14). Beside the green nodes only the coloured marks stay; with no nodes the rest are muted marks.
          */}
          <div data-rail-line className="absolute inset-y-0 right-[10.5px] w-0">
            {tickMarks.map(({ fraction, color }, index) =>
              color ? (
                <span
                  key={index}
                  data-minimap-fraction={fraction}
                  className={cn("absolute left-0 h-0.5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full", MINIMAP_COLOR)}
                  style={{ top: `${fraction * 100}%`, backgroundColor: color }}
                />
              ) : !showDots ? (
                <span
                  key={index}
                  className="absolute left-0 h-px w-2 -translate-x-1/2 -translate-y-1/2 bg-muted/70"
                  style={{ top: `${fraction * 100}%` }}
                />
              ) : null,
            )}
          </div>
        </div>

        <div
          ref={windowRef}
          role="scrollbar"
          tabIndex={0}
          aria-label="Timeline position"
          aria-orientation="vertical"
          aria-controls={scrollerId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          onKeyDown={onKeyDown}
          className="absolute inset-x-0 top-0 h-full min-h-3 cursor-grab rounded-[5px] border border-strong/70 bg-strong/15 opacity-0 data-[ready]:opacity-100 active:cursor-grabbing"
        >
        </div>

        {/* The nodes sit on the same line as the marks, above the window, and can be pressed to jump to the film. */}
        <div className="pointer-events-none absolute inset-y-0 right-[10.5px] z-10 w-0">
          {dots.map(({ film, fraction }) => (
            <button
              key={film.id}
              type="button"
              data-rail-dot
              data-film={film.id}
              data-minimap-fraction={fraction}
              tabIndex={-1}
              aria-label={`Center the timeline on ${film.title} (${film.year})`}
              title={`${film.title} (${film.year})`}
              onClick={() => {
                if (suppressClick.current) suppressClick.current = false;
                else jumpToFilm(film);
              }}
              className={cn("group pointer-events-auto absolute left-0 flex h-4 w-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center max-sm:w-5", MINIMAP_COLOR)}
              style={{ top: `${fraction * 100}%` }}
            >
              <span className="h-1 w-3.5 rounded-full bg-lit shadow-[0_0_8px_var(--lit-glow)] group-hover:w-4" />
            </button>
          ))}
        </div>
      </div>
      {/*
        The year at the focus line, level with the window's centre (`--readout-frac`, the share of the rail the sync writes) and on the scene's side of the rail
        in the same column as its grey labels, painting over them rather than taking a second column. It is the root's, not the window's, so that it can keep clear of the bar: it never rides higher than 1.25rem under the bar's
        bottom edge (the gear is just left of the rail).
      */}
      <span
        aria-hidden
        data-rail-readout-box
        className={cn(
          "pointer-events-none absolute right-9 mr-1.5 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums text-strong shadow-md shadow-black/30 max-sm:right-full",
          // On a phone: only while the scene moves or the rail is being dragged, fading after.
          "max-sm:px-1 max-sm:text-[10px] max-sm:opacity-0 max-sm:transition-opacity max-sm:duration-300 max-sm:group-data-[active]/rail:opacity-100 max-sm:group-data-[scrubbing]/rail:opacity-100 motion-reduce:transition-none",
        )}
        style={{
          top: "max(calc(0.75rem + var(--bar-h) + 1.25rem), calc(var(--readout-frac, 0) * (100% - 0.5rem)))",
        }}
      >
        <span ref={readoutRef} data-rail-readout />
      </span>
    </div>
  );
}
