"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_VIEW, availableViews, parseView, resolveView, searchWithView, type View } from "@/lib/films-view";

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

// The server and the first client render (hydration) always show the default, so they match.
const getServerView = (): View => DEFAULT_VIEW;

/**
 * `[view, setView]`: the selected view of a page's films (Timeline, Table, or Clippings when
 * `clippingsTab`, see `hasClippingsTab`), read from the address bar after the page has hydrated (a plain `/p/...` link,
 * and the server's HTML, are the Timeline) and written back with `history.replaceState`, which
 * neither navigates nor re-renders the route. Every component that uses it follows the same
 * address bar. A view the page does not offer (`?view=clippings` on a pair with neither quotes nor
 * critics) is the default view. `quoteIds` are the ids of the page's quotes (see `quoteIdsOf`): a link that names one of
 * them (`?quote=<id>`) opens the Clippings even without `view=clippings`, as its preview card promises.
 */
export function useViewTab(clippingsTab: boolean, quoteIds: readonly string[] = []): readonly [View, (view: View) => void] {
  const getView = (): View => parseView(window.location.search, quoteIds);
  const selected = useSyncExternalStore(subscribe, getView, getServerView);
  const view = resolveView(selected, availableViews(clippingsTab));

  const setView = useCallback((next: View) => {
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, "", `${pathname}${searchWithView(search, next)}${hash}`);
    for (const notify of listeners) notify();
  }, []);

  return [view, setView];
}
