"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { NavDirection } from "@/lib/hero-history";
import { releaseVelocity, swipeArmed, swipeAxis, swipeOutcome, type SwipeSample } from "@/lib/swipe";

/** The stage's custom property the cards read their sideways offset from, in stage pixels (see `Motion` in hero-collage.tsx). */
export const SWIPE_VAR = "--swipe";

/** A touch has to move this far sideways before it is a swipe; up or down first, it is the page's scroll. */
const SLOP = 8;
/** How long the cards take to spring back when the swipe is let go short. */
const RETURN_MS = 280;
/** If a completed swipe's scene has not come by then (its images will not load), the cards go back. */
const GIVE_UP_MS = 1500;
/** After a swipe, the click that may follow the lifted finger is not a tap on the link. */
const CLICK_GUARD_MS = 350;

interface Options {
  /** What the finger drags: the collage's link. */
  surface: RefObject<HTMLElement | null>;
  /** The scaled stage, which carries the offset. */
  stage: RefObject<HTMLElement | null>;
  /** The stage's width in its own pixels, to turn screen pixels into stage pixels. */
  stageWidth: number;
  enabled: boolean;
  reduced: boolean;
  /** A swipe was let go past the point of no return: step that way. The cards stay where they are until the scene changes. */
  onStep: (direction: NavDirection) => void;
  /** The drag crossed the point where letting go would step (a direction), or came back from it (null). */
  onArmed: (direction: NavDirection | null) => void;
  /** A swipe has begun: a step may follow. */
  onStart?: () => void;
}

/**
 * Swiping the hero's collage with a finger: left for the next pairing, right for the previous one, as the arrows beside it. The
 * cards follow the finger 1:1; letting go far enough (or with a flick) steps, anything less springs back (`swipeOutcome`). The
 * link is `touch-action: pan-y`, so a touch that moves up or down still scrolls the page and never becomes a swipe. Touch and
 * pen only: a mouse drags nothing.
 *
 * `offset()` is where the cards are now, for the transition that takes them away, and `reset()` puts the stage back at rest
 * once that transition owns them.
 */
export function useHeroSwipe({ surface, stage, stageWidth, enabled, reduced, onStep, onArmed, onStart }: Options) {
  const offset = useRef(0);
  const frame = useRef(0);
  const giveUp = useRef(0);
  /** Set while a finger is dragging: where the pointer was when the offset was zero, in screen pixels. */
  const origin = useRef<{ x: number; last: number } | null>(null);
  const latest = useRef({ onStep, onArmed, onStart, reduced });
  useEffect(() => {
    latest.current = { onStep, onArmed, onStart, reduced };
  });

  const write = useCallback(
    (x: number) => {
      offset.current = x;
      stage.current?.style.setProperty(SWIPE_VAR, `${x.toFixed(2)}px`);
    },
    [stage],
  );

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    window.clearTimeout(giveUp.current);
    frame.current = 0;
  }, []);

  /** Springs the cards back to rest from wherever they are. */
  const release = useCallback(() => {
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
      write(from * (1 - t) ** 3);
      frame.current = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  }, [stop, write]);

  const reset = useCallback(() => {
    stop();
    write(0);
    // A finger still down carries on from here, not from where it began.
    if (origin.current) origin.current.x = origin.current.last;
  }, [stop, write]);

  useEffect(() => {
    const element = surface.current;
    if (!element || !enabled) return;

    type Drag = { id: number; startX: number; startY: number; scale: number; extent: number; dragging: boolean; samples: SwipeSample[] };
    // The finger's speed is measured from where it came down: a quick flick may be only a move or two.
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
      const box = stage.current?.getBoundingClientRect();
      if (!box || box.width === 0) return;
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scale: box.width / stageWidth,
        extent: box.width,
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
        // From where the cards are now (a swipe can catch them springing back), and from where the finger crossed the slop: no jump
        // there, and none of the way it has come since is lost (a fast flick's first move can be most of it).
        const crossed = drag.startX + Math.sign(event.clientX - drag.startX) * SLOP;
        origin.current = { x: crossed - offset.current * drag.scale, last: event.clientX };
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // the pointer is already gone
        }
        latest.current.onStart?.();
      }
      const at = origin.current;
      if (!at) return;
      at.last = event.clientX;
      const screen = event.clientX - at.x;
      write(screen / drag.scale);
      drag.samples.push({ t: event.timeStamp, pos: event.clientX });
      if (drag.samples.length > 12) drag.samples.shift();
      arm(swipeArmed(screen, drag.extent) ? (screen < 0 ? "next" : "prev") : null);
    };

    const end = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const ended = drag;
      const at = origin.current;
      drag = null;
      origin.current = null;
      arm(null);
      if (!ended.dragging || !at) return;
      guard = window.setTimeout(() => {
        swiped = false;
      }, CLICK_GUARD_MS);
      const screen = offset.current * ended.scale;
      const outcome =
        event.type === "pointerup"
          ? swipeOutcome({ offset: screen, velocity: releaseVelocity(ended.samples, event.timeStamp), extent: ended.extent })
          : 0;
      if (outcome === 0) {
        release();
        return;
      }
      // The cards wait where the finger left them: the scene's change takes them from there (`offset`, then `reset`).
      window.clearTimeout(giveUp.current);
      giveUp.current = window.setTimeout(release, GIVE_UP_MS);
      latest.current.onStep(outcome < 0 ? "next" : "prev");
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
      origin.current = null;
      if (armed) latest.current.onArmed(null);
    };
  }, [surface, stage, stageWidth, enabled, stop, write, release]);

  useEffect(() => stop, [stop]);

  return { offset: useCallback(() => offset.current, []), reset };
}
