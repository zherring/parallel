"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { PauseReasons } from "@/lib/hero-scenes";

type AutoReason = Exclude<keyof PauseReasons, "reducedMotion">;

/**
 * Everything that holds the hero's rotation still: a preference for reduced motion (the rotation
 * never plays by itself then), the pointer over the stage, a pointer pressed on it (so the link
 * cannot change under a click or tap), keyboard focus on its link or on Previous or Next (set by
 * the caller with `set`), the search overlay being open, the hero scrolled out of view and
 * the tab in the background.
 */
export function useHeroPause(root: RefObject<HTMLElement | null>, reducedMotion: boolean) {
  const [flags, setFlags] = useState<Omit<PauseReasons, "reducedMotion">>({
    hover: false,
    focus: false,
    press: false,
    search: false,
    offscreen: false,
    hidden: false,
  });

  const set = useCallback((reason: AutoReason, value: boolean) => {
    setFlags((current) => (current[reason] === value ? current : { ...current, [reason]: value }));
  }, []);

  // The pointer over the stage (a mouse or pen; a touch has no hover to wait out), and a pointer
  // pressed on it. A press is let go a moment after the pointer is, so the click it ends is safe.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let release = 0;
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") set("hover", true);
    };
    const leave = () => set("hover", false);
    const down = () => {
      window.clearTimeout(release);
      set("press", true);
    };
    const up = () => {
      window.clearTimeout(release);
      release = window.setTimeout(() => set("press", false), 600);
    };
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("pointercancel", leave);
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.clearTimeout(release);
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("pointercancel", leave);
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      set("hover", false);
      set("press", false);
    };
  }, [root, set]);

  // The search overlay, while it is open: it is portalled into <body> (universal-search.tsx), the page behind it is inert, and the stage would
  // otherwise change scene behind its scrim.
  useEffect(() => {
    const sync = () => set("search", document.querySelector("[data-universal-search]") !== null);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true });
    sync();
    return () => {
      observer.disconnect();
      set("search", false);
    };
  }, [set]);

  // The hero scrolled out of view.
  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (latest) set("offscreen", !latest.isIntersecting);
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [root, set]);

  // The tab in the background.
  useEffect(() => {
    const update = () => set("hidden", document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [set]);

  return { reasons: { reducedMotion, ...flags } satisfies PauseReasons, set };
}
