import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LAYOUT_PREF,
  LAYOUT_PREF_KEY,
  createLayoutPrefStore,
  layoutPrefOf,
  parseLayoutPref,
  type StorageLike,
} from "@/lib/layout-pref";

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

describe("parseLayoutPref", () => {
  it("reads Focus, and everything else as Combined", () => {
    expect(DEFAULT_LAYOUT_PREF).toBe("combined");
    expect(parseLayoutPref("focus")).toBe("focus");
    expect(parseLayoutPref("combined")).toBe("combined");
    // The parked lanes, another version's value, a corrupted one and nothing at all.
    for (const raw of ["separate", "Focus", "depth", "", " focus", null, undefined, 1, {}]) expect(parseLayoutPref(raw)).toBe("combined");
  });
});

describe("layoutPrefOf", () => {
  it("remembers Focus as Focus, and Combined and the lanes as the flat timeline", () => {
    expect(layoutPrefOf("focus")).toBe("focus");
    expect(layoutPrefOf("combined")).toBe("combined");
    expect(layoutPrefOf("separate")).toBe("combined");
  });
});

describe("createLayoutPrefStore", () => {
  it("is Combined for a viewer who never chose, and reads storage once, lazily", () => {
    const storage = fakeStorage();
    const store = createLayoutPrefStore(() => storage);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(store.get()).toBe("combined");
    expect(store.get()).toBe("combined");
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(storage.getItem).toHaveBeenCalledWith(LAYOUT_PREF_KEY);
  });

  it("starts from what a visit before stored", () => {
    expect(createLayoutPrefStore(() => fakeStorage({ [LAYOUT_PREF_KEY]: "focus" })).get()).toBe("focus");
    expect(createLayoutPrefStore(() => fakeStorage({ [LAYOUT_PREF_KEY]: "separate" })).get()).toBe("combined");
    expect(createLayoutPrefStore(() => fakeStorage({ [LAYOUT_PREF_KEY]: "garbage" })).get()).toBe("combined");
  });

  it("writes a choice to storage, holds it, and tells the subscribers only when it changed", () => {
    const storage = fakeStorage();
    const store = createLayoutPrefStore(() => storage);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set("focus");
    expect(store.get()).toBe("focus");
    expect(storage.data.get(LAYOUT_PREF_KEY)).toBe("focus");
    expect(listener).toHaveBeenCalledTimes(1);

    store.set("focus");
    expect(listener).toHaveBeenCalledTimes(1);

    store.set("combined");
    expect(storage.data.get(LAYOUT_PREF_KEY)).toBe("combined");
    expect(store.get()).toBe("combined");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("tells the subscribers of a first choice even when it is the default: nothing had been read yet", () => {
    const store = createLayoutPrefStore(() => fakeStorage());
    const listener = vi.fn();
    store.subscribe(listener);
    store.set("combined");
    expect(store.get()).toBe("combined");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops telling a subscriber that unsubscribed", () => {
    const store = createLayoutPrefStore(() => fakeStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set("focus");
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps the choice in memory when storage throws on every read and write", () => {
    const store = createLayoutPrefStore(throwing);
    expect(store.get()).toBe("combined");
    expect(() => store.set("focus")).not.toThrow();
    expect(store.get()).toBe("focus");
    expect(() => store.reload()).not.toThrow();
  });

  it("keeps the choice in memory when there is no storage at all (the server, a blocked window.localStorage)", () => {
    const none = createLayoutPrefStore(() => null);
    expect(none.get()).toBe("combined");
    none.set("focus");
    expect(none.get()).toBe("focus");

    const failing = createLayoutPrefStore(() => {
      throw new Error("SecurityError");
    });
    expect(failing.get()).toBe("combined");
    failing.set("focus");
    expect(failing.get()).toBe("focus");
  });

  it("does not let a failed write undo what was chosen", () => {
    const storage = fakeStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const store = createLayoutPrefStore(() => storage);
    store.set("focus");
    expect(store.get()).toBe("focus");
  });

  it("reload picks up a choice another tab made, and says so only if it differs", () => {
    const storage = fakeStorage();
    const store = createLayoutPrefStore(() => storage);
    const listener = vi.fn();
    store.get();
    store.subscribe(listener);

    store.reload();
    expect(listener).not.toHaveBeenCalled();

    storage.data.set(LAYOUT_PREF_KEY, "focus");
    store.reload();
    expect(store.get()).toBe("focus");
    expect(listener).toHaveBeenCalledTimes(1);

    storage.data.delete(LAYOUT_PREF_KEY);
    store.reload();
    expect(store.get()).toBe("combined");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("is a separate choice for each store: a new visitor (a fresh storage) starts at the default", () => {
    const a = createLayoutPrefStore(() => fakeStorage());
    a.set("focus");
    expect(createLayoutPrefStore(() => fakeStorage()).get()).toBe("combined");
  });
});
