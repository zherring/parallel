"use client";

import { useEffect, useRef, type RefObject } from "react";
import { releaseVelocity, swipeAxis, swipeOutcome, type SwipeSample } from "@/lib/swipe";
import { SHEET_EASE_OUT, prefersReducedMotion, type SheetEdge } from "./sheet";

/** A touch has to move this far before it is read as a drag. Small on purpose: the browser's own scroll must not start first. */
const SLOP = 4;
/** How much of the backdrop's dimming is left when the panel has been dragged all the way out. */
const BACKDROP_FLOOR = 0.35;

interface Options {
  panelRef: RefObject<HTMLElement | null>;
  backdropRef: RefObject<HTMLElement | null>;
  /** The edge the sheet came from, asked when a touch begins (a panel that is at the bottom on a phone and on the right of a wider screen says which it is now): it is dragged back that way. */
  edge: () => SheetEdge;
  /** False while the panel slides away: a drag neither starts nor carries on. */
  enabled: boolean;
  /** Let go past the point of no return (see `swipeOutcome`): close the panel. It slides on from where the finger left it. */
  onDismiss: () => void;
}

/**
 * Dragging a slide-out panel away with a finger, the way it came: down for the bottom sheet, to the right for the sheet on the
 * right. The panel follows the finger 1:1 and the backdrop lightens with it; letting go either closes it (far enough, or
 * flicked) or lets it settle back. Touch only: a mouse has the backdrop, the close button and Escape.
 *
 * A drag starts anywhere on the panel, but only when nothing under the finger has scrolled the other way first: the content has
 * to be at its top (or left) for the pull to move the panel instead of scrolling. A touch that starts as a scroll stays a scroll.
 *
 * Returns a ref that is true once a drag closed the panel, so the exit animation can carry on from the finger's speed.
 */
export function useSwipeDismiss({ panelRef, backdropRef, edge, enabled, onDismiss }: Options): RefObject<boolean> {
  const flung = useRef(false);
  const latest = useRef(onDismiss);
  const edgeNow = useRef(edge);
  useEffect(() => {
    latest.current = onDismiss;
    edgeNow.current = edge;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !enabled) return;
    // A panel that is open (again) has not been dragged away.
    flung.current = false;

    type Gesture =
      | { mode: "pending"; id: number; axis: "x" | "y"; startX: number; startY: number; startT: number }
      | { mode: "dragging"; id: number; axis: "x" | "y"; origin: number; offset: number; extent: number; samples: SwipeSample[] };
    let gesture: Gesture | null = null;

    const transformOf = (axis: "x" | "y", offset: number) => `translate${axis.toUpperCase()}(${offset}px)`;
    const dimOf = (offset: number, extent: number) => 1 - (1 - BACKDROP_FLOOR) * Math.min(1, extent > 0 ? offset / extent : 0);
    const touchOf = (event: TouchEvent, id: number) => Array.from(event.changedTouches).find((touch) => touch.identifier === id);

    const apply = (axis: "x" | "y", offset: number, extent: number) => {
      panel.style.transform = offset > 0 ? transformOf(axis, offset) : "";
      const backdrop = backdropRef.current;
      if (backdrop) backdrop.style.opacity = offset > 0 ? String(dimOf(offset, extent)) : "";
    };

    /** Back to rest from wherever it is. */
    const settle = (axis: "x" | "y", offset: number, extent: number) => {
      apply(axis, 0, extent);
      if (offset <= 0 || prefersReducedMotion()) return;
      panel.animate([{ transform: transformOf(axis, offset) }, { transform: "none" }], { duration: 260, easing: SHEET_EASE_OUT });
      backdropRef.current?.animate([{ opacity: dimOf(offset, extent) }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
    };

    /** Whether something from the finger up to the panel, the panel included (a sheet may be its own scroller), is scrolled away from its start, so the pull belongs to it. */
    const scrolledUnder = (target: EventTarget | null, axis: "x" | "y") => {
      for (let element = target instanceof Element ? target : null; element; element = element.parentElement) {
        if ((axis === "y" ? element.scrollTop : element.scrollLeft) > 0) return true;
        if (element === panel) break;
      }
      return false;
    };

    const onStart = (event: TouchEvent) => {
      if (gesture?.mode === "dragging") {
        // A second finger: the drag is over, and the panel goes back.
        settle(gesture.axis, gesture.offset, gesture.extent);
        gesture = null;
        return;
      }
      gesture = null;
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      const touch = event.touches[0];
      gesture = {
        mode: "pending",
        id: touch.identifier,
        axis: edgeNow.current() === "right" ? "x" : "y",
        startX: touch.clientX,
        startY: touch.clientY,
        startT: event.timeStamp,
      };
    };

    const onMove = (event: TouchEvent) => {
      if (!gesture) return;
      const touch = touchOf(event, gesture.id);
      if (!touch) return;

      if (gesture.mode === "pending") {
        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;
        const moving = swipeAxis(dx, dy, SLOP);
        if (!moving) return;
        const away = (gesture.axis === "y" ? dy : dx) > 0;
        const selecting = !(window.getSelection()?.isCollapsed ?? true);
        // Not ours: the other axis, towards the panel, text being selected, content that has scrolled, or a scroll the browser already began.
        if (moving !== gesture.axis || !away || selecting || !event.cancelable || scrolledUnder(event.target, gesture.axis)) {
          gesture = null;
          return;
        }
        const box = panel.getBoundingClientRect();
        // From where the touch began: the panel is under the finger from the first frame, and its speed counts from there
        // (a quick flick may be only a move or two).
        const origin = gesture.axis === "y" ? gesture.startY : gesture.startX;
        gesture = {
          mode: "dragging",
          id: gesture.id,
          axis: gesture.axis,
          origin,
          offset: 0,
          extent: gesture.axis === "y" ? box.height : box.width,
          samples: [{ t: gesture.startT, pos: origin }],
        };
      }

      if (event.cancelable) event.preventDefault();
      const pos = gesture.axis === "y" ? touch.clientY : touch.clientX;
      gesture.offset = Math.max(0, pos - gesture.origin);
      gesture.samples.push({ t: event.timeStamp, pos });
      if (gesture.samples.length > 12) gesture.samples.shift();
      apply(gesture.axis, gesture.offset, gesture.extent);
    };

    const onEnd = (event: TouchEvent) => {
      if (!gesture || !touchOf(event, gesture.id)) return;
      const ended = gesture;
      gesture = null;
      if (ended.mode !== "dragging") return;
      const velocity = releaseVelocity(ended.samples, event.timeStamp);
      if (event.type === "touchend" && swipeOutcome({ offset: ended.offset, velocity, extent: ended.extent }) === 1) {
        // The inline offset stays: the exit animation starts from it.
        flung.current = true;
        latest.current();
        return;
      }
      settle(ended.axis, ended.offset, ended.extent);
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [panelRef, backdropRef, enabled]);

  return flung;
}
