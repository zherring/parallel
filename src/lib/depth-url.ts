/**
 * The Depth view's address: `/p/<slug>?view=depth`, the same page as the Timeline and Table, drawn as a vertical
 * perspective scene. Everything about that query that the server (the canonical redirect), the page and the
 * client's links must agree on lives here, pure.
 *
 * Depth is a view of the page, not one of its tabs (see `DEPTH_VIEW` in `films-view`): a link to it that is
 * redirected to its canonical slug keeps `view=depth` and the period, and the links the Depth view itself writes
 * (a person removed, "Flat timeline") keep or drop it as they need to.
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
 * The query (with its "?", or "" for none) a redirect to the canonical slug carries: the period, in its canonical
 * spelling, and `view=depth` when the link asked for it. Every other parameter is dropped.
 */
export function redirectSearch(query: Record<string, ParamValue>): string {
  const params = new URLSearchParams(rawPeriodSearch(parsePeriodParams(query)));
  if (isDepthView(query[VIEW_PARAM])) params.set(VIEW_PARAM, DEPTH_VIEW);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * `search` (with or without its "?") for the flat Timeline: `view=depth` goes, the period and every other
 * parameter stay. Returns "" or a query string with its "?".
 */
export function flatSearch(search: string): string {
  return searchWithView(search, "timeline");
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
