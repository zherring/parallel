"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { releaseVelocity, swipeAxis, swipeOutcome, type SwipeSample } from "@/lib/swipe";
import { SHEET_EASE_OUT, prefersReducedMotion, sidePanelEdge } from "./sheet";

/** The same as the pull to dismiss, so the two read a touch the same way and only one of them takes it. */
const SLOP = 4;
/** How much of the finger's travel the content follows when there is nothing that way: it gives a little, and goes back. */
const RESISTANCE = 0.25;

/** What a panel can step to: the thing before and the thing after what it shows, null where there is none. */
export interface PanelStepper {
  prev: (() => void) | null;
  next: (() => void) | null;
  prevLabel: string;
  nextLabel: string;
}

interface Options {
  panelRef: RefObject<HTMLElement | null>;
  /** The panel's content, which is what moves: the sheet and its header stay. */
  contentRef: RefObject<HTMLElement | null>;
  /** What the content is: when it changes after a swipe, the new content comes in from the side the finger was heading away from. */
  contentKey: string | number | undefined;
  enabled: boolean;
  stepper: PanelStepper | undefined;
}

/**
 * Swiping a phone's bottom sheet sideways to what comes before or after (a film's details: the film before, the film after), as
 * the header's arrows do. The content follows the finger 1:1; let go far enough or flicked (`swipeOutcome`) it leaves that way
 * and the next content comes in from the other side, anything less springs back. Left is next, right is previous. Where there
 * is nothing that way the content only gives a little. A touch that moves up or down is the content's scroll or the sheet's
 * pull to dismiss, and one that starts on something that scrolls sideways is that thing's.
 */
export function useSwipeStep({ panelRef, contentRef, contentKey, enabled, stepper }: Options): void {
  const latest = useRef(stepper);
  useEffect(() => {
    latest.current = stepper;
  });
  /** A swipe stepped: the way the old content left (-1 to the left), and its exit animation, for the new content's entrance. */
  const leaving = useRef<{ dir: 1 | -1; exit: Animation | null } | null>(null);
  const can = stepper !== undefined;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !enabled || !can) return;

    type Gesture =
      | { mode: "pending"; id: number; startX: number; startY: number; startT: number }
      | { mode: "dragging"; id: number; origin: number; offset: number; extent: number; samples: SwipeSample[] };
    let gesture: Gesture | null = null;

    const touchOf = (event: TouchEvent, id: number) => Array.from(event.changedTouches).find((touch) => touch.identifier === id);
    const fadeOf = (offset: number, extent: number) => 1 - 0.6 * Math.min(1, Math.abs(offset) / Math.max(1, extent));
    /** Where the content is drawn for a finger `offset` px from where it began. */
    const shown = (offset: number) => {
      const open = offset < 0 ? latest.current?.next : latest.current?.prev;
      return open ? offset : offset * RESISTANCE;
    };

    const apply = (offset: number, extent: number) => {
      const content = contentRef.current;
      if (!content) return;
      const x = shown(offset);
      content.style.transform = x ? `translateX(${x}px)` : "";
      content.style.opacity = x ? String(fadeOf(x, extent)) : "";
    };

    const settle = (offset: number, extent: number) => {
      const content = contentRef.current;
      const x = shown(offset);
      apply(0, extent);
      if (!content || !x || prefersReducedMotion()) return;
      content.animate([{ transform: `translateX(${x}px)`, opacity: fadeOf(x, extent) }, { transform: "none", opacity: 1 }], {
        duration: 240,
        easing: SHEET_EASE_OUT,
      });
    };

    /** Whether something between the finger and the panel scrolls sideways: the swipe is its, not the panel's. */
    const scrollsSideways = (target: EventTarget | null) => {
      for (let element = target instanceof Element ? target : null; element && element !== panel; element = element.parentElement) {
        if (element.scrollWidth > element.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(element).overflowX)) return true;
      }
      return false;
    };

    const onStart = (event: TouchEvent) => {
      if (gesture?.mode === "dragging") {
        settle(gesture.offset, gesture.extent);
        gesture = null;
        return;
      }
      gesture = null;
      // A sheet on the right is put away by a sideways drag (`useSwipeDismiss`), so it does not step.
      if (event.touches.length !== 1 || sidePanelEdge() === "right") return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      const touch = event.touches[0];
      gesture = { mode: "pending", id: touch.identifier, startX: touch.clientX, startY: touch.clientY, startT: event.timeStamp };
    };

    const onMove = (event: TouchEvent) => {
      if (!gesture) return;
      const touch = touchOf(event, gesture.id);
      if (!touch) return;
      if (gesture.mode === "pending") {
        const moving = swipeAxis(touch.clientX - gesture.startX, touch.clientY - gesture.startY, SLOP);
        if (!moving) return;
        const selecting = !(window.getSelection()?.isCollapsed ?? true);
        if (moving !== "x" || selecting || !event.cancelable || scrollsSideways(event.target)) {
          gesture = null;
          return;
        }
        // From where the finger crossed the slop: no jump there, and none of the way it has come since is lost.
        const origin = gesture.startX + Math.sign(touch.clientX - gesture.startX) * SLOP;
        gesture = {
          mode: "dragging",
          id: gesture.id,
          origin,
          offset: 0,
          extent: panel.getBoundingClientRect().width,
          samples: [{ t: gesture.startT, pos: gesture.startX }],
        };
      }
      if (event.cancelable) event.preventDefault();
      gesture.offset = touch.clientX - gesture.origin;
      gesture.samples.push({ t: event.timeStamp, pos: touch.clientX });
      if (gesture.samples.length > 12) gesture.samples.shift();
      apply(gesture.offset, gesture.extent);
    };

    const onEnd = (event: TouchEvent) => {
      if (!gesture || !touchOf(event, gesture.id)) return;
      const ended = gesture;
      gesture = null;
      if (ended.mode !== "dragging") return;
      const outcome =
        event.type === "touchend"
          ? swipeOutcome({ offset: ended.offset, velocity: releaseVelocity(ended.samples, event.timeStamp), extent: ended.extent })
          : 0;
      const step = outcome < 0 ? latest.current?.next : outcome > 0 ? latest.current?.prev : null;
      const content = contentRef.current;
      if (!step || !content || outcome === 0) {
        settle(ended.offset, ended.extent);
        return;
      }
      if (prefersReducedMotion()) {
        apply(0, ended.extent);
        step();
        return;
      }
      // Out the way the finger was taking it, then the step: the new content comes in from the other side (the effect below).
      const x = shown(ended.offset);
      const exit = content.animate(
        [{ transform: `translateX(${x}px)`, opacity: fadeOf(x, ended.extent) }, { transform: `translateX(${outcome * ended.extent * 0.6}px)`, opacity: 0 }],
        { duration: 130, easing: "ease-out", fill: "forwards" },
      );
      apply(0, ended.extent);
      leaving.current = { dir: outcome, exit };
      exit.finished.then(
        () => {
          step();
          // If the step changed nothing, the content must not stay gone.
          window.setTimeout(() => {
            exit.cancel();
            if (leaving.current?.exit === exit) leaving.current = null;
          }, 400);
        },
        () => {},
      );
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
  }, [panelRef, contentRef, enabled, can]);

  // The content a swipe stepped to comes in from the side opposite the one the old content left by.
  useLayoutEffect(() => {
    const swiped = leaving.current;
    const content = contentRef.current;
    if (!swiped || !content) return;
    leaving.current = null;
    swiped.exit?.cancel();
    const from = -swiped.dir * content.getBoundingClientRect().width * 0.4;
    content.animate([{ transform: `translateX(${from}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 240,
      easing: SHEET_EASE_OUT,
    });
  }, [contentKey, contentRef]);
}
