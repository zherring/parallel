import { describe, expect, it } from "vitest";
import { DEFAULT_FILM_PREFS, LANES_ENABLED, NO_HELD_PREFS, effectiveTrackMode, prefsFor, updatePrefs, type HeldPrefs } from "@/lib/film-prefs";

const PAGE = "1+2";
const OTHER = "1+2+3";

describe("prefsFor", () => {
  it("is the defaults for a page nothing was chosen on", () => {
    expect(prefsFor(NO_HELD_PREFS, PAGE)).toEqual({ includeMinor: false, showAll: true, trackMode: "combined" });
    expect(prefsFor(NO_HELD_PREFS, PAGE)).toBe(DEFAULT_FILM_PREFS);
  });

  it("keeps what was chosen when a person is added or removed", () => {
    const held = updatePrefs(NO_HELD_PREFS, PAGE, { includeMinor: true });
    expect(prefsFor(held, PAGE).includeMinor).toBe(true);
    expect(prefsFor(held, OTHER).includeMinor).toBe(true);
  });
});

describe("updatePrefs", () => {
  it("changes only what the patch names", () => {
    let held: HeldPrefs = updatePrefs(NO_HELD_PREFS, PAGE, { trackMode: "separate" });
    held = updatePrefs(held, PAGE, { includeMinor: true });
    expect(prefsFor(held, PAGE)).toEqual({ includeMinor: true, showAll: true, trackMode: "separate" });
  });

  it("returns the very same object when nothing changes", () => {
    expect(updatePrefs(NO_HELD_PREFS, PAGE, {})).toBe(NO_HELD_PREFS);
    expect(updatePrefs(NO_HELD_PREFS, PAGE, { includeMinor: false, trackMode: "combined" })).toBe(NO_HELD_PREFS);
    const held = updatePrefs(NO_HELD_PREFS, PAGE, { showAll: false });
    expect(updatePrefs(held, PAGE, { showAll: false })).toBe(held);
    // Showing every film is what a page starts with: choosing it is no change.
    expect(updatePrefs(NO_HELD_PREFS, PAGE, { showAll: true })).toBe(NO_HELD_PREFS);
  });

  it("applies a change for the new set of people without dropping the choices made for the old one", () => {
    const held = updatePrefs(NO_HELD_PREFS, PAGE, { includeMinor: true, showAll: false, trackMode: "separate" });
    const other = updatePrefs(held, OTHER, { showAll: true });
    expect(prefsFor(other, OTHER)).toEqual({ includeMinor: true, showAll: true, trackMode: "separate" });
    expect(prefsFor(other, PAGE)).toEqual({ includeMinor: true, showAll: true, trackMode: "separate" });
  });

  it("does not hold a page's defaults for a page another one is held for", () => {
    const held = updatePrefs(NO_HELD_PREFS, PAGE, { includeMinor: true });
    expect(updatePrefs(held, OTHER, {})).toBe(held);
  });

  it("does not mutate what it was given", () => {
    const held = updatePrefs(NO_HELD_PREFS, PAGE, { includeMinor: true });
    const frozen = JSON.stringify(held);
    updatePrefs(held, PAGE, { includeMinor: false });
    expect(JSON.stringify(held)).toBe(frozen);
  });
});

describe("effectiveTrackMode", () => {
  it("is the combined track whatever was held while the lanes are parked", () => {
    expect(LANES_ENABLED).toBe(false);
    expect(effectiveTrackMode("combined")).toBe("combined");
    expect(effectiveTrackMode("separate")).toBe("combined");
  });

  it("honours the mode asked for once the lanes are turned on", () => {
    expect(effectiveTrackMode("separate", true)).toBe("separate");
    expect(effectiveTrackMode("combined", true)).toBe("combined");
  });
});
