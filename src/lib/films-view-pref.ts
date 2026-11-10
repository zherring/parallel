/**
 * The films view a visitor last used, Timeline, Focus (the Depth view) or Table, remembered for next time: the page bar's Films tab goes
 * to it, so a visitor who looks at the Clippings and comes back to the Films lands where they were. It is kept in the browser's
 * `localStorage`, per viewer, and not in the address: a shared link and a new visitor still get the page's own default (the Timeline), and
 * nothing is redirected on load; only the Films tab honours what was last used (see `useFilmsViewPref`). Visiting a films view, by any means
 * (the switcher, a tab, a link, a typed address), records it.
 *
 * Pure but for the storage it is handed. Storage is a thing that fails (a private window, blocked site data, a full quota, a
 * server with no `window`), so every read and write is guarded and the choice is also held in memory: without storage the
 * preference still lasts for the page session, and with it, a reload keeps it.
 */

import { FILMS_VIEWS, type FilmsView } from "@/lib/films-view";

/** What a visitor who never used one gets: the flat Timeline, as the page always opened. */
export const DEFAULT_FILMS_VIEW: FilmsView = "timeline";

export const FILMS_VIEW_KEY = "parallel:films-view";

/** The view a stored value stands for: one of the three; anything else (another version's value, a corrupted one, nothing) is the default. */
export function parseFilmsView(raw: unknown): FilmsView {
  return FILMS_VIEWS.find((view) => view === raw) ?? DEFAULT_FILMS_VIEW;
}

/** The part of `Storage` that is used, so a test can hand in a fake (or one that throws). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FilmsViewStore {
  /** The view now: read from storage the first time it is asked for, then held. */
  get(): FilmsView;
  /** Records a view: held at once, written to storage if it can be, and the subscribers told if it changed. */
  set(next: FilmsView): void;
  /** Reads storage again (another tab used a view), telling the subscribers if it differs from what is held. */
  reload(): void;
  subscribe(listener: () => void): () => void;
}

/**
 * A store of the view over `getStorage` (which may return null, or throw: no storage). The server never has any, so it only
 * ever reads the default; the first read in a browser happens on the client, after hydration (see `useFilmsViewPref`).
 */
export function createFilmsViewStore(getStorage: () => StorageLike | null): FilmsViewStore {
  let held: FilmsView | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const read = (): FilmsView => {
    try {
      return parseFilmsView(getStorage()?.getItem(FILMS_VIEW_KEY));
    } catch {
      return DEFAULT_FILMS_VIEW;
    }
  };

  return {
    get() {
      held ??= read();
      return held;
    },
    set(next) {
      const changed = held !== next;
      held = next;
      try {
        getStorage()?.setItem(FILMS_VIEW_KEY, next);
      } catch {
        // No storage: the choice lasts for this page session, in `held`.
      }
      if (changed) notify();
    },
    reload() {
      const next = read();
      if (next === held) return;
      held = next;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
