/** The tabs of the film panel, in display order. */
export const FILM_TABS = ["cast", "crew"] as const;
export type FilmTab = (typeof FILM_TABS)[number];

export const DEFAULT_FILM_TAB: FilmTab = "cast";

/** Module scope, so it lasts for the page session (cleared on reload) and outlives the panel. */
let lastFilmTab: FilmTab = DEFAULT_FILM_TAB;

/** The tab chosen last, so the next film opens on the tab the visitor was on. */
export const rememberedFilmTab = (): FilmTab => lastFilmTab;

export function rememberFilmTab(tab: FilmTab): void {
  lastFilmTab = tab;
}

/**
 * The tab to move to for a WAI-ARIA tabs key press, or null when the key is not a tab-navigation
 * key. Left/Right wrap around; Home/End jump to the ends. `current` is the index of the focused tab.
 */
export function nextTabIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Where to put the scroll position after switching tabs: keep it where it is while the tab bar has
 * not yet stuck to the top (the film header is still visible), otherwise bring it back to the point
 * where the bar just sticks so the top of the new tab's content is in view. `barTop` is the bar's
 * natural offset from the top of the scrollable content.
 */
export function scrollTopAfterTabChange(scrollTop: number, barTop: number): number {
  return Math.min(scrollTop, Math.max(0, barTop));
}
