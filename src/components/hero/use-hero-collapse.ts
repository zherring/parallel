"use client";

import { useCallback, useEffect, useState } from "react";
import { heroCollapsed, nextHeroState, type HeroState } from "@/lib/pair-hero";

/** What a view scrolls: its own scroller (Films' scene, the Timeline's track) or the page. */
export type HeroScroller = HTMLElement | Window;

interface HeroCollapseOptions {
  /** The view's main scroller, looked up when the view is on screen (in an effect, never during a render). Null: there is none yet, and the hero stays expanded. Keep it stable (`useCallback`). */
  getScroller: () => HeroScroller | null;
  /**
   * Which way the scroller moves that counts: the scene and the page down (`y`), the Timeline's track sideways (`x`). The Timeline is `both`: a track that is narrower than the
   * screen (a short career at a wide zoom-out) has nothing to scroll sideways, and then its rows, which scroll down, are what moves; either one, 48px from where it landed, collapses the hero.
   */
  axis: "x" | "y" | "both";
  /** Where the scroller starts, when that is known up front (the Table and the Quotes start at the top, 0). Without it the start is wherever the scroller is a frame after the view opened: Films and the Timeline start on the first collaboration (the Timeline at its bottom, too, where it scrolls down). */
  landing?: number;
  /** A different key is a different view: the hero starts expanded again (it stays collapsed only within one view) and the start is read again. */
  resetKey: string;
}

/**
 * Whether the pair hero is collapsed into the compact bar, for the view whose main scroller `getScroller` finds: expanded when the view opens, collapsed
 * once the scroller is 48px or more from where it landed (either way, `heroCollapsed`), and then collapsed for good: scrolling back to where it landed does not
 * unfurl it again (Films and the Timeline land mid-track, so that would happen midway through the page). What expands it again is another view (`resetKey`: each view
 * opens with the hero expanded, and the page bar's links to the others switch it) and a page load. `nextHeroState` is the rule. The check runs once per frame at
 * most (a `requestAnimationFrame` behind the scroll listener, as the year rail's and the minimap's do), and reads one number off the scroller.
 *
 * `collapse()` collapses the hero by hand, for a jump to a film that may leave the scroller near where it was (a chip pressed).
 */
export function useHeroCollapse({ getScroller, axis, landing: fixedLanding, resetKey }: HeroCollapseOptions) {
  // The key of the view the flag is about: a flag left over from another view is not this one's (`nextHeroState`).
  const [state, setState] = useState<HeroState>({ key: resetKey, collapsed: false });

  // `moved`: the view has been moved away from where it landed. The state latches (it only ever goes from expanded to collapsed within one view).
  const settle = useCallback((moved: boolean) => setState((prev) => nextHeroState(prev, resetKey, moved)), [resetKey]);

  useEffect(() => {
    const target = getScroller();
    if (!target) return;
    const offsets = (): number[] => {
      const x = target instanceof Window ? target.scrollX : target.scrollLeft;
      const y = target instanceof Window ? target.scrollY : target.scrollTop;
      return axis === "x" ? [x] : axis === "y" ? [y] : [x, y];
    };
    // Where the scroller landed, one offset per axis that counts. A landing known up front (`fixedLanding`) is for the one axis there is.
    let landing: number[] | null = fixedLanding === undefined ? null : [fixedLanding];
    let frame = 0;
    const evaluate = () => {
      frame = 0;
      // The first frame after the view opened: where it landed, once everything that places it (a linked period, the first collaboration) has.
      if (landing === null) landing = offsets();
      const from = landing;
      settle(offsets().some((offset, index) => heroCollapsed(offset, from[index] ?? 0)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(evaluate);
    };
    // A scroller with nothing to scroll (the Timeline of a short career, on a wide screen, is no wider than the screen) can never be moved the 48px: a press on it is
    // the visitor reaching for the view under the hero, and collapses it, as the scroll would have.
    const press = () => {
      if (target instanceof Window) return;
      const room = (counted: "x" | "y") => (counted === "x" ? target.scrollWidth > target.clientWidth + 1 : target.scrollHeight > target.clientHeight + 1);
      if (axis !== "y" && room("x")) return;
      if (axis !== "x" && room("y")) return;
      settle(true);
    };
    schedule();
    target.addEventListener("scroll", schedule, { passive: true });
    target.addEventListener("pointerdown", press);
    return () => {
      target.removeEventListener("scroll", schedule);
      target.removeEventListener("pointerdown", press);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [getScroller, axis, fixedLanding, resetKey, settle]);

  const collapse = useCallback(() => settle(true), [settle]);

  return { collapsed: state.key === resetKey && state.collapsed, collapse };
}
