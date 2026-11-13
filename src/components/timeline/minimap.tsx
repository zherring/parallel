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
  type MinimapFilm,
  type ScrollGeometry,
} from "@/lib/minimap";
import type { Period, YearSpan } from "@/lib/period";
import {
  BRUSH_HANDLE_HIT,
  BRUSH_SLOP,
  bandFractions,
  brushLabel,
  brushTarget,
  commitPeriod,
  createPeriod,
  deltaYears,
  keyboardPeriod,
  movePeriod,
  resizePeriod,
  samePeriod,
  viewportExtent,
  yearAtX,
  type BrushEdge,
  type Extent,
} from "@/lib/period-brush";
import { xForDate, type Scale } from "@/lib/timeline-layout";
import { cn } from "./cn";
import { MINIMAP_COLOR, syncMinimapColors } from "./minimap-colors";
import { scrollBehavior } from "./scroll-behavior";
import { requestShareMenu } from "./share-event";

/** Pointer travel (px) after which a press on a film node counts as a drag instead of a click. */
const NODE_DRAG_SLOP = 4;

/**
 * The period brush (drag on the minimap to pick the years to share) is parked: the minimap is only a scrubber for now, because
 * letting one strip both scrub the timeline and subselect a view is more trouble than it is worth yet. Everything the brush
 * does lives behind this flag; set it to true and the minimap is a range selector again, exactly as it was.
 */
export const MINIMAP_BRUSH_ENABLED = false;

/** The height (px) of the compact bar (`compact`): its 1px border, 4px over the track, the 20px track and 5px under it. */
export const COMPACT_MINIMAP_HEIGHT = 30;

/** The period brush: what the bar needs to let a visitor pick the years to share by dragging on it. */
export interface MinimapBrush {
  /** First and last year of the films a period is cut from; the brush stays inside it. Null without films: no brush. */
  span: YearSpan | null;
  /** The chosen period (the page's `?from=&to=`), or null for none. */
  period: Period | null;
  /** The year of each film the card shows, for the live label's film count. */
  years: readonly number[];
  /** Called with the period a drag (or a key) ends on; null when it covers every year or was cleared. */
  onChange: (next: Period | null) => void;
}

/** A drag in progress on the band or on a new one. `origin` is the period when it began. */
type Gesture =
  | { kind: "create"; pointerId: number; left: number; width: number; anchorYear: number }
  | { kind: "move" | "start" | "end"; pointerId: number; left: number; width: number; startX: number; origin: Period };

/** Half the width of the live label, to keep its middle clear of the bar's ends. */
const LABEL_HALF = 104;

const toExtent = (band: { left: number; right: number }, width: number): Extent => ({
  left: band.left * width,
  right: band.right * width,
});

interface MinimapBarProps {
  /** The timeline's scrolling container; the minimap reads and writes its scrollLeft. */
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** The axis's left spacer: the sticky lane header (none on the combined track, which is everyone's). */
  cornerRef: RefObject<HTMLDivElement | null>;
  /** id of the scroller, for aria-controls. */
  scrollerId: string;
  scale: Scale;
  /** Films shared by every lane: green nodes you can click (2+ lanes). */
  sharedFilms: MinimapFilm[];
  /** Ticks, one per film (muted unless a film has a colour); shown when there are no shared films so the bar is never empty. */
  filmTicks: MinimapFilm[];
  /** The period brush; without it the bar is only a scrollbar. */
  brush?: MinimapBrush;
  /** The bar is at the bottom of a screen-high panel (the flat Timeline's): always the pinned look, with its border and shadow, whatever the page does. */
  pinned?: boolean;
  /**
   * The strip a frame in a post (the pair embed) draws: a thin track with no year labels, the bar's padding trimmed to the frame's gutter, and no safe-area
   * inset (a frame has no screen edge). It is `COMPACT_MINIMAP_HEIGHT` tall in all, so that the frame can fit the track above it.
   */
  compact?: boolean;
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
 * With a `brush` it is also a range selector, like the one under a stock chart, for choosing the
 * years to share: dragging on the bar outside the window sweeps out a band from the year pressed to
 * the year released, the band has a handle on each end (resize) and drags by its body (move), and
 * it is the page's period (`?from=&to=`). The window keeps scrolling when it is dragged; a plain click
 * outside it still centres it there (that now happens on release, since a press may start a band).
 * Shift-drag sweeps a band even over the window, for when the window fills most of the bar. While a
 * band is dragged it is only a preview here; the period is written once, on release. The timeline
 * itself never moves for it.
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
  brush: brushProp,
  pinned = false,
  compact = false,
  leading,
  children,
}: MinimapBarProps) {
  // Parked (see MINIMAP_BRUSH_ENABLED): with no brush the bar is the plain scrollbar it was before the brush.
  const brush = MINIMAP_BRUSH_ENABLED ? brushProp : undefined;
  const trackRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  const drag = useRef<{ pointerId: number; startX: number; startScrollLeft: number; barWidth: number } | null>(null);
  const pendingNode = useRef<{ pointerId: number; startX: number } | null>(null);
  /** Set when a press on a node became a drag, so the click that may follow does not also jump. */
  const suppressClick = useRef(false);
  const startHandleRef = useRef<HTMLDivElement>(null);
  const endHandleRef = useRef<HTMLDivElement>(null);
  /** A press that may become a new band (outside the window) or a move of the band, once it travels BRUSH_SLOP. */
  const pendingBrush = useRef<{ pointerId: number; startX: number; kind: "create" | "move"; onNode: boolean } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const previewRef = useRef<Period | null>(null);
  const periodRef = useRef<Period | null>(null);
  const spanRef = useRef<YearSpan | null>(null);
  const onChangeRef = useRef<MinimapBrush["onChange"] | null>(null);

  /** The band while it is being dragged; the period itself is only written on release. */
  const [preview, setPreview] = useState<Period | null>(null);
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
    syncMinimapColors(trackRef.current, rect);
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
  }, [scale, sync, sharedFilms, filmTicks]);

  const span = brush?.span ?? null;
  const period = brush?.period ?? null;
  const onChange = brush?.onChange;
  // What the handlers below read: they are bound to the DOM events, so they read the latest through refs.
  useLayoutEffect(() => {
    periodRef.current = period;
    spanRef.current = span;
    onChangeRef.current = onChange ?? null;
  }, [period, span, onChange]);

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
  const tickMarks = useMemo(
    () => filmTicks.map((film) => ({ fraction: dateFraction(scale, film.releaseDate), color: film.color })),
    [filmTicks, scale],
  );

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

  // ---- The brush ------------------------------------------------------------

  /** Shows (or, with null, drops) the band being dragged. The ref is what the release reads. */
  const showPreview = (next: Period | null) => {
    previewRef.current = next;
    setPreview(next);
  };

  /** Writes a finished band: null when it covers every year (no period). Focus follows to where the band's controls are. */
  const commit = (next: Period) => {
    const currentSpan = spanRef.current;
    if (!currentSpan) return;
    const committed = commitPeriod(next, currentSpan);
    if (!samePeriod(committed, periodRef.current)) onChangeRef.current?.(committed);
    // The handles exist once the period has been written and the bar re-rendered.
    requestAnimationFrame(() => (committed ? endHandleRef.current : windowRef.current)?.focus({ preventScroll: true }));
  };

  /** Ends the drag in progress. The band is written only when the pointer was released on it, never when the gesture was cancelled. */
  const finishGesture = (write: boolean) => {
    const next = previewRef.current;
    gesture.current = null;
    pendingBrush.current = null;
    showPreview(null);
    if (write && next) commit(next);
  };

  const startGesture = (next: Gesture) => {
    gesture.current = next;
    trackRef.current?.setPointerCapture(next.pointerId);
  };

  /** The band for the pointer at `clientX`, from the gesture that is in progress. */
  const bandFor = (state: Gesture, clientX: number): Period | null => {
    const currentSpan = spanRef.current;
    if (!currentSpan) return null;
    const scaleNow = scaleRef.current;
    if (state.kind === "create") {
      return createPeriod(state.anchorYear, yearAtX(scaleNow, clientX - state.left, state.width), currentSpan);
    }
    const delta = deltaYears(scaleNow, clientX - state.startX, state.width);
    if (state.kind === "move") return movePeriod(state.origin, delta, currentSpan);
    return resizePeriod(state.origin, state.kind, delta, currentSpan);
  };

  // Escape while dragging puts the band back as it was.
  const dragging = preview !== null;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const state = gesture.current;
      finishGesture(false);
      if (state && trackRef.current?.hasPointerCapture(state.pointerId)) trackRef.current.releasePointerCapture(state.pointerId);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // finishGesture only touches refs and the state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClick.current = false;
    const onNode = (event.target as Element).closest("[data-minimap-node]") !== null;

    const track = trackRef.current;
    const geometry = readGeometry();
    if (brush && span && track && geometry) {
      const rect = track.getBoundingClientRect();
      const currentPeriod = periodRef.current;
      const target = brushTarget({
        x: event.clientX - rect.left,
        selection: currentPeriod ? toExtent(bandFractions(scaleRef.current, currentPeriod), rect.width) : null,
        viewport: viewportExtent(windowRect(geometry), rect.width),
        forceCreate: event.shiftKey,
      });
      if (target === "start" || target === "end") {
        // A handle: resize at once, there is no click to keep.
        event.preventDefault();
        if (!currentPeriod) return;
        startGesture({ kind: target, pointerId: event.pointerId, left: rect.left, width: rect.width, startX: event.clientX, origin: currentPeriod });
        showPreview(currentPeriod);
        (target === "start" ? startHandleRef : endHandleRef).current?.focus({ preventScroll: true });
        return;
      }
      if (target === "move" || target === "create") {
        // The band's body, or the bar outside the window: a drag from here makes or moves a band, a click stays a click.
        pendingBrush.current = { pointerId: event.pointerId, startX: event.clientX, kind: target, onNode };
        if (!onNode) {
          event.preventDefault();
          track.setPointerCapture(event.pointerId);
        }
        return;
      }
    }

    // The window (or a bar without a brush): scroll, as the minimap always did.
    if (onNode) {
      // A press on a film node is a click (jump to the film) unless it turns into a drag.
      pendingNode.current = { pointerId: event.pointerId, startX: event.clientX };
      return;
    }
    event.preventDefault();
    beginDrag(event.pointerId, event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const waiting = pendingBrush.current;
    if (waiting && waiting.pointerId === event.pointerId && track && Math.abs(event.clientX - waiting.startX) > BRUSH_SLOP) {
      pendingBrush.current = null;
      suppressClick.current = true;
      const rect = track.getBoundingClientRect();
      const origin = periodRef.current;
      if (waiting.kind === "create") {
        startGesture({
          kind: "create",
          pointerId: waiting.pointerId,
          left: rect.left,
          width: rect.width,
          anchorYear: yearAtX(scaleRef.current, waiting.startX - rect.left, rect.width),
        });
      } else if (origin) {
        startGesture({ kind: "move", pointerId: waiting.pointerId, left: rect.left, width: rect.width, startX: waiting.startX, origin });
      }
    }

    const state = gesture.current;
    if (state && state.pointerId === event.pointerId) {
      // The release was missed (the pointer went up outside the window or the browser lost it): treat it as a release.
      if (event.pointerType === "mouse" && event.buttons === 0) {
        finishGesture(true);
        if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
        return;
      }
      const next = bandFor(state, event.clientX);
      if (next) showPreview(next);
      return;
    }

    const pending = pendingNode.current;
    if (pending && pending.pointerId === event.pointerId && Math.abs(event.clientX - pending.startX) > NODE_DRAG_SLOP) {
      pendingNode.current = null;
      suppressClick.current = true;
      beginDrag(pending.pointerId, pending.startX);
    }

    const scrolling = drag.current;
    const geometry = readGeometry();
    if (!scrolling || scrolling.pointerId !== event.pointerId || !geometry) return;
    setScrollLeft(
      dragScrollLeft({
        startScrollLeft: scrolling.startScrollLeft,
        deltaPx: event.clientX - scrolling.startX,
        barWidth: scrolling.barWidth,
        track: geometry.track,
        viewport: geometry.viewport,
      }),
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const released = event.type === "pointerup";

    const waiting = pendingBrush.current;
    if (waiting?.pointerId === event.pointerId) {
      pendingBrush.current = null;
      // A press and release with no drag outside the window is a click: centre the window there, as before.
      // (On a film node the node's own click jumps to the film instead.)
      if (released && waiting.kind === "create" && !waiting.onNode && track) {
        const rect = track.getBoundingClientRect();
        const geometry = readGeometry();
        if (geometry) setScrollLeft(scrollLeftForBarClick(event.clientX - rect.left, rect.width, geometry.track, geometry.viewport));
      }
      if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      return;
    }

    const state = gesture.current;
    if (state?.pointerId === event.pointerId) {
      finishGesture(released);
      if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      return;
    }

    if (pendingNode.current?.pointerId === event.pointerId) pendingNode.current = null;
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (track?.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
  };

  /** Keys on one of the band's handles: arrows move the edge (Shift: five years), Home and End as far as it goes. */
  const onHandleKeyDown = (edge: BrushEdge) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || !span || !period) return;
    const next = keyboardPeriod(event.key, event.shiftKey, edge, period, span);
    if (!next) return;
    event.preventDefault();
    commit(next);
  };

  /** Escape on anything in the bar takes the period away. */
  const onBarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !period || gesture.current) return;
    event.preventDefault();
    onChangeRef.current?.(null);
    windowRef.current?.focus({ preventScroll: true });
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

  // The band shown: the one being dragged, else the chosen period.
  const shownPeriod = brush && span ? (preview ?? period) : null;
  const band = shownPeriod ? bandFractions(scale, shownPeriod) : null;
  // The label sits over the middle of the band, kept clear of the bar's ends.
  const labelHalf = Math.min(LABEL_HALF, barWidth / 2);
  const labelLeft = band ? Math.min(Math.max(((band.left + band.right) / 2) * barWidth, labelHalf), Math.max(labelHalf, barWidth - labelHalf)) : 0;

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="-mb-px h-px" />
      <div
        ref={barRef}
        data-minimap-bar
        onKeyDown={brush ? onBarKeyDown : undefined}
        className={cn(
          // The bar is rendered after the timeline, at the bottom of the screen-high panel the timeline is (pinned), and so stuck to the bottom of the viewport.
          // Opaque, above the lanes and below the film panel and hover card; the page's gutter (12px) at each side.
          "z-30 flex items-center bg-canvas",
          // The compact strip is the last row of the frame's own column, never stuck to a screen's bottom edge: its frame is drawn at a scale (the pair embed), where a sticky offset would be in the wrong pixels.
          compact ? "relative box-border h-[30px] gap-2 px-[var(--embed-gutter,0.75rem)] pb-[5px] pt-1" : "sticky bottom-0 gap-3 px-3 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5",
          pinned || stuck ? "border-t border-border shadow-[0_-8px_10px_-8px_rgb(0_0_0/0.8)]" : "border-t border-transparent",
        )}
      >
        {leading}
        <div className="relative min-w-0 flex-1">
          <div
            ref={trackRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            title={brush && span ? "Drag to choose a period to share" : undefined}
            className={cn(
              "relative w-full select-none rounded-md border border-border bg-surface",
              compact ? "h-5" : "h-9 sm:h-8",
              // With the brush every press is a pointer gesture of ours (a band, a handle, the window), so the browser
              // must not scroll the page or zoom from a touch that starts here.
              brush && span ? "cursor-crosshair touch-none" : "cursor-pointer touch-pan-y",
            )}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {ticks.map((tick) => (
                <span key={tick.year}>
                  {tick.decade && !compact && (
                    <span className="absolute bottom-0 h-1.5 w-px bg-muted/60" style={{ left: `${tick.fraction * 100}%` }} />
                  )}
                  {tick.label && !compact && (
                    <span
                      className="absolute bottom-1.5 -translate-x-1/2 text-[9px] leading-none tabular-nums text-muted"
                      style={{ left: tick.labelX }}
                    >
                      {tick.label}
                    </span>
                  )}
                </span>
              ))}
              {/* Beside the green nodes only the coloured ticks stay (the combined timeline's films of one person). */}
              {tickMarks.map(({ fraction, color }, index) =>
                color ? (
                  <span
                    key={index}
                    data-minimap-fraction={fraction}
                    className={cn("absolute top-1.5 h-2 w-0.5 -translate-x-1/2 rounded-full", MINIMAP_COLOR)}
                    style={{ left: `${fraction * 100}%`, backgroundColor: color }}
                  />
                ) : !showNodes ? (
                  <span
                    key={index}
                    className="absolute top-1.5 h-2 w-px bg-muted/70"
                    style={{ left: `${fraction * 100}%` }}
                  />
                ) : null,
              )}
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
                  data-minimap-fraction={fraction}
                  tabIndex={-1}
                  aria-label={`Center the timeline on ${film.title} (${film.year})`}
                  title={`${film.title} (${film.year})`}
                  onClick={() => {
                    if (suppressClick.current) suppressClick.current = false;
                    else jumpToFilm(film);
                  }}
                  className={cn("group absolute top-0 z-10 flex w-4 -translate-x-1/2 cursor-pointer items-center justify-center", compact ? "h-full" : "h-[62%]", MINIMAP_COLOR)}
                  style={{ left: `${fraction * 100}%` }}
                >
                  <span className={cn("w-1 rounded-full bg-lit shadow-[0_0_8px_var(--lit-glow)]", compact ? "h-3" : "h-3.5 group-hover:h-4")} />
                </button>
              ))}

            {brush && span && shownPeriod && band && (
              <>
                {/* The band: a tint over the years, with a handle on each edge (the handles are the controls; the band is a body to grab). */}
                <div
                  aria-hidden
                  className="absolute inset-y-0 z-[5] cursor-move border-y border-accent-green/70 bg-accent-green/25"
                  style={{ left: `${band.left * 100}%`, width: `${(band.right - band.left) * 100}%` }}
                />
                {(["start", "end"] as const).map((edge) => (
                  <div
                    key={edge}
                    ref={edge === "start" ? startHandleRef : endHandleRef}
                    role="slider"
                    tabIndex={0}
                    aria-label={edge === "start" ? "Period start year" : "Period end year"}
                    aria-orientation="horizontal"
                    aria-valuemin={edge === "start" ? span.first : shownPeriod.from}
                    aria-valuemax={edge === "start" ? shownPeriod.to : span.last}
                    aria-valuenow={edge === "start" ? shownPeriod.from : shownPeriod.to}
                    aria-valuetext={String(edge === "start" ? shownPeriod.from : shownPeriod.to)}
                    onKeyDown={onHandleKeyDown(edge)}
                    className="group absolute inset-y-0 z-20 flex -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
                    style={{ left: `${(edge === "start" ? band.left : band.right) * 100}%`, width: BRUSH_HANDLE_HIT }}
                  >
                    {/* The grip: a pill with two ridges, like the handles of a stock chart's range selector. */}
                    <span className="flex h-5 w-2.5 items-center justify-center gap-px rounded-[3px] border border-canvas/60 bg-strong shadow-[0_0_0_1px_rgb(0_0_0/0.35)] group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus">
                      <span className="h-2.5 w-px bg-canvas/70" />
                      <span className="h-2.5 w-px bg-canvas/70" />
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {brush && span && shownPeriod && (
            <div
              className={cn(
                "absolute bottom-full z-40 mb-2 -translate-x-1/2",
                preview ? "pointer-events-none" : "pointer-events-auto",
              )}
              style={{ left: labelLeft }}
              aria-hidden={preview ? true : undefined}
            >
              <div className="flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-surface py-1 pl-2.5 pr-1 text-xs font-medium tabular-nums text-strong shadow-lg shadow-black/40">
                <span>{brushLabel(shownPeriod, brush.years)}</span>
                {!preview && (
                  <>
                    <button
                      type="button"
                      onClick={requestShareMenu}
                      className="ml-1 cursor-pointer rounded bg-button-green px-2 py-0.5 text-xs font-semibold text-white hover:bg-button-green-hover"
                    >
                      Share
                    </button>
                    <button
                      type="button"
                      aria-label="Clear period"
                      onClick={() => onChangeRef.current?.(null)}
                      className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-muted hover:text-strong"
                    >
                      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {children}
      </div>
    </>
  );
}
