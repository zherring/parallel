"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parsePeriodParams, searchWithPeriod, type Period, type RawPeriod } from "@/lib/period";

// A shared period lives in the URL (`?from=1978&to=1993`, see `lib/period`) and is the one place
// it is kept: the minimap's brush, the Share menu's year selects, the "Show full career" link and
// the timeline all read it from here, and write it with `history.replaceState` (which neither
// navigates nor re-renders the route, and adds no history entry). `replaceState` fires no event, so
// a write notifies the subscribers itself; `popstate` covers back and forward.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const getSearch = () => window.location.search;
// The server and the first client render (hydration) never see a period, so they match.
const getServerSearch = () => "";

/** The last period this page's own controls wrote, by page; see `isSenderPeriod`. */
let written: { path: string; key: string | null } | null = null;

const keyOf = (period: Period | null) => (period ? `${period.from}-${period.to}` : null);

/**
 * Whether `period` is one the visitor just chose with this page's own controls (the brush, the Share
 * menu) rather than one a link arrived with. The timeline opens on the second kind, zooming and
 * scrolling to it, and must stay where it is for the first: someone choosing what to share is still
 * looking around.
 */
export function isSenderPeriod(period: Period): boolean {
  return written !== null && written.path === window.location.pathname && written.key === keyOf(period);
}

/**
 * `[period, setPeriod]`: the years the address bar asks the page to open on (open ends are null
 * until `resolvePeriod` closes them against the page's films), read after the page has hydrated;
 * and a function that writes a period to it, or takes it away with null, keeping every other
 * parameter.
 */
export function useUrlPeriod(): readonly [RawPeriod, (next: Period | null) => void] {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const period = useMemo(() => parsePeriodParams(search), [search]);

  const setPeriod = useCallback((next: Period | null) => {
    const { pathname, search: current, hash } = window.location;
    written = { path: pathname, key: keyOf(next) };
    window.history.replaceState(null, "", `${pathname}${searchWithPeriod(current, next)}${hash}`);
    for (const notify of listeners) notify();
  }, []);

  return [period, setPeriod];
}
