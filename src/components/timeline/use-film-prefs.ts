"use client";

import { useCallback, useSyncExternalStore } from "react";
import { NO_HELD_PREFS, prefsFor, updatePrefs, type FilmPrefs, type HeldPrefs } from "@/lib/film-prefs";

// The preferences live in the browser's memory (see `lib/film-prefs`): the Timeline and the Depth view are different
// components, and moving between them is a client-side navigation, so a module outlives both. A reload starts over, as it
// always did. A change notifies the subscribers itself.
let held: HeldPrefs = NO_HELD_PREFS;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getHeld = () => held;
// The server and the first client render (hydration) never see a choice, so they match.
const getServerHeld = () => NO_HELD_PREFS;

/**
 * `[prefs, update]`: the display preferences of the page of the people `key` (their ids joined, as the views key
 * themselves), shared by the Timeline and the Depth view, and a function that changes some of them.
 */
export function useFilmPrefs(key: string): readonly [FilmPrefs, (patch: Partial<FilmPrefs>) => void] {
  const snapshot = useSyncExternalStore(subscribe, getHeld, getServerHeld);
  const update = useCallback(
    (patch: Partial<FilmPrefs>) => {
      const next = updatePrefs(held, key, patch);
      if (next === held) return;
      held = next;
      for (const notify of listeners) notify();
    },
    [key],
  );
  return [prefsFor(snapshot, key), update];
}
