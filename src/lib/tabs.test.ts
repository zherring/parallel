import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FILM_TAB,
  FILM_TABS,
  nextTabIndex,
  rememberFilmTab,
  rememberedFilmTab,
  scrollTopAfterTabChange,
} from "@/lib/tabs";

describe("FILM_TABS", () => {
  it("lists cast first and defaults to it", () => {
    expect(FILM_TABS).toEqual(["cast", "crew"]);
    expect(DEFAULT_FILM_TAB).toBe("cast");
  });
});

describe("remembered tab", () => {
  afterEach(() => rememberFilmTab(DEFAULT_FILM_TAB));

  it("starts on the default tab", () => {
    expect(rememberedFilmTab()).toBe("cast");
  });

  it("returns the tab chosen last", () => {
    rememberFilmTab("crew");
    expect(rememberedFilmTab()).toBe("crew");
    rememberFilmTab("cast");
    expect(rememberedFilmTab()).toBe("cast");
  });
});

describe("nextTabIndex", () => {
  it("moves right and wraps from the last tab to the first", () => {
    expect(nextTabIndex("ArrowRight", 0, 2)).toBe(1);
    expect(nextTabIndex("ArrowRight", 1, 2)).toBe(0);
    expect(nextTabIndex("ArrowRight", 2, 4)).toBe(3);
  });

  it("moves left and wraps from the first tab to the last", () => {
    expect(nextTabIndex("ArrowLeft", 1, 2)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 2)).toBe(1);
    expect(nextTabIndex("ArrowLeft", 0, 4)).toBe(3);
  });

  it("jumps to the ends with Home and End from anywhere", () => {
    expect(nextTabIndex("Home", 1, 2)).toBe(0);
    expect(nextTabIndex("Home", 0, 2)).toBe(0);
    expect(nextTabIndex("End", 0, 2)).toBe(1);
    expect(nextTabIndex("End", 1, 2)).toBe(1);
  });

  it("stays put on a single tab", () => {
    expect(nextTabIndex("ArrowRight", 0, 1)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 1)).toBe(0);
  });

  it("ignores every other key", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Tab", "Enter", " ", "Escape", "a", "PageDown"]) {
      expect(nextTabIndex(key, 0, 2)).toBeNull();
    }
  });

  it("returns null when there are no tabs", () => {
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
    expect(nextTabIndex("Home", 0, 0)).toBeNull();
  });
});

describe("scrollTopAfterTabChange", () => {
  it("leaves the scroll position alone while the film header is still in view", () => {
    expect(scrollTopAfterTabChange(0, 420)).toBe(0);
    expect(scrollTopAfterTabChange(180, 420)).toBe(180);
    expect(scrollTopAfterTabChange(420, 420)).toBe(420);
  });

  it("brings the tab content back under the bar once the bar has stuck", () => {
    expect(scrollTopAfterTabChange(900, 420)).toBe(420);
    expect(scrollTopAfterTabChange(421, 420)).toBe(420);
  });

  it("never goes negative", () => {
    expect(scrollTopAfterTabChange(50, -10)).toBe(0);
    expect(scrollTopAfterTabChange(0, 0)).toBe(0);
  });
});
