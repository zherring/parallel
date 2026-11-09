"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LAYOUT_PREF, LAYOUT_PREF_KEY, createLayoutPrefStore, type LayoutPref, type StorageLike } from "@/lib/layout-pref";

/** The browser's `localStorage`, or none: reading the property itself throws when site data is blocked. */
function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// One store for the page session. The Timeline tab, the layout control and the Depth view's bar are different components, and
// moving between the flat page and the Depth view is a client-side navigation, so a module outlives them all.
const store = createLayoutPrefStore(browserStorage);

function subscribe(onChange: () => void) {
  const unsubscribe = store.subscribe(onChange);
  // Another tab chose a layout: `storage` fires in the other documents only, with a null key when the storage was cleared.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LAYOUT_PREF_KEY) store.reload();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener("storage", onStorage);
  };
}

// The server and the first client render (hydration) never know a choice, so they match; the stored one arrives right after.
const getServerPref = (): LayoutPref => DEFAULT_LAYOUT_PREF;

/**
 * `[pref, choose]`: the timeline layout the visitor last chose (Focus or Combined; Combined until they choose), read from
 * `localStorage` once the page has hydrated, and a function that remembers a new choice. The Timeline tab goes to the Depth view
 * when it is Focus, and the layout control sets it; nothing redirects on load.
 */
export function useLayoutPref(): readonly [LayoutPref, (next: LayoutPref) => void] {
  const pref = useSyncExternalStore(subscribe, store.get, getServerPref);
  return [pref, store.set];
}
