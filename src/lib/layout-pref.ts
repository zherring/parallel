/**
 * The timeline layout a visitor last chose, Focus (the Depth view) or Combined (the flat timeline), remembered for next time. It is
 * kept in the browser's `localStorage`, per viewer, and not in the address: a shared link and a new visitor still get the page's
 * default, and only the Timeline tab and the layout control honour what was chosen (see `useLayoutPref`). So a visitor who picks
 * Focus, goes to the Table and comes back to Timeline lands on Focus.
 *
 * Pure but for the storage it is handed. Storage is a thing that fails (a private window, blocked site data, a full quota, a
 * server with no `window`), so every read and write is guarded and the choice is also held in memory: without storage the
 * preference still lasts for the page session, and with it, a reload keeps it.
 */

/** The layouts that can be remembered. (The parked Lanes layout is the combined track, see `LANES_ENABLED`.) */
export type LayoutPref = "focus" | "combined";

/** What a visitor who never chose gets: the flat Combined timeline, as the page always opened. */
export const DEFAULT_LAYOUT_PREF: LayoutPref = "combined";

export const LAYOUT_PREF_KEY = "parallel:timeline-layout";

/**
 * The preference a stored value stands for: "focus" is Focus; anything else, including "separate" from the lanes that are parked,
 * a value from another version or a corrupted one, is the default (Combined).
 */
export function parseLayoutPref(raw: unknown): LayoutPref {
  return raw === "focus" ? "focus" : DEFAULT_LAYOUT_PREF;
}

/** The preference that choosing `layout` in the layout control sets: Focus is Focus, and the lanes, like Combined, are the flat timeline. */
export function layoutPrefOf(layout: "focus" | "combined" | "separate"): LayoutPref {
  return layout === "focus" ? "focus" : "combined";
}

/** The part of `Storage` that is used, so a test can hand in a fake (or one that throws). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LayoutPrefStore {
  /** The preference now: read from storage the first time it is asked for, then held. */
  get(): LayoutPref;
  /** Chooses a layout: held at once, written to storage if it can be, and the subscribers told if it changed. */
  set(next: LayoutPref): void;
  /** Reads storage again (another tab chose), telling the subscribers if it differs from what is held. */
  reload(): void;
  subscribe(listener: () => void): () => void;
}

/**
 * A store of the preference over `getStorage` (which may return null, or throw: no storage). The server never has any, so it only
 * ever reads the default; the first read in a browser happens on the client, after hydration (see `useLayoutPref`).
 */
export function createLayoutPrefStore(getStorage: () => StorageLike | null): LayoutPrefStore {
  let held: LayoutPref | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const read = (): LayoutPref => {
    try {
      return parseLayoutPref(getStorage()?.getItem(LAYOUT_PREF_KEY));
    } catch {
      return DEFAULT_LAYOUT_PREF;
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
        getStorage()?.setItem(LAYOUT_PREF_KEY, next);
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
