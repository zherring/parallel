"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { heroCollapsed } from "@/lib/pair-hero";

/** What a view scrolls: its own scroller (Films' scene, the Timeline's track) or the page. */
export type HeroScroller = HTMLElement | Window;

interface HeroCollapseOptions {
  /** The view's main scroller, looked up when the view is on screen (in an effect, never during a render). Null: there is none yet, and the hero stays expanded. Keep it stable (`useCallback`). */
  getScroller: () => HeroScroller | null;
  /** Which way the scroller moves that counts: the Timeline's track sideways (`x`), the scene and the page down (`y`). */
  axis: "x" | "y";
  /** Where the scroller lands, when that is known up front (the Table and the Quotes land at the top of the page, 0). Without it the landing is wherever the scroller is a frame after the view opened: Films lands mid-career, the Timeline at its first collaboration. */
  landing?: number;
  /** A different key is a different view: the hero starts expanded again and the landing is read again. */
  resetKey: string;
}

/**
 * Whether the pair hero is collapsed into the compact bar, for the view whose main scroller `getScroller` finds: expanded when the view opens, collapsed
 * once the scroller is 48px or more from where it landed (either way), expanded again within 48px of it (`heroCollapsed`). The check runs once per frame at
 * most (a `requestAnimationFrame` behind the scroll listener, as the year rail's and the minimap's do), and reads one number off the scroller.
 *
 * `collapse()` collapses the hero by hand, for a jump to a film that may leave the scroller near where it was (a chip pressed): it stays collapsed until the
 * scroller has been 48px away and back.
 */
export function useHeroCollapse({ getScroller, axis, landing: fixedLanding, resetKey }: HeroCollapseOptions) {
  // The key of the view the flag is about: a flag left over from another view is not this one's.
  const [state, setState] = useState({ key: resetKey, collapsed: false });
  const forced = useRef(false);

  const apply = useCallback(
    (collapsed: boolean) => setState((prev) => (prev.key === resetKey && prev.collapsed === collapsed ? prev : { key: resetKey, collapsed })),
    [resetKey],
  );

  useEffect(() => {
    forced.current = false;
    const target = getScroller();
    if (!target) return;
    const offset = () =>
      target instanceof Window
        ? axis === "y"
          ? target.scrollY
          : target.scrollX
        : axis === "y"
          ? target.scrollTop
          : target.scrollLeft;
    let landing: number | null = fixedLanding ?? null;
    let frame = 0;
    const evaluate = () => {
      frame = 0;
      // The first frame after the view opened: where it landed, once everything that places it (a linked period, the first collaboration) has.
      if (landing === null) landing = offset();
      const away = heroCollapsed(offset(), landing);
      if (away) forced.current = false;
      apply(away || forced.current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(evaluate);
    };
    schedule();
    target.addEventListener("scroll", schedule, { passive: true });
    return () => {
      target.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [getScroller, axis, fixedLanding, resetKey, apply]);

  const collapse = useCallback(() => {
    forced.current = true;
    apply(true);
  }, [apply]);

  return { collapsed: state.key === resetKey && state.collapsed, collapse };
}
