"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { NavDirection } from "@/lib/hero-history";
import { releaseVelocity, swipeArmed, swipeAxis, swipeOutcome, type SwipeSample } from "@/lib/swipe";

/** The stage's custom property its scene reads its sideways offset from, in px (see `SWIPE_SHIFT` in hero-stage.tsx). */
export const SWIPE_VAR = "--swipe";

/** A touch has to move this far sideways before it is a swipe; up or down first, it is the page's scroll. */
const SLOP = 8;
/** How long the scene takes to come back to rest when the finger lifts. */
const RETURN_MS = 320;
/** After a swipe, the click that may follow the lifted finger is not a tap on the link. */
const CLICK_GUARD_MS = 350;

interface Options {
  /** The stage: what the finger drags, and the element that carries the offset. */
  stage: RefObject<HTMLElement | null>;
  enabled: boolean;
  reduced: boolean;
  /** A swipe was let go past the point of no return: step that way. */
  onStep: (direction: NavDirection) => void;
  /** The drag crossed the point where letting go would step (a direction), or came back from it (null). */
  onArmed: (direction: NavDirection | null) => void;
  /** A swipe has begun: a step may follow. */
  onStart?: () => void;
}

/**
 * Swiping the hero's stage with a finger: left for the next pairing, right for the previous one, as the arrows on it. The scene (the
 * figures in their halves, the posters, the names) follows the finger 1:1; letting go far enough (or with a flick) steps, and either
 * way the scene eases back to its place as the finger lifts, with the change of pairing playing over it when there is one
 * (`swipeOutcome`). The stage is `touch-action: pan-y`, so a touch that moves up or down still scrolls the page and never becomes a
 * swipe. Touch and pen only: a mouse drags nothing. A touch that starts on Previous or Next is the button's.
 */
export function useHeroSwipe({ stage, enabled, reduced, onStep, onArmed, onStart }: Options): void {
  const offset = useRef(0);
  const frame = useRef(0);
  const latest = useRef({ onStep, onArmed, onStart, reduced });
  useEffect(() => {
    latest.current = { onStep, onArmed, onStart, reduced };
  });

  useEffect(() => {
    const element = stage.current;
    if (!element || !enabled) return;

    const write = (x: number) => {
      offset.current = x;
      element.style.setProperty(SWIPE_VAR, `${x.toFixed(2)}px`);
    };
    const stop = () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
    /** Eases the scene back to rest from wherever it is. */
    const release = () => {
      stop();
      const from = offset.current;
      if (from === 0) return;
      if (latest.current.reduced) {
        write(0);
        return;
      }
      const began = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - began) / RETURN_MS);
        write(t < 1 ? from * (1 - t) ** 3 : 0);
        frame.current = t < 1 ? requestAnimationFrame(tick) : 0;
      };
      frame.current = requestAnimationFrame(tick);
    };

    // The finger's speed is measured from where it came down: a quick flick may be only a move or two.
    type Drag = { id: number; startX: number; startY: number; originX: number; extent: number; dragging: boolean; samples: SwipeSample[] };
    let drag: Drag | null = null;
    let armed: NavDirection | null = null;
    let guard = 0;
    let swiped = false;

    const arm = (next: NavDirection | null) => {
      if (next === armed) return;
      armed = next;
      latest.current.onArmed(next);
    };

    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      window.clearTimeout(guard);
      swiped = false;
      if (event.target instanceof Element && event.target.closest("button")) return;
      const width = element.getBoundingClientRect().width;
      if (width === 0) return;
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: event.clientX,
        extent: width,
        dragging: false,
        samples: [{ t: event.timeStamp, pos: event.clientX }],
      };
    };

    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.dragging) {
        const axis = swipeAxis(event.clientX - drag.startX, event.clientY - drag.startY, SLOP);
        if (!axis) return;
        if (axis === "y") {
          drag = null; // the page's scroll
          return;
        }
        stop();
        drag.dragging = true;
        swiped = true;
        // From where the scene is now (a swipe can catch it easing back), and from where the finger crossed the slop: no jump
        // there, and none of the way it has come since is lost (a fast flick's first move can be most of it).
        drag.originX = drag.startX + Math.sign(event.clientX - drag.startX) * SLOP - offset.current;
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // the pointer is already gone
        }
        latest.current.onStart?.();
      }
      const x = event.clientX - drag.originX;
      write(x);
      drag.samples.push({ t: event.timeStamp, pos: event.clientX });
      if (drag.samples.length > 12) drag.samples.shift();
      arm(swipeArmed(x, drag.extent) ? (x < 0 ? "next" : "prev") : null);
    };

    const end = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const ended = drag;
      drag = null;
      arm(null);
      if (!ended.dragging) return;
      guard = window.setTimeout(() => {
        swiped = false;
      }, CLICK_GUARD_MS);
      const outcome =
        event.type === "pointerup"
          ? swipeOutcome({ offset: offset.current, velocity: releaseVelocity(ended.samples, event.timeStamp), extent: ended.extent })
          : 0;
      // Back to its place either way; a step's change of pairing plays over it.
      release();
      if (outcome !== 0) latest.current.onStep(outcome < 0 ? "next" : "prev");
    };

    // The finger that swiped did not tap the link.
    const click = (event: MouseEvent) => {
      if (!swiped) return;
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    element.addEventListener("click", click, true);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
      element.removeEventListener("click", click, true);
      window.clearTimeout(guard);
      if (armed) latest.current.onArmed(null);
      // Nothing is left half way: a stage that stops taking swipes is at rest.
      stop();
      write(0);
    };
  }, [stage, enabled]);
}
