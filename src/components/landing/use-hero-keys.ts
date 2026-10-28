"use client";

import { useEffect, useRef } from "react";
import type { NavDirection } from "@/lib/hero-history";
import { describeKeyTarget, heroKeyAction, type ElementLike } from "@/lib/hero-keys";

interface Options {
  /** The hero is at least partly in the viewport: the arrows do nothing when it is not. */
  heroVisible: boolean;
  onNavigate: (direction: NavDirection) => void;
}

/**
 * ArrowLeft and ArrowRight as the hero's Previous and Next, from anywhere on the page that does
 * not use those keys itself (see heroKeyAction). One listener on the document, for as long as the
 * hero is mounted. `preventDefault()` only when the key acted.
 */
export function useHeroKeys({ heroVisible, onNavigate }: Options): void {
  const latest = useRef({ heroVisible, onNavigate });
  useEffect(() => {
    latest.current = { heroVisible, onNavigate };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // An element is structurally an ElementLike (HTMLInputElement has the value and selection).
      const target = event.target instanceof Element ? (event.target as ElementLike) : null;
      const action = heroKeyAction(
        {
          key: event.key,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          defaultPrevented: event.defaultPrevented,
          isComposing: event.isComposing,
          repeat: event.repeat,
          target: describeKeyTarget(target),
        },
        { heroVisible: latest.current.heroVisible },
      );
      if (!action) return;
      event.preventDefault();
      latest.current.onNavigate(action);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
