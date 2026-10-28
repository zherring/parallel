import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEYCAP_DOWN_MS, createKeycapPress } from "@/components/landing/keycap-press";
import type { NavDirection } from "@/lib/hero-history";

function setup(downMs?: number) {
  const changes: (NavDirection | null)[] = [];
  const keycap = createKeycapPress((pressed) => changes.push(pressed), downMs);
  return { keycap, changes };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("createKeycapPress", () => {
  it("pushes the cap down at once and lets it up after the hold", () => {
    const { keycap, changes } = setup();
    keycap.press("next");
    expect(changes).toEqual(["next"]);

    vi.advanceTimersByTime(KEYCAP_DOWN_MS - 1);
    expect(changes).toEqual(["next"]);
    vi.advanceTimersByTime(1);
    expect(changes).toEqual(["next", null]);
    keycap.dispose();
  });

  it("holds the cap only briefly, so the whole press (hold plus the 90ms back up) is 120 to 180ms", () => {
    expect(KEYCAP_DOWN_MS + 90).toBeGreaterThanOrEqual(120);
    expect(KEYCAP_DOWN_MS + 90).toBeLessThanOrEqual(180);
  });

  it("does not stack: a press while the cap is down restarts the hold and says nothing new", () => {
    const { keycap, changes } = setup();
    keycap.press("prev");
    vi.advanceTimersByTime(KEYCAP_DOWN_MS - 10);
    keycap.press("prev");
    expect(changes).toEqual(["prev"]); // no second "down"

    vi.advanceTimersByTime(KEYCAP_DOWN_MS - 1);
    expect(changes).toEqual(["prev"]); // the first release was cancelled
    vi.advanceTimersByTime(1);
    expect(changes).toEqual(["prev", null]); // one release, for the last press
    keycap.dispose();
  });

  it("never leaves a cap down, however many presses come in", () => {
    const { keycap, changes } = setup();
    for (let i = 0; i < 20; i++) {
      keycap.press(i % 2 === 0 ? "next" : "prev");
      vi.advanceTimersByTime(KEYCAP_DOWN_MS / 2);
    }
    vi.advanceTimersByTime(KEYCAP_DOWN_MS);
    expect(changes.at(-1)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("has one cap down at a time: the other direction lifts the first", () => {
    const { keycap, changes } = setup();
    keycap.press("prev");
    vi.advanceTimersByTime(20);
    keycap.press("next");
    expect(changes).toEqual(["prev", "next"]);

    vi.advanceTimersByTime(KEYCAP_DOWN_MS);
    expect(changes).toEqual(["prev", "next", null]);
    keycap.dispose();
  });

  it("presses again after a release", () => {
    const { keycap, changes } = setup();
    keycap.press("next");
    vi.advanceTimersByTime(KEYCAP_DOWN_MS);
    keycap.press("next");
    expect(changes).toEqual(["next", null, "next"]);
    vi.advanceTimersByTime(KEYCAP_DOWN_MS);
    expect(changes).toEqual(["next", null, "next", null]);
    keycap.dispose();
  });

  it("uses the hold it is given", () => {
    const { keycap, changes } = setup(200);
    keycap.press("next");
    vi.advanceTimersByTime(199);
    expect(changes).toEqual(["next"]);
    vi.advanceTimersByTime(1);
    expect(changes).toEqual(["next", null]);
    keycap.dispose();
  });

  it("drops the pending release when disposed, and says nothing after", () => {
    const { keycap, changes } = setup();
    keycap.press("next");
    keycap.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(KEYCAP_DOWN_MS * 3);
    expect(changes).toEqual(["next"]);
  });
});
