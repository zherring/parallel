"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_VIEW, availableViews, parseView, resolveView, searchWithView, type View } from "@/lib/films-view";
import { notifyLocationChange } from "@/lib/use-live-search";

// The selected view lives in the URL (`?view=table`, see `parseView`). `replaceState` fires no
// event, so a change made here notifies the subscribers itself; `popstate` covers back and forward.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/**
 * `[view, setView]`: the selected view of a page's films (Timeline, Table, or Clippings when
 * `clippingsTab`, see `hasClippingsTab`), read from the address bar after the page has hydrated and
 * written back with `history.replaceState`, which neither navigates nor re-renders the route. Every
 * component that uses it follows the same address bar. A view the page does not offer (`?view=clippings`
 * on a pair with neither quotes nor critics) is the default view. `quoteIds` are the ids of the page's
 * quotes (see `quoteIdsOf`): a link that names one of them (`?quote=<id>`) opens the Clippings even
 * without `view=clippings`, as its preview card promises.
 *
 * `initialView` is what the server resolved from the same query. The server and the first client render
 * must agree, so it is what both draw; without it (a component with no server-read query) the default is
 * drawn first and the address bar takes over after hydration.
 */
export function useViewTab(
  clippingsTab: boolean,
  quoteIds: readonly string[] = [],
  initialView: View = DEFAULT_VIEW,
): readonly [View, (view: View) => void] {
  const getView = (): View => parseView(window.location.search, quoteIds);
  const server = resolveView(initialView, availableViews(clippingsTab));
  const getServerView = () => server;
  const selected = useSyncExternalStore(subscribe, getView, getServerView);
  const view = resolveView(selected, availableViews(clippingsTab));

  const setView = useCallback((next: View) => {
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, "", `${pathname}${searchWithView(search, next)}${hash}`);
    for (const notify of listeners) notify();
    notifyLocationChange();
  }, []);

  return [view, setView];
}
