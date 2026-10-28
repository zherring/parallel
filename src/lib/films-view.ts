/**
 * The two views of a page's films, "Timeline" and "Table", as tabs of one section: which view a
 * URL selects, how a tab change is written back to the URL, how the view is carried when the
 * visitor adds a person, the film count of the headline and the tab keys. Pure, so the rules are
 * testable and the server and the browser agree on them.
 *
 * The URL carries the view as `?view=table`. Timeline is the default and is left out, except where
 * leaving it out would be read as Table: a sorted-table link (`?sort=...&dir=...`, with no `view`)
 * opens the Table, so choosing Timeline on such a URL writes `view=timeline` to say so.
 */

import { DIR_PARAM, SORT_PARAM } from "@/lib/films-table";
import { filmCountLabel } from "@/lib/format";
import { nextTabIndex } from "@/lib/tabs";

/** The views, in tab order. The first one is the default (and what the server always renders). */
export const VIEWS = ["timeline", "table"] as const;
export type View = (typeof VIEWS)[number];

export const DEFAULT_VIEW: View = "timeline";

export const VIEW_LABELS: Record<View, string> = {
  timeline: "Timeline",
  table: "Table",
};

export const VIEW_PARAM = "view";

/** Whether the query names a sort: the table's own `?sort=` and `&dir=`. */
function hasSortParams(params: URLSearchParams): boolean {
  return params.has(SORT_PARAM) || params.has(DIR_PARAM);
}

/**
 * The view a query string selects. `view=table` and `view=timeline` say so outright; without a
 * (known) `view`, a query that carries a sort means the visitor was looking at the table, so a
 * sorted link opens it; anything else is the default. `search` is `window.location.search`, with
 * or without the leading "?".
 */
export function parseView(search: string): View {
  const params = new URLSearchParams(search);
  const named = VIEWS.find((view) => view === params.get(VIEW_PARAM));
  if (named) return named;
  return hasSortParams(params) ? "table" : DEFAULT_VIEW;
}

/**
 * The query string (with its "?", or "" when it is empty) after switching to `view`: every other
 * parameter is kept. Table writes `view=table`; Timeline writes nothing, unless a sort is in the
 * query, where it writes `view=timeline` so the sort does not pull the visitor back to the table.
 */
export function searchWithView(search: string, view: View): string {
  const params = new URLSearchParams(search);
  if (view !== DEFAULT_VIEW) params.set(VIEW_PARAM, view);
  else if (hasSortParams(params)) params.set(VIEW_PARAM, view);
  else params.delete(VIEW_PARAM);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * `href` for a navigation to another page of people (a person added from a search, a chip or a
 * film's cast), carrying the view the visitor is on: `currentSearch` is the query of the page they
 * leave. Only the Table needs carrying (Timeline is what a page without `view` opens), and the
 * sort does not travel, since the films it ordered are not the films of the new page.
 */
export function carryView(href: string, currentSearch: string): string {
  if (parseView(currentSearch) !== "table") return href;
  const hash = href.indexOf("#");
  const path = hash === -1 ? href : href.slice(0, hash);
  const rest = hash === -1 ? "" : href.slice(hash);
  return `${path}${path.includes("?") ? "&" : "?"}${VIEW_PARAM}=table${rest}`;
}

/**
 * The view to move to for a key pressed on a tab: ArrowLeft and ArrowRight wrap around, Home and
 * End jump to the first and last. null for any other key.
 */
export function viewForKey(key: string, current: View): View | null {
  const index = nextTabIndex(key, VIEWS.indexOf(current), VIEWS.length);
  return index === null ? null : VIEWS[index];
}

/**
 * The film count the page headline carries after the names ("Harrison Ford & George Lucas, 11
 * films"): "11 films", "1 film", or null when there are none, so the headline is just the names
 * and the panel's empty state says what is missing. `count` is the number the table lists (and
 * the checkbox under the panels changes); the server's is the default one, the checkbox off.
 */
export function headlineCount(count: number): string | null {
  return count > 0 ? filmCountLabel(count) : null;
}

/**
 * What the checkbox under the panels says, politely, after it is toggled: its effect (more or
 * fewer films, in the lanes and the table) is usually above the fold.
 */
export function showingMessage(count: number, together: boolean): string {
  if (count === 0) return together ? "No films together to show" : "No films to show";
  return `Showing ${filmCountLabel(count)}${together ? " together" : ""}`;
}
