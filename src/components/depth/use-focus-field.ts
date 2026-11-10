"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";
import { FINE_POINTER, useMediaQuery } from "@/components/depth/use-media";
import { docCenterX, posterFactor, tierOf, xSpec, type DepthFilm } from "@/lib/depth-layout";
import { focusDistance, focusWeight, projectX, projectY, visibleDocRange } from "@/lib/depth-projection";

/** Radius (px) of the field of focus: a poster this close to the pointer (or to the middle of a phone's screen) is sharp. */
const RADIUS = { desktop: 220, phone: 160 };
/** Width (px) from which the desktop radius applies: Tailwind's `sm`. */
const SM_WIDTH = 640;
/** The loop stops this long (ms) after the last scroll or pointer move. */
const IDLE_MS = 150;
/** Posters this far (screen px) outside the viewport are skipped. */
const VIEW_BUFFER = 200;
/** A poster's `--focus` is only rewritten when it moved by more than this. */
const MIN_STEP = 0.01;

interface FieldItem {
  el: HTMLElement;
  film: DepthFilm;
  y: number;
  /** Where the poster's centre is across in its layer (see `docCenterX`): it depends on the viewport, so `measure` sets it. */
  x: number;
  /** Scale of the poster on screen: its own factor (`posterFactor`), as obscure films sit further back than their layer. */
  f: number;
}

/**
 * The field of focus: the pointer (or, with no pointer, a band through the middle of the screen) sharpens the soft
 * posters of the layers behind. Each poster's `--focus` (0 to 1) is the opacity of its sharp image over its blurred one, and
 * lifts the poster from its resting opacity (fainter the more obscure the film) to 1, so it is the only thing that animates;
 * posters of the front layer (and a page of one person's) are never sharpened, so the loop leaves them alone.
 *
 * Where a poster is on screen is worked out from numbers (`depth-projection.ts`), never read from the DOM: the work
 * per frame is arithmetic over the posters that are in view. The loop runs only while the scene scrolls or the pointer
 * moves, and it writes a property only when its value changed by more than `MIN_STEP`.
 */
export function useFocusField(scrollerRef: RefObject<HTMLDivElement | null>, films: readonly DepthFilm[], peopleCount: number): void {
  const finePointer = useMediaQuery(FINE_POINTER);
  // What the effect reads when it needs it, so it subscribes once and not whenever the query changes.
  const hasFinePointer = useEffectEvent(() => finePointer);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const elements = new Map<string, HTMLElement>();
    scroller.querySelectorAll<HTMLElement>("[data-poster]").forEach((el) => elements.set(el.dataset.poster ?? "", el));
    const items: FieldItem[] = [];
    // The last value written to each poster: React rendered them at 0 (what its layer starts at), or an earlier run left them.
    const written = new Map<HTMLElement, number>();
    for (const item of films) {
      const el = elements.get(String(item.film.id));
      if (!el) continue;
      if (!item.background) continue;
      items.push({ el, film: item, y: item.y, x: 0, f: posterFactor(item) });
      written.set(el, Number.parseFloat(el.style.getPropertyValue("--focus")) || 0);
    }

    let width = scroller.clientWidth;
    let height = scroller.clientHeight;
    let left = 0;
    let top = 0;
    const measure = () => {
      const rect = scroller.getBoundingClientRect();
      width = scroller.clientWidth;
      height = scroller.clientHeight;
      left = rect.left;
      top = rect.top;
      // The spacing the scene's CSS has for this width (same numbers, same sum): where each poster is across. The posters it drives are the layers behind, whose
      // size does not depend on the screen's; the larger side of the viewport is what the films made together grow with (`COLLAB_SIZE`), passed for the sum to be the CSS's.
      const spec = xSpec(tierOf(window.innerWidth), peopleCount);
      const vmax = Math.max(window.innerWidth, window.innerHeight);
      for (const item of items) item.x = docCenterX(item.film, width, spec, vmax);
    };
    measure();

    /** The last pointer position (relative to the scroller) and kind: a touch has no hover, so it makes the band the focus. */
    let pointer: { x: number; y: number } | null = null;
    let touching: boolean | null = null;
    let lastActivity = performance.now();
    let frame = 0;

    const update = () => {
      const scrollTop = scroller.scrollTop;
      const radius = width >= SM_WIDTH ? RADIUS.desktop : RADIUS.phone;
      // A mouse has the pointer for a focus (none until it has moved over the scene); anything else the middle band.
      const usePointer = touching === null ? hasFinePointer() : !touching;
      const focus = usePointer ? pointer : null;
      for (const item of items) {
        const { from, to } = visibleDocRange(scrollTop, height, item.f, VIEW_BUFFER);
        const near = item.y >= from && item.y <= to;
        if (!near) continue;
        let weight = 0;
        if (focus || !usePointer) {
          const x = projectX(item.x, width, item.f);
          const y = projectY(item.y, scrollTop, height, item.f);
          weight = focusWeight(focusDistance(x, y, height, focus), radius);
        }
        if (Math.abs(weight - (written.get(item.el) ?? 0)) <= MIN_STEP) continue;
        written.set(item.el, weight);
        item.el.style.setProperty("--focus", weight.toFixed(2));
      }
    };

    const tick = () => {
      frame = 0;
      update();
      if (performance.now() - lastActivity < IDLE_MS) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      lastActivity = performance.now();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      touching = event.pointerType === "touch";
      pointer = touching ? null : { x: event.clientX - left, y: event.clientY - top };
      wake();
    };
    const onPointerLeave = () => {
      pointer = null;
      wake();
    };
    const onResize = () => {
      measure();
      wake();
    };

    scroller.addEventListener("scroll", wake, { passive: true });
    scroller.addEventListener("pointermove", onPointerMove, { passive: true });
    scroller.addEventListener("pointerleave", onPointerLeave, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(onResize);
    observer?.observe(scroller);
    // Once at the start: on a phone the posters in the middle band are sharp before anything moves.
    wake();

    return () => {
      scroller.removeEventListener("scroll", wake);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerleave", onPointerLeave);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollerRef, films, peopleCount]);
}
