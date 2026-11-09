/**
 * The Depth view's address: `/p/<slug>?view=depth`, the same page as the Timeline and Table, drawn as a vertical
 * perspective scene. Everything about that query that the server (the canonical redirect), the page and the
 * client's links must agree on lives here, pure.
 *
 * Depth is a view of the page, not one of its tabs (see `DEPTH_VIEW` in `films-view`): a link to it that is
 * redirected to its canonical slug keeps `view=depth` like any view (see `viewParams`), and the links the Depth view
 * itself writes (a person removed, a switch to the flat page) keep or drop it as they need to.
 */

import { DEPTH_VIEW, VIEW_PARAM, searchWithView } from "@/lib/films-view";
import { parsePeriodParams, rawPeriodSearch } from "@/lib/period";

export { DEPTH_VIEW };

type ParamValue = string | string[] | undefined | null;

/** Whether `?view=` names the Depth view; a repeated parameter uses the first. */
export function isDepthView(value: ParamValue): boolean {
  return (Array.isArray(value) ? value[0] : value) === DEPTH_VIEW;
}

/**
 * `search` (with or without its "?") for the flat Timeline: `view=depth` goes, the period and every other
 * parameter stay. Returns "" or a query string with its "?".
 */
export function flatSearch(search: string): string {
  return searchWithView(search, "timeline");
}

/**
 * The query (with its "?") for the Depth view of the page the visitor is on, from that page's `search`: its period and
 * `view=depth`. Nothing else goes along: a sort, a quote and the view it leaves are the other views' own.
 */
export function depthSearch(search: string): string {
  const params = new URLSearchParams(rawPeriodSearch(parsePeriodParams(search)));
  params.set(VIEW_PARAM, DEPTH_VIEW);
  return `?${params.toString()}`;
}

/** `href` with `view=depth` set (kept last, before a hash), so a link the Depth view writes lands on the Depth view. */
export function withDepth(href: string): string {
  const hash = href.indexOf("#");
  const beforeHash = hash === -1 ? href : href.slice(0, hash);
  const rest = hash === -1 ? "" : href.slice(hash);
  const query = beforeHash.indexOf("?");
  const path = query === -1 ? beforeHash : beforeHash.slice(0, query);
  const params = new URLSearchParams(query === -1 ? "" : beforeHash.slice(query + 1));
  params.set(VIEW_PARAM, DEPTH_VIEW);
  return `${path}?${params.toString()}${rest}`;
}
