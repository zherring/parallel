"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  canStartPan,
  movedPastThreshold,
  nextPanScroll,
  pressOnScrollbar,
  scrollBounds,
  type PanTarget,
} from "@/lib/drag-pan";

/**
 * Anything with a job of its own. A film's card and node carry `data-film`; the rest is the usual
 * suspects (the "Show all" and "More" buttons, the legend chips, the remove and person links).
 */
const INTERACTIVE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "label",
  "[role='button']",
  "[role='link']",
  "[role='scrollbar']",
  "[contenteditable]:not([contenteditable='false'])",
  "[data-film]",
].join(",");

/** The sticky lane header cells: their text stays selectable and their buttons clickable. */
const HEADER = "[data-lane-head]";

/** The click that ends a drag is swallowed for this long; the next pointer-down lifts it sooner. */
const SWALLOW_CLICK_MS = 50;

interface Press {
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  dragging: boolean;
}

function describeTarget(scroller: HTMLElement, event: PointerEvent): PanTarget {
  const target = event.target instanceof Element ? event.target : null;
  const inside = (element: Element | null | undefined) => !!element && element !== scroller && scroller.contains(element);
  const box = scroller.getBoundingClientRect();
  return {
    interactive: inside(target?.closest(INTERACTIVE)),
    inHeader: inside(target?.closest(HEADER)),
    onScrollbar: pressOnScrollbar(event.clientX, event.clientY, {
      left: box.left,
      top: box.top,
      clientLeft: scroller.clientLeft,
      clientTop: scroller.clientTop,
      clientWidth: scroller.clientWidth,
      clientHeight: scroller.clientHeight,
    }),
  };
}

/**
 * Click-and-drag panning of the timeline's scroller, in both axes, from anywhere on its empty
 * surface: lane tracks, the connector overlay (which lets the pointer through) and the year axis.
 * Films (cards and nodes), buttons, links and the lane headers are left alone, touch keeps its
 * native scrolling, and so does the scrollbar. What counts is decided in `@/lib/drag-pan`.
 *
 * A press becomes a drag after a few pixels of travel; from then on the pointer is captured, the
 * scroller carries `data-panning` (its stylesheet turns the cursor to `grabbing` and text selection
 * off for its whole subtree) and `onPanStart` runs once (the hover card closes). However it ends, by
 * pointer up or cancel, a lost capture, a button released out of sight, Escape, a lost window focus, a
 * context menu or unmount, everything is put back, and the click that follows a drag is swallowed.
 *
 * Native listeners on the scroller, not React props: React events bubble through portals (the biography
 * dialog), and a drag fires them far more often than anything else on the page.
 */
export function useDragPan(scrollerRef: RefObject<HTMLElement | null>, onPanStart?: () => void) {
  const panning = useRef(false);
  const onPanStartRef = useRef(onPanStart);
  useEffect(() => {
    onPanStartRef.current = onPanStart;
  });

  /** For the hover handlers: no film is hovered under a pointer that is dragging the timeline. */
  const isPanning = useCallback(() => panning.current, []);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    // A const of the plain type, so that the hoisted function declarations below see it as set.
    const scroller: HTMLElement = element;

    let press: Press | null = null;
    let swallowTimer: number | undefined;

    const cancel = (event: Event) => event.preventDefault();

    const swallowClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      disarmSwallow();
    };
    function armSwallow() {
      window.clearTimeout(swallowTimer);
      window.addEventListener("click", swallowClick, true);
      swallowTimer = window.setTimeout(disarmSwallow, SWALLOW_CLICK_MS);
    }
    function disarmSwallow() {
      window.clearTimeout(swallowTimer);
      window.removeEventListener("click", swallowClick, true);
    }

    function onMove(event: PointerEvent) {
      const current = press;
      if (!current || event.pointerId !== current.pointerId) return;
      // The button was let go where this page could not see it (over the browser's own chrome).
      if ((event.buttons & 1) === 0) {
        finish();
        return;
      }
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (!current.dragging) {
        if (!movedPastThreshold(dx, dy)) return;
        begin(current);
      }
      const next = nextPanScroll({ left: current.startLeft, top: current.startTop }, dx, dy, scrollBounds(scroller));
      // "instant", so that CSS `scroll-behavior: smooth` can never make the content lag behind the pointer.
      scroller.scrollTo({ left: next.left, top: next.top, behavior: "instant" });
    }

    function onEnd(event: PointerEvent) {
      if (press && event.pointerId === press.pointerId) finish();
    }

    function onLostCapture(event: PointerEvent) {
      if (press?.dragging && event.pointerId === press.pointerId) finish();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finish();
    }

    function begin(current: Press) {
      current.dragging = true;
      panning.current = true;
      scroller.dataset.panning = "";
      onPanStartRef.current?.();
      window.getSelection()?.removeAllRanges();
      try {
        scroller.setPointerCapture(current.pointerId);
      } catch {
        // The pointer is gone already (or is synthetic); the window listeners still carry the drag.
      }
    }

    /** Ends a press or a drag, whichever it is, and leaves nothing behind. */
    function finish() {
      const current = press;
      if (!current) return;
      press = null;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      window.removeEventListener("blur", finish);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("contextmenu", finish, true);
      document.removeEventListener("visibilitychange", finish);
      document.removeEventListener("selectstart", cancel, true);
      document.removeEventListener("dragstart", cancel, true);
      if (!current.dragging) return;
      panning.current = false;
      delete scroller.dataset.panning;
      if (scroller.hasPointerCapture(current.pointerId)) scroller.releasePointerCapture(current.pointerId);
      armSwallow();
    }

    function onDown(event: PointerEvent) {
      disarmSwallow();
      finish();
      const allowed = canStartPan({
        pointerType: event.pointerType,
        button: event.button,
        isPrimary: event.isPrimary,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        target: describeTarget(scroller, event),
      });
      if (!allowed) return;
      press = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: scroller.scrollLeft,
        startTop: scroller.scrollTop,
        dragging: false,
      };
      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onEnd, true);
      window.addEventListener("pointercancel", onEnd, true);
      window.addEventListener("blur", finish);
      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("contextmenu", finish, true);
      document.addEventListener("visibilitychange", finish);
      // Pressing the empty surface means "pan", not "select the text under it" or "drag the image under it".
      document.addEventListener("selectstart", cancel, true);
      document.addEventListener("dragstart", cancel, true);
    }

    scroller.addEventListener("pointerdown", onDown);
    scroller.addEventListener("lostpointercapture", onLostCapture);
    return () => {
      scroller.removeEventListener("pointerdown", onDown);
      scroller.removeEventListener("lostpointercapture", onLostCapture);
      finish();
      disarmSwallow();
    };
  }, [scrollerRef]);

  return { isPanning };
}
