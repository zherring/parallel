"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_FILMS_VIEW, FILMS_VIEW_KEY, createFilmsViewStore, type StorageLike } from "@/lib/films-view-pref";
import type { FilmsView } from "@/lib/films-view";

/** The browser's `localStorage`, or none: reading the property itself throws when site data is blocked. */
function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// One store for the page session. The page bar of the flat page and of the Focus view are different components, and moving between them
// is a client-side navigation, so a module outlives them all.
const store = createFilmsViewStore(browserStorage);

function subscribe(onChange: () => void) {
  const unsubscribe = store.subscribe(onChange);
  // Another tab used a view: `storage` fires in the other documents only, with a null key when the storage was cleared.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FILMS_VIEW_KEY) store.reload();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener("storage", onStorage);
  };
}

// The server and the first client render (hydration) never know the visitor's view, so they match; the stored one arrives right after.
const getServerView = (): FilmsView => DEFAULT_FILMS_VIEW;

/** Records `view` as the films view last used. Not a hook: it is for an effect to call. */
export const recordFilmsView = (view: FilmsView) => store.set(view);

/**
 * The films view the visitor last used (Timeline until they used another), read from `localStorage` once the page has hydrated. The page bar's
 * Films tab goes to it; the pages record the view they are on with `recordFilmsView`.
 */
export function useFilmsViewPref(): FilmsView {
  return useSyncExternalStore(subscribe, store.get, getServerView);
}
