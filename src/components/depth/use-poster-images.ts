"use client";

import { useEffect, type RefObject } from "react";
import { posterFactor, type DepthFilm } from "@/lib/depth-layout";
import { inWindow, projectY } from "@/lib/depth-projection";

/**
 * How far from the screen (in viewport heights) a poster's image is fetched: the soft one that is on screen
 * whenever the poster is, and the sharp one that only shows once the focus field raises it.
 */
export const SOFT_WINDOW = 1.5;
export const SHARP_WINDOW = 1;

/** A failed image is asked for again this many times, `RETRY_MS` later each time (so 1.5 s, then 3 s). */
const RETRIES = 2;
const RETRY_MS = 1500;

interface PosterImages {
  y: number;
  f: number;
  /** The images still without a `src`: what the poster's markup left for this hook to fill in (`data-src`). */
  pending: { img: HTMLImageElement; window: number }[];
}

/**
 * Gives the posters' images their `src` as the scene scrolls, instead of leaving that to `loading="lazy"`: the browser's
 * lazy heuristic measures a poster against the viewport in layout space, which for a layer behind the screen plane is not
 * where it is drawn, and a rule that depends on it left posters blank (or late) when the visitor jumped or scrolled
 * quickly. Here the same arithmetic as the focus field (`depth-projection.ts`) says which posters are within a screen and
 * a half of the viewport, on each poster's own factor, and their images are requested nearest first, so what is on screen
 * comes before what is only coming. Anything that is not on screen yet is fetched at low priority.
 *
 * A poster's markup has `data-src` for each image and a real `src` only when it was inside that window at the scene's
 * opening position (`eager`), so the first paint has its posters without waiting for the hydration; this hook skips those.
 * It runs on scroll and on resize (a frame at most): once every image has its `src` it does no work. A request that fails
 * is repeated twice.
 */
export function usePosterImages(scrollerRef: RefObject<HTMLDivElement | null>, films: readonly DepthFilm[]): void {
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const elements = new Map<string, HTMLElement>();
    scroller.querySelectorAll<HTMLElement>("[data-poster]").forEach((el) => elements.set(el.dataset.poster ?? "", el));
    const posters: PosterImages[] = [];
    for (const item of films) {
      const el = elements.get(String(item.film.id));
      if (!el) continue;
      const pending: PosterImages["pending"] = [];
      el.querySelectorAll<HTMLImageElement>("img[data-src]").forEach((img) => {
        if (img.hasAttribute("src")) return;
        pending.push({ img, window: img.dataset.window === "sharp" ? SHARP_WINDOW : SOFT_WINDOW });
      });
      if (pending.length > 0) posters.push({ y: item.y, f: posterFactor(item), pending });
    }

    let remaining = posters.length;
    let frame = 0;
    const load = () => {
      frame = 0;
      if (remaining === 0) return;
      const scrollTop = scroller.scrollTop;
      const height = scroller.clientHeight || window.innerHeight;
      const due: { img: HTMLImageElement; distance: number; onScreen: boolean }[] = [];
      for (const poster of posters) {
        if (poster.pending.length === 0) continue;
        const screenY = projectY(poster.y, scrollTop, height, poster.f);
        const distance = Math.abs(screenY - height / 2);
        const keep: PosterImages["pending"] = [];
        for (const entry of poster.pending) {
          if (inWindow(poster.y, scrollTop, height, poster.f, entry.window * height)) {
            due.push({ img: entry.img, distance, onScreen: screenY > -60 && screenY < height + 60 });
          } else {
            keep.push(entry);
          }
        }
        if (keep.length === 0) remaining--;
        poster.pending = keep;
      }
      // Nearest the middle of the screen first: they are queued in this order.
      due.sort((a, b) => a.distance - b.distance);
      for (const { img, onScreen } of due) {
        img.fetchPriority = onScreen ? "auto" : "low";
        img.src = img.dataset.src ?? "";
      }
    };
    const schedule = () => {
      if (!frame && remaining > 0) frame = requestAnimationFrame(load);
    };

    // The image CDN now and then fails a request (a timeout, a 5xx): a poster left blank for good by one is the kind of
    // thing that looks like "posters aren't loading". Ask again, twice, a little later each time.
    const attempts = new WeakMap<HTMLImageElement, number>();
    const timers = new Set<number>();
    const retryImage = (img: HTMLImageElement) => {
      if (!img.dataset.src) return;
      const attempt = attempts.get(img) ?? 0;
      if (attempt >= RETRIES) return;
      attempts.set(img, attempt + 1);
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (img.isConnected) img.src = img.dataset.src ?? "";
      }, RETRY_MS * (attempt + 1));
      timers.add(timer);
    };
    const retry = (event: Event) => {
      if (event.target instanceof HTMLImageElement) retryImage(event.target);
    };
    // The images in the server's markup may have failed before this ran (there was no listener to hear it).
    scroller.querySelectorAll<HTMLImageElement>("img[data-src][src]").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) retryImage(img);
    });

    scroller.addEventListener("scroll", schedule, { passive: true });
    scroller.addEventListener("error", retry, true);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      scroller.removeEventListener("scroll", schedule);
      scroller.removeEventListener("error", retry, true);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [scrollerRef, films]);
}
