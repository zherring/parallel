"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_VIEW, parseView, searchWithView, type View } from "@/lib/films-view";

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

const getView = (): View => parseView(window.location.search);
// The server and the first client render (hydration) always show the default, so they match.
const getServerView = (): View => DEFAULT_VIEW;

/**
 * `[view, setView]`: the selected view of a page's films (Timeline or Table), read from the
 * address bar after the page has hydrated (a plain `/p/...` link, and the server's HTML, are the
 * Timeline) and written back with `history.replaceState`, which neither navigates nor re-renders
 * the route. Every component that uses it follows the same address bar.
 */
export function useViewTab(): readonly [View, (view: View) => void] {
  const view = useSyncExternalStore(subscribe, getView, getServerView);

  const setView = useCallback((next: View) => {
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, "", `${pathname}${searchWithView(search, next)}${hash}`);
    for (const notify of listeners) notify();
  }, []);

  return [view, setView];
}
