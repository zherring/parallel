import { describe, expect, it, vi } from "vitest";
import { FILMS_VIEWS } from "@/lib/films-view";
import { DEFAULT_FILMS_VIEW, FILMS_VIEW_KEY, createFilmsViewStore, parseFilmsView, type StorageLike } from "@/lib/films-view-pref";

/** A Storage held in a Map, with the calls it saw. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void data.set(key, value)),
  } satisfies StorageLike & { data: Map<string, string> };
}

const throwing = (): StorageLike => ({
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
});

describe("parseFilmsView", () => {
  it("reads each of the three views, and everything else as the Timeline", () => {
    expect(DEFAULT_FILMS_VIEW).toBe("timeline");
    expect(FILMS_VIEW_KEY).toBe("parallel:films-view");
    for (const view of FILMS_VIEWS) expect(parseFilmsView(view)).toBe(view);
    // The Clippings are not a films view; nor are another version's values, a corrupted one, and nothing at all.
    for (const raw of ["clippings", "separate", "focus", "Table", "", " depth", null, undefined, 1, {}]) expect(parseFilmsView(raw)).toBe("timeline");
  });
});

describe("createFilmsViewStore", () => {
  it("is the Timeline for a viewer who never used another, and reads storage once, lazily", () => {
    const storage = fakeStorage();
    const store = createFilmsViewStore(() => storage);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(store.get()).toBe("timeline");
    expect(store.get()).toBe("timeline");
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(storage.getItem).toHaveBeenCalledWith(FILMS_VIEW_KEY);
  });

  it("starts from what a visit before stored", () => {
    expect(createFilmsViewStore(() => fakeStorage({ [FILMS_VIEW_KEY]: "depth" })).get()).toBe("depth");
    expect(createFilmsViewStore(() => fakeStorage({ [FILMS_VIEW_KEY]: "table" })).get()).toBe("table");
    expect(createFilmsViewStore(() => fakeStorage({ [FILMS_VIEW_KEY]: "clippings" })).get()).toBe("timeline");
    expect(createFilmsViewStore(() => fakeStorage({ [FILMS_VIEW_KEY]: "garbage" })).get()).toBe("timeline");
  });

  it("writes a view to storage, holds it, and tells the subscribers only when it changed", () => {
    const storage = fakeStorage();
    const store = createFilmsViewStore(() => storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set("depth");
    expect(store.get()).toBe("depth");
    expect(storage.data.get(FILMS_VIEW_KEY)).toBe("depth");
    expect(listener).toHaveBeenCalledTimes(1);

    store.set("depth");
    expect(listener).toHaveBeenCalledTimes(1);

    store.set("table");
    expect(storage.data.get(FILMS_VIEW_KEY)).toBe("table");
    expect(store.get()).toBe("table");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("tells the subscribers of a first visit even when it is to the default: nothing had been read yet", () => {
    const store = createFilmsViewStore(() => fakeStorage());
    const listener = vi.fn();
    store.subscribe(listener);
    store.set("timeline");
    expect(store.get()).toBe("timeline");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops telling a subscriber that unsubscribed", () => {
    const store = createFilmsViewStore(() => fakeStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set("depth");
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps the view in memory when storage throws on every read and write", () => {
    const store = createFilmsViewStore(throwing);
    expect(store.get()).toBe("timeline");
    expect(() => store.set("depth")).not.toThrow();
    expect(store.get()).toBe("depth");
    expect(() => store.reload()).not.toThrow();
  });

  it("keeps the view in memory when there is no storage at all (the server, a blocked window.localStorage)", () => {
    const none = createFilmsViewStore(() => null);
    expect(none.get()).toBe("timeline");
    none.set("table");
    expect(none.get()).toBe("table");

    const failing = createFilmsViewStore(() => {
      throw new Error("SecurityError");
    });
    expect(failing.get()).toBe("timeline");
    failing.set("depth");
    expect(failing.get()).toBe("depth");
  });

  it("does not let a failed write undo what was recorded", () => {
    const storage = fakeStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const store = createFilmsViewStore(() => storage);
    store.set("depth");
    expect(store.get()).toBe("depth");
  });

  it("reload picks up a view another tab used, and says so only if it differs", () => {
    const storage = fakeStorage();
    const store = createFilmsViewStore(() => storage);
    const listener = vi.fn();
    store.get();
    store.subscribe(listener);

    store.reload();
    expect(listener).not.toHaveBeenCalled();

    storage.data.set(FILMS_VIEW_KEY, "depth");
    store.reload();
    expect(store.get()).toBe("depth");
    expect(listener).toHaveBeenCalledTimes(1);

    storage.data.delete(FILMS_VIEW_KEY);
    store.reload();
    expect(store.get()).toBe("timeline");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("is a separate view for each store: a new visitor (a fresh storage) starts at the default", () => {
    const a = createFilmsViewStore(() => fakeStorage());
    a.set("depth");
    expect(createFilmsViewStore(() => fakeStorage()).get()).toBe("timeline");
  });
});
