import { scrollBehavior } from "./scroll-behavior";

/** How long a row that was jumped to stays lit (ms), as long as the flash in globals.css. */
const FLASH_MS = 1800;

const timers = new WeakMap<Element, number>();

/** Whether the element takes room on the page: the Table's rows are in the page for a phone's cards too, hidden by the breakpoint. */
function isShown(element: Element): boolean {
  return element.getClientRects().length > 0;
}

/**
 * Brings a film's row in the Table into view (the middle of the screen, smoothly unless the visitor asked for less motion) and lights it for a moment
 * (`data-flash`, see globals.css). On a phone that is the film's card. Returns whether the film is in the Table: false when no row of it is shown.
 */
export function revealFilmRow(filmId: number): boolean {
  const row = [...document.querySelectorAll<HTMLElement>(`[data-film-row="${filmId}"]`)].find(isShown);
  if (!row) return false;
  row.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  window.clearTimeout(timers.get(row));
  // Off and on again, so that a second jump to the same row lights it again.
  row.removeAttribute("data-flash");
  void row.offsetWidth;
  row.setAttribute("data-flash", "");
  timers.set(
    row,
    window.setTimeout(() => row.removeAttribute("data-flash"), FLASH_MS),
  );
  return true;
}
