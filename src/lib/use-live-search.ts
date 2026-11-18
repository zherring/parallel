"use client";

import { useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";

/**
 * The address bar's query as the browser has it now, including writes that do not go through the
 * router (the Quotes deck moves `?quote=` with `history.replaceState`). `useSearchParams` alone
 * trails those writes, so a link built from it can point at the quote the visitor has left.
 *
 * The server and the first client render use the router's value (the server does not have a
 * `window`); a deck's write then notifies subscribers itself.
 */

const listeners = new Set<() => void>();

export function notifyLocationChange() {
  for (const notify of listeners) notify();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const getSnapshot = () => window.location.search.replace(/^\?/, "");

export function useLiveSearch(): string {
  const routerSearch = useSearchParams().toString();
  return useSyncExternalStore(subscribe, getSnapshot, () => routerSearch);
}
