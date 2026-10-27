"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { PauseReasons } from "@/lib/hero-scenes";

type AutoReason = Exclude<keyof PauseReasons, "user">;

/**
 * Everything that holds the hero's rotation still: the visitor's pause button, the pointer over
 * the collage, keyboard focus on its link (set by the caller with `set`), someone typing in the
 * search field, the hero scrolled out of view and the tab in the background.
 *
 * The search field counts only once the visitor is using it: it is autofocused on desktop, so
 * "focused" alone would hold the collage still from the first paint. A key press, a click or any
 * text in it means they are typing.
 */
export function useHeroPause(root: RefObject<HTMLElement | null>, userPaused: boolean) {
  const [flags, setFlags] = useState<Omit<PauseReasons, "user">>({
    hover: false,
    focus: false,
    search: false,
    offscreen: false,
    hidden: false,
  });

  const set = useCallback((reason: AutoReason, value: boolean) => {
    setFlags((current) => (current[reason] === value ? current : { ...current, [reason]: value }));
  }, []);

  // The pointer over the collage (a mouse or pen; a touch has no hover to wait out).
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") set("hover", true);
    };
    const leave = () => set("hover", false);
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("pointercancel", leave);
    return () => {
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("pointercancel", leave);
      set("hover", false);
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
    box.addEventListener("keydown", engage);
    box.addEventListener("input", engage);
    box.addEventListener("pointerdown", engage);
    sync();
    return () => {
      box.removeEventListener("focusin", focusIn);
      box.removeEventListener("focusout", focusOut);
      box.removeEventListener("keydown", engage);
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

  return { reasons: { user: userPaused, ...flags } satisfies PauseReasons, set };
}
