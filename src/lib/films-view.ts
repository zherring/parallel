/**
 * The views of a page's films, "Timeline" and "Table" (and, for a pair with curated quotes, critics
 * or reading, "Clippings"), as tabs of one section: which view a
 * URL selects, how a tab change is written back to the URL, how the view is carried when the
 * visitor adds a person and the film count of the headline. Pure, so the rules are
 * testable and the server and the browser agree on them.
 *
 * The URL carries the view as `?view=table`. Timeline is the default and is left out, except where
 * leaving it out would be read as Table: a sorted-table link (`?sort=...&dir=...`, with no `view`)
 * opens the Table, so choosing Timeline on such a URL writes `view=timeline` to say so. A link to one quote
 * (`?quote=<id>`, with an id the page has) opens the Clippings without saying so.
 */

import { DIR_PARAM, SORT_PARAM } from "@/lib/films-table";
import { filmCountLabel } from "@/lib/format";

/** The views of the flat page, in order. The first one is the default (and what the server always renders). */
export const VIEWS = ["timeline", "table", "clippings"] as const;
export type View = (typeof VIEWS)[number];

export const DEFAULT_VIEW: View = "timeline";

export const VIEW_LABELS: Record<View, string> = {
  timeline: "Timeline",
  table: "Table",
  clippings: "Quotes",
};

/** The views every page has; Clippings is added for a pair that has something for it, see `availableViews`. */
export const BASE_VIEWS: readonly View[] = ["timeline", "table"];

/**
 * Whether a page has anything for the Clippings tab: any quote of the pair about each other (`clippings`), any critic's
 * quote or any piece of reading about the collaboration (`critics`). Any one alone is enough; the tab then shows only
 * what there is.
 */
export function hasClippingsTab(
  clippings: { clippings: readonly unknown[] } | null | undefined,
  critics: { critics: readonly unknown[]; reading: readonly unknown[] } | null | undefined,
): boolean {
  return (clippings?.clippings.length ?? 0) > 0 || (critics?.critics.length ?? 0) > 0 || (critics?.reading.length ?? 0) > 0;
}

/**
 * The ids of every quote a page's Clippings has, the artists' and the critics': what a `?quote=` link can name.
 * Empty for a page without quotes.
 */
export function quoteIdsOf(
  clippings: { clippings: readonly { id: string }[] } | null | undefined,
  critics: { critics: readonly { id: string }[] } | null | undefined,
): string[] {
  return [...(clippings?.clippings ?? []).map((c) => c.id), ...(critics?.critics ?? []).map((c) => c.id)];
}

/** The views a page offers as tabs: Clippings only when the page has something for it, see `hasClippingsTab`. */
export function availableViews(clippingsTab: boolean): readonly View[] {
  return clippingsTab ? VIEWS : BASE_VIEWS;
}

/**
 * The view to show for what the URL selected: the same, unless the page does not offer it (a
 * `?view=clippings` link to a pair with neither quotes nor critics), when it is the default.
 */
export function resolveView(view: View, available: readonly View[]): View {
  return available.includes(view) ? view : DEFAULT_VIEW;
}

export const VIEW_PARAM = "view";

/**
 * The Depth view (`?view=depth`): the same films in a vertical, perspective scene (see `lib/depth-layout`). It is not one of
 * the `VIEWS`: those are the Timeline and Table tabs, and `parseView` keeps reading a `view=depth` query as the default.
 * The view is only carried from page to page (see `carryView`); the Depth page has no tabs.
 */
export const DEPTH_VIEW = "depth";

/**
 * The page's views of its films are three: Films (the Depth view, `?view=depth`: the films as a scene in depth), the flat Timeline and the Table. The
 * segmented control in the page bar chooses between them, in this order, and a pair that has quotes has a fourth view, the Quotes, a link of its own beside
 * them. The address and the code still say `depth`; what a person reads is "Films".
 */
export const FILMS_VIEWS = [DEPTH_VIEW, "timeline", "table"] as const;
export type FilmsView = (typeof FILMS_VIEWS)[number];

export const FILMS_VIEW_LABELS: Record<FilmsView, string> = {
  depth: "Films",
  timeline: "Timeline",
  table: "Table",
};

/** Every view a `/p/` page can be on: the three films views, and the Clippings (the Quotes). */
export type PageView = FilmsView | "clippings";

/** What a person reads on each segment of the page bar's control: the three films views, and the Quotes (`clippings` in the address and the code). */
export const SWITCHER_LABELS: Record<PageView, string> = { ...FILMS_VIEW_LABELS, clippings: "Quotes" };

/**
 * The segments of the page bar's control, in order: Films, Timeline, Table, and Quotes as the fourth for a page that has quotes (`hasQuotes`, see
 * `hasClippingsTab`). Without quotes the control is the three films views.
 */
export function switcherViews(hasQuotes: boolean): readonly PageView[] {
  return hasQuotes ? [...FILMS_VIEWS, "clippings"] : FILMS_VIEWS;
}

/** Whether the view is one of the films views (Films, Timeline, Table) rather than the Clippings (the Quotes). */
export function isFilmsView(view: PageView): view is FilmsView {
  return view !== "clippings";
}

/** The quote a link to the Clippings opens on (`?view=clippings&quote=<id>`, see `quoteLinkSearch`). It belongs to that view alone. */
export const QUOTE_PARAM = "quote";

/** Whether the query names a sort: the table's own `?sort=` and `&dir=`. */
function hasSortParams(params: URLSearchParams): boolean {
  return params.has(SORT_PARAM) || params.has(DIR_PARAM);
}

type ParamValue = string | string[] | undefined;

/**
 * The query as `URLSearchParams`: the `searchParams` of a page (the first of a repeated parameter, a parameter with no
 * value left out), a query string with or without its "?", or the `URLSearchParams` themselves.
 */
function paramsOf(source: string | URLSearchParams | Record<string, ParamValue>): URLSearchParams {
  if (typeof source === "string") return new URLSearchParams(source);
  if (source instanceof URLSearchParams) return source;
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(source)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params.set(name, first);
  }
  return params;
}

/**
 * The view a query selects. `view=table`, `view=timeline` and `view=clippings` say so outright; without a (known)
 * `view`, a `quote` that is one of the page's (`quoteIds`: a link to one quote, see `quoteLinkSearch`) means the Clippings,
 * where the quote is, and a query that carries a sort means the visitor was looking at the table, so a sorted link
 * opens it; anything else is the default. The page's own quotes are what make a `quote` count: one it does not have
 * is ignored, as the page and its preview card ignore it. `search` is `window.location.search` (with or without the
 * leading "?"), or the page's `searchParams`.
 */
export function parseView(
  search: string | URLSearchParams | Record<string, ParamValue>,
  quoteIds: Iterable<string> = [],
): View {
  const params = paramsOf(search);
  const named = VIEWS.find((view) => view === params.get(VIEW_PARAM));
  if (named) return named;
  const quote = params.get(QUOTE_PARAM)?.trim();
  if (quote) for (const id of quoteIds) if (id === quote) return "clippings";
  return hasSortParams(params) ? "table" : DEFAULT_VIEW;
}

/** What a redirect to another spelling of a page's address carries of the view: `view`, the table's `sort` and `dir`, and `quote`. Others are not the view's. */
const VIEW_PARAMS = [VIEW_PARAM, SORT_PARAM, DIR_PARAM, QUOTE_PARAM] as const;

/**
 * Those of the view's own parameters (see `VIEW_PARAMS`) that a `searchParams` object has, with a value, in that order and
 * as written (the first of a repeated one): for a redirect to the canonical address of a page, which must open on
 * the same view, sort and quote as the address it replaces.
 */
export function viewParams(query: Record<string, ParamValue>): URLSearchParams {
  const all = paramsOf(query);
  const params = new URLSearchParams();
  for (const name of VIEW_PARAMS) {
    const value = all.get(name);
    if (value) params.set(name, value);
  }
  return params;
}

/**
 * The query string (with its "?", or "" when it is empty) after switching to `view`: every other
 * parameter is kept. Table writes `view=table`; Timeline writes nothing, unless a sort is in the
 * query, where it writes `view=timeline` so the sort does not pull the visitor back to the table.
 * A quote (`quote=<id>`) belongs to the Clippings alone, so any other view drops it: the address bar
 * then no longer names a quote that is not on screen (and a copied link does not unfurl as one).
 */
export function searchWithView(search: string, view: View): string {
  const params = new URLSearchParams(search);
  if (view !== "clippings") params.delete(QUOTE_PARAM);
  if (view !== DEFAULT_VIEW) params.set(VIEW_PARAM, view);
  else if (hasSortParams(params)) params.set(VIEW_PARAM, view);
  else params.delete(VIEW_PARAM);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * `href` for a navigation to another page of people (a person added from a search, a chip or a
 * film's cast), carrying the view the visitor is on: `currentSearch` is the query of the page they
 * leave. Only the Table and the Depth view need carrying (Timeline is what a page without `view`
 * opens; the Clippings are the pair's own), and the sort does not travel, since the films it ordered are not the films of the new page.
 */
export function carryView(href: string, currentSearch: string): string {
  const carried = new URLSearchParams(currentSearch).get(VIEW_PARAM) === DEPTH_VIEW ? DEPTH_VIEW : parseView(currentSearch);
  // Timeline is what a page without `view` opens; the Clippings belong to the pair they are about, so they stay behind.
  if (carried !== DEPTH_VIEW && carried !== "table") return href;
  const hash = href.indexOf("#");
  const path = hash === -1 ? href : href.slice(0, hash);
  const rest = hash === -1 ? "" : href.slice(hash);
  return `${path}${path.includes("?") ? "&" : "?"}${VIEW_PARAM}=${carried}${rest}`;
}

/**
 * Whether the view is about the page's films (Timeline, Table) rather than the clippings. The films'
 * own controls go with it: Export (the CSV is the table), the minor-credits checkbox, the note on
 * where the numbers come from and the empty-state message. Share stays on every view, since it links to the page.
 */
export function isFilmView(view: View): boolean {
  return view !== "clippings";
}

/**
 * Whether the toolbar says what period the page is showing ("Showing 1966–1981 · Show full career"): only on the Timeline,
 * where a period dims the films outside it. The Table and the CSV list every film, so a period note there would be a claim
 * about rows that are not filtered.
 */
export function showsPeriodNote(view: View): boolean {
  return view === "timeline";
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
