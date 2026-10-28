"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { PauseReasons } from "@/lib/hero-scenes";

type AutoReason = Exclude<keyof PauseReasons, "reducedMotion">;

/**
 * Everything that holds the hero's rotation still: a preference for reduced motion (the rotation
 * never plays by itself then), the pointer over the collage, a pointer pressed on it (so the link
 * cannot change under a click or tap), keyboard focus on its link or on Previous or Next (set by
 * the caller with `set`), someone typing in the search field, the hero scrolled out of view and
 * the tab in the background.
 *
 * The search field counts only once the visitor is using it: it is autofocused on desktop, so
 * "focused" alone would hold the collage still from the first paint. A key press, a click or any
 * text in it means they are typing. (Not ArrowLeft and ArrowRight in an empty field: those drive
 * the hero's Previous and Next, see use-hero-keys.ts.)
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

  // The pointer over the collage (a mouse or pen; a touch has no hover to wait out), and a pointer
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

  // The search field, while it is being used.
  useEffect(() => {
    const box = root.current?.closest("section")?.querySelector<HTMLElement>("[data-hero-search]");
    if (!box) return;
    let engaged = false;
    const input = () => box.querySelector("input");
    const sync = () => {
      const field = input();
      const focused = field !== null && document.activeElement === field;
      set("search", focused && (engaged || field.value.length > 0));
    };
    const engage = () => {
      engaged = true;
      sync();
    };
    const keydown = (event: KeyboardEvent) => {
      const arrow = event.key === "ArrowLeft" || event.key === "ArrowRight";
      if (arrow && input()?.value === "") return;
      engage();
    };
    const focusIn = () => {
      engaged = false;
      sync();
    };
    const focusOut = () => {
      engaged = false;
      set("search", false);
    };
    box.addEventListener("focusin", focusIn);
    box.addEventListener("focusout", focusOut);
    box.addEventListener("keydown", keydown);
    box.addEventListener("input", engage);
    box.addEventListener("pointerdown", engage);
    sync();
    return () => {
      box.removeEventListener("focusin", focusIn);
      box.removeEventListener("focusout", focusOut);
      box.removeEventListener("keydown", keydown);
      box.removeEventListener("input", engage);
      box.removeEventListener("pointerdown", engage);
      set("search", false);
    };
  }, [root, set]);

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
