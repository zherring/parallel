"use client";

import { useEffect, useRef, type RefObject } from "react";
import { pinchZoomStep } from "@/lib/timeline-layout";

interface Options {
  /** False where the track does not zoom (a frame in a post) or is not on screen. */
  enabled: boolean;
  /** The zoom on screen. */
  zoom: number;
  /** The fingers have reached another zoom step: go to it, keeping the year under `clientX` (the point between them) where it is. */
  onZoom: (next: number, clientX: number) => void;
  /** A pinch has begun. */
  onStart?: () => void;
}

/**
 * Two fingers on the Timeline's track zoom it, as its + and - buttons do: spreading them zooms in, pinching zooms out, about the
 * point between them. The track has a fixed set of zoom steps (each one packs the posters anew), so it snaps from step to step
 * as the fingers go (`pinchZoomStep`) and never sits between two. The scroller's `touch-action` leaves the browser's own
 * pinch-zoom out (see the track's class), so the page does not zoom under the fingers too; one finger still scrolls natively.
 */
export function usePinchZoom(scrollerRef: RefObject<HTMLElement | null>, { enabled, zoom, onZoom, onStart }: Options): void {
  const latest = useRef({ zoom, onZoom, onStart });
  useEffect(() => {
    latest.current = { zoom, onZoom, onStart };
  });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !enabled) return;
    /** The fingers' distance and the zoom when the pinch began, and the step it has asked for since (the render may trail it). */
    let pinch: { distance: number; zoom: number; step: number } | null = null;

    const spread = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        pinch = null;
        return;
      }
      const distance = spread(event.touches);
      if (distance < 1) return;
      pinch = { distance, zoom: latest.current.zoom, step: latest.current.zoom };
      latest.current.onStart?.();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      // Ours: not a two-finger scroll, and not the page's zoom where `touch-action` is not honoured.
      if (event.cancelable) event.preventDefault();
      const next = pinchZoomStep(pinch.step, pinch.zoom * (spread(event.touches) / pinch.distance));
      if (next === pinch.step) return;
      pinch.step = next;
      latest.current.onZoom(next, (event.touches[0].clientX + event.touches[1].clientX) / 2);
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = null;
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [scrollerRef, enabled]);
}
